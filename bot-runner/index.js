const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ... (existing code)
const PAUSE_STEP_IDS = ['derivacion_paciente', 'derivacion_profesional', 'profesional_activo_msg', 'profesional_postulante_msg'];

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/odontobot';
console.log('[INIT] Attempting to connect to MongoDB...', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Mask credentials

mongoose.connect(MONGODB_URI)
    .then(() => console.log('[INIT] MongoDB Connected'))
    .catch(err => {
        console.error('[FATAL] MongoDB Connection Error:', err);
        process.exit(1);
    });

// Define schemas (simplified versions)
const FlowSchema = new mongoose.Schema({}, { strict: false });
const ContactSchema = new mongoose.Schema({}, { strict: false });
const ConversationSchema = new mongoose.Schema({}, { strict: false });
const MessageSchema = new mongoose.Schema({}, { strict: false });
const SettingSchema = new mongoose.Schema({}, { strict: false });

const Flow = mongoose.model('Flow', FlowSchema);
const Contact = mongoose.model('Contact', ContactSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message = mongoose.model('Message', MessageSchema);
const Setting = mongoose.model('Setting', SettingSchema);
const Appointment = mongoose.model('Appointment', new mongoose.Schema({}, { strict: false }));

// Bot state
let botState = 'disconnected'; // disconnected | connecting | connected | error
let currentQR = null;
let qrTimeout = null;
let client = null;
let retryCount = 0;
let lastRetryTime = 0;
let sessionStartTime = null;

// Express API for bot control
const app = express();
app.use(cors());
app.use(express.json());

// GET /bot/status
app.get('/bot/status', (req, res) => {
    res.json({ status: botState });
});

// GET /bot/qr
app.get('/bot/qr', (req, res) => {
    if (botState !== 'connecting' || !currentQR) {
        return res.status(404).json({ error: 'No QR available' });
    }
    res.json({ qr: currentQR });
});

// POST /bot/start
app.post('/bot/start', async (req, res) => {
    const forceClean = req.body?.forceClean === true;

    if (botState === 'connected' && !forceClean) {
        return res.json({ status: 'already_connected' });
    }

    if (botState === 'connecting' && !forceClean) {
        return res.json({ status: 'already_connecting' });
    }

    // Check cooldown (2 minutes between retries)
    const now = Date.now();
    const cooldownMs = 2 * 60 * 1000;
    if (lastRetryTime && (now - lastRetryTime) < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastRetryTime)) / 1000);
        return res.status(429).json({ error: `Cooldown active. Wait ${remaining}s` });
    }

    // Check retry limit (5 per hour)
    if (retryCount >= 5) {
        return res.status(429).json({ error: 'Max retries exceeded. Wait 1 hour.' });
    }

    try {
        await startBot(forceClean);
        retryCount++;
        lastRetryTime = now;
        setTimeout(() => { retryCount = 0; }, 60 * 60 * 1000); // Reset after 1 hour

        res.json({ status: 'starting' });
    } catch (error) {
        console.error('[ERROR] startBot() threw an exception:', error);
        botState = 'disconnected'; // 🔥 Prevent hanging in 'connecting' forever
        res.status(500).json({ error: error.message || 'Unknown error during startup' });
    }
});

// POST /bot/logout
app.post('/bot/logout', async (req, res) => {
    try {
        if (client) {
            await client.destroy();
            client = null;
        }
        botState = 'disconnected';
        currentQR = null;

        // Wipe session directory contents on explicit logout
        const sessionName = process.env.SESSION_NAME || '.wwebjs_auth';
        const authPath = path.join(process.cwd(), sessionName);
        clearDirectoryContents(authPath);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /bot/info
app.get('/bot/info', async (req, res) => {
    if (botState !== 'connected' || !client) {
        return res.status(404).json({ error: 'Bot not connected' });
    }

    try {
        const info = client.info;
        res.json({
            phone: info.wid.user,
            name: info.pushname,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /bot/test-lid
app.get('/bot/test-lid', async (req, res) => {
    if (botState !== 'connected' || !client) {
        return res.status(404).json({ error: 'Bot not connected' });
    }
    const { lid } = req.query;
    if (!lid) {
        return res.status(400).json({ error: 'Parameter "lid" is required' });
    }
    const lidJid = lid.includes('@lid') ? lid : `${lid}@lid`;
    const results = {};

    try {
        // Method 1: enforceLidAndPnRetrieval (cached/direct check)
        results.enforceLidAndPnRetrieval = await client.pupPage.evaluate(async (jid) => {
            try {
                if (window.WWebJS && window.WWebJS.enforceLidAndPnRetrieval) {
                    const r = await window.WWebJS.enforceLidAndPnRetrieval(jid);
                    return {
                        lid: r.lid ? r.lid._serialized : null,
                        phone: r.phone ? r.phone._serialized : null
                    };
                }
            } catch (e) {
                return { error: e.message };
            }
            return null;
        }, lidJid);

        // Method 2: LidUtils.getPhoneNumber directly
        results.getPhoneNumberDirectly = await client.pupPage.evaluate((jid) => {
            try {
                if (window.Store && window.Store.WidFactory && window.Store.LidUtils) {
                    const wid = window.Store.WidFactory.createWid(jid);
                    const pnWid = window.Store.LidUtils.getPhoneNumber(wid);
                    return pnWid ? pnWid._serialized : null;
                }
            } catch (e) {
                return { error: e.message };
            }
            return null;
        }, lidJid);

        // Method 3: Load Contact via Store.Contact.find, then check getPhoneNumber
        results.contactFindThenGetPhoneNumber = await client.pupPage.evaluate(async (jid) => {
            try {
                if (window.Store && window.Store.WidFactory && window.Store.Contact && window.Store.LidUtils) {
                    const wid = window.Store.WidFactory.createWid(jid);
                    const contact = await window.Store.Contact.find(wid);
                    const pnWid = window.Store.LidUtils.getPhoneNumber(wid);
                    return {
                        contactId: contact.id ? contact.id._serialized : null,
                        phoneNumberProp: contact.phoneNumber ? (typeof contact.phoneNumber === 'object' ? contact.phoneNumber._serialized : contact.phoneNumber) : null,
                        pnWid: pnWid ? pnWid._serialized : null
                    };
                }
            } catch (e) {
                return { error: e.message };
            }
            return null;
        }, lidJid);

        // Method 4: Load Chat via Store.Chat.find, then check getPhoneNumber
        results.chatFindThenGetPhoneNumber = await client.pupPage.evaluate(async (jid) => {
            try {
                if (window.Store && window.Store.WidFactory && window.Store.Chat && window.Store.LidUtils) {
                    const wid = window.Store.WidFactory.createWid(jid);
                    const chat = await window.Store.Chat.find(wid);
                    const pnWid = window.Store.LidUtils.getPhoneNumber(wid);
                    return {
                        chatId: chat.id ? chat.id._serialized : null,
                        pnWid: pnWid ? pnWid._serialized : null
                    };
                }
            } catch (e) {
                return { error: e.message };
            }
            return null;
        }, lidJid);

        res.json({ lidJid, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /bot/force-start
app.post('/bot/force-start', async (req, res) => {
    try {
        if (!client || botState !== 'connected') {
            return res.status(400).json({ error: 'El bot no está conectado a WhatsApp.' });
        }

        let { phone, targetStepId } = req.body;
        if (!phone) return res.status(400).json({ error: 'Número de teléfono requerido.' });

        const cleanPhone = phone.replace(/\D/g, '');
        const chatId = `${cleanPhone}@c.us`;

        const flow = await Flow.findOne({ isActive: true, "published": { $ne: null } }).sort({ "activationRules.priority": -1 });
        if (!flow || !flow.published || !flow.published.steps) {
            return res.status(400).json({ error: 'No hay un flujo activo configurado.' });
        }

        // Track previous states for potential rollback
        const prevStates = await Conversation.find({ phone: cleanPhone, state: { $in: ['active', 'paused'] } });
        await Conversation.updateMany({ phone: cleanPhone, state: { $in: ['active', 'paused'] } }, { $set: { state: 'closed' } });

        let contact = await Contact.findOne({ phone: cleanPhone });
        if (!contact) {
            // Can't reliably infer isMyContact without an incoming message check, so default to no_agendado
            await Contact.create({
                phone: cleanPhone,
                status: 'no_agendado',
                source: 'organic',
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                tags: ['forced-start'],
                meta: {},
                events: [{ event: 'Creado mediante Forzar Bot', date: new Date() }]
            });
        }

        const targetStep = targetStepId || flow.published.entryStepId;

        const conversation = await Conversation.create({
            phone: cleanPhone,
            flowId: flow._id,
            flowVersion: flow.publishedVersion,
            currentStepId: targetStep,
            state: 'active',
            tags: ['forced-start'],
            loopDetection: {
                currentStepId: targetStep,
                messagesInCurrentStep: 1, // SET TO 1 SO NEXT REPLY DOES NOT RESEND THE WELCOME TEXT
                lastStepChangeAt: new Date()
            }
        });

        const steps = flow.published.steps;
        const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];
        const firstStep = getStep(targetStep);

        if (!firstStep) {
            return res.status(400).json({ error: 'El flujo activo está roto (Falta paso inicial).' });
        }

        const msgText = formatMessage(firstStep, flow);
        
        try {
            await client.sendMessage(chatId, msgText);
            console.log(`[FORCE START] 🚀 Bot manually injected for ${cleanPhone}`);
            res.json({ success: true, message: 'Bot iniciado exitosamente.' });
        } catch (sendError) {
            console.error(`[FORCE START ERROR] ❌ Failed to inject for ${cleanPhone}:`, sendError.message);
            // Rollback newly created conversation
            await Conversation.deleteOne({ _id: conversation._id });
            // Rollback previous states
            for (const prev of prevStates) {
                await Conversation.updateOne({ _id: prev._id }, { $set: { state: prev.state } });
            }
            res.status(400).json({ error: 'El número de WhatsApp es inválido o no tiene cuenta de WhatsApp.' });
        }
    } catch (error) {
        console.error('[FORCE START ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /bot/retry-step
app.post('/bot/retry-step', async (req, res) => {
    try {
        if (!client || botState !== 'connected') {
            return res.status(400).json({ error: 'El bot no está conectado a WhatsApp.' });
        }

        let { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Número de teléfono requerido.' });

        const cleanPhone = phone.replace(/\D/g, '');
        const chatId = `${cleanPhone}@c.us`;

        const conversation = await Conversation.findOne({ phone: cleanPhone, state: { $in: ['active', 'paused'] } });
        if (!conversation) {
            return res.status(400).json({ error: 'No hay ninguna conversación activa o pausada para destrabar.' });
        }

        const flow = await Flow.findOne({ _id: conversation.flowId });
        if (!flow || !flow.published || !flow.published.steps) {
            return res.status(400).json({ error: 'El flujo activo no se encontró.' });
        }

        const steps = flow.published.steps;
        const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];
        const currentStep = getStep(conversation.currentStepId);

        if (!currentStep) {
            return res.status(400).json({ error: 'Paso actual no encontrado en el flujo.' });
        }

        const msgText = formatMessage(currentStep, flow);
        
        try {
            await client.sendMessage(chatId, msgText);
            console.log(`[RETRY STEP] 🚀 Re-sending step ${currentStep.id} to ${cleanPhone}`);
            
            // Unpause and reset attempts
            await Conversation.updateOne({ _id: conversation._id }, {
                $set: { 
                    state: 'active',
                    "loopDetection.messagesInCurrentStep": 1 
                }
            });
            
            await Contact.updateOne({ phone: cleanPhone }, {
                $push: { events: { event: `Botón Destrabar usado en el paso: ${currentStep.id}`, date: new Date() } }
            });

            res.json({ success: true, message: 'Botón Destrabar ejecutado exitosamente.' });
        } catch (sendError) {
            console.error(`[RETRY STEP ERROR] ❌ Failed to send for ${cleanPhone}:`, sendError.message);
            res.status(400).json({ error: 'El número de WhatsApp rechazó el mensaje.' });
        }
    } catch (error) {
        console.error('[RETRY STEP ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /bot/force-transition
app.post('/bot/force-transition', async (req, res) => {
    try {
        if (!client || botState !== 'connected') {
            return res.status(400).json({ error: 'El bot no está conectado a WhatsApp.' });
        }

        let { phone, targetStepId } = req.body;
        if (!phone || !targetStepId) return res.status(400).json({ error: 'Número de teléfono y targetStepId requeridos.' });

        const cleanPhone = phone.replace(/\D/g, '');
        const chatId = `${cleanPhone}@c.us`;

        const conversation = await Conversation.findOne({ phone: cleanPhone, state: { $in: ['active', 'paused', 'attention'] } });
        if (!conversation) {
            return res.status(400).json({ error: 'No hay ninguna conversación disponible para forzar la ruta.' });
        }

        const flow = await Flow.findOne({ _id: conversation.flowId });
        if (!flow || !flow.published || !flow.published.steps) {
            return res.status(400).json({ error: 'El flujo activo no se encontró.' });
        }

        const steps = flow.published.steps;
        const targetStep = (typeof steps.get === 'function') ? steps.get(targetStepId) : steps[targetStepId];
        if (!targetStep) {
            return res.status(400).json({ error: 'El paso seleccionado no existe en el flujo.' });
        }

        console.log(`[FORCE TRANSITION] 🚀 Simulating step ${targetStepId} for ${cleanPhone}`);
        
        // Setup state to enter the targetStep cleanly
        conversation.currentStepId = targetStepId;
        conversation.state = 'active';
        conversation.loopDetection.currentStepId = targetStepId;
        conversation.loopDetection.messagesInCurrentStep = 0;
        if (conversation.formState) conversation.formState.active = false;
        if (conversation.freeTextState) conversation.freeTextState.active = false;

        await Conversation.updateOne({ _id: conversation._id }, {
            $set: { 
                state: 'active',
                currentStepId: targetStepId,
                "loopDetection.currentStepId": targetStepId,
                "loopDetection.messagesInCurrentStep": 0,
                "formState.active": false,
                "freeTextState.active": false
            }
        });

        await Contact.updateOne({ phone: cleanPhone }, {
            $push: { events: { event: `Ruta forzada por admin hacia la opción: ${targetStepId}`, date: new Date() } }
        });

        const contact = await Contact.findOne({ phone: cleanPhone });
        
        // Mock WhatsApp message layout enough to pass the .getChat() calls
        const fakeMsg = {
            body: '',
            hasMedia: false,
            from: chatId,
            timestamp: Math.floor(Date.now() / 1000),
            getChat: async () => await client.getChatById(chatId),
            getContact: async () => await client.getContactById(chatId)
        };

        // Bypass lock manually
        await handleStepLogic(client, fakeMsg, conversation, flow, contact);

        res.json({ success: true, message: 'Salto ejecutado exitosamente.' });
    } catch (error) {
        console.error('[FORCE TRANSITION ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper: Random delay (10-15 seconds)
const randomDelay = (baseMs = 10000, rangeMs = 5000) => {
    return new Promise(resolve => setTimeout(resolve, baseMs + Math.random() * rangeMs));
};

// Helper: Send typing indicator
const sendTyping = async (chat) => {
    try {
        await chat.sendStateTyping();
    } catch (e) {
        console.error('Error sending typing state:', e);
    }
};

// Helper: Mark as unread with delay to win the race against WA auto-read
const markUnreadWithDelay = (chat, delayMs = 2500) => {
    if (!chat) return;
    setTimeout(async () => {
        try {
            await chat.markUnread();
            // console.log(`[WA] Chat marked as unread after ${delayMs}ms delay`);
        } catch (e) {
            // console.error('[WA] markUnread error:', e.message);
        }
    }, delayMs);
};

// Helper: Universal option matcher for letters (A/B/C), numbers (1/2/3), and text labels
function findMatchingOption(input, options = []) {
    if (!input || !Array.isArray(options) || options.length === 0) return null;
    const rawInput = String(input).trim().toLowerCase();
    const cleanInput = rawInput.replace(/[\)\.\:\-]/g, '').trim();

    for (let idx = 0; idx < options.length; idx++) {
        const opt = options[idx];
        const rawKey = (opt.key || '').toLowerCase().trim();
        const cleanKey = rawKey.replace(/[\)\.\:\-]/g, '').trim();
        const rawLabel = (opt.label || '').toLowerCase().trim();
        const cleanLabel = rawLabel.replace(/[\)\.\:\-]/g, '').trim();

        // 1. Direct Key Match (raw or cleaned)
        const isKeyMatch = (rawInput === rawKey || cleanInput === cleanKey);

        // 2. Letter / Number Equivalence Match for option index (0 -> A/1, 1 -> B/2, 2 -> C/3, etc.)
        const letterForIdx = String.fromCharCode(97 + idx); // 0 -> 'a', 1 -> 'b', 2 -> 'c'
        const numberForIdx = String(idx + 1);              // 0 -> '1', 1 -> '2', 2 -> '3'
        const isIndexMatch = (cleanInput === letterForIdx || cleanInput === numberForIdx);

        // 3. Label Match (exact, start, or partial)
        const isLabelMatch = (cleanInput === cleanLabel || (cleanInput.length >= 3 && cleanLabel.includes(cleanInput)) || (cleanLabel.length >= 3 && cleanInput.includes(cleanLabel)));

        if (isKeyMatch || isIndexMatch || isLabelMatch) {
            return { option: opt, index: idx };
        }
    }
    return null;
}

// Helper: Safely resolve a WhatsApp Chat instance (protects against LID @lid lookup crashes in WWebJS)
async function getSafeChat(client, msg, phone) {
    if (!client) return null;

    const jidsToTry = [];
    let cleanPhone = phone ? String(phone).replace(/[^0-9]/g, '') : '';

    if (cleanPhone) {
        // 1. Direct phone + @c.us
        jidsToTry.push(cleanPhone + '@c.us');

        // 2. Argentina 9 toggle (54911... <-> 5411...)
        if (cleanPhone.startsWith('549') && cleanPhone.length >= 12) {
            jidsToTry.push('54' + cleanPhone.substring(3) + '@c.us');
        } else if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549') && cleanPhone.length >= 11) {
            jidsToTry.push('549' + cleanPhone.substring(2) + '@c.us');
        }

        // 3. Mexico 1 toggle (521... <-> 52...)
        if (cleanPhone.startsWith('521') && cleanPhone.length >= 12) {
            jidsToTry.push('52' + cleanPhone.substring(3) + '@c.us');
        } else if (cleanPhone.startsWith('52') && !cleanPhone.startsWith('521') && cleanPhone.length >= 11) {
            jidsToTry.push('521' + cleanPhone.substring(2) + '@c.us');
        }
    }

    if (msg?.from) jidsToTry.push(msg.from);
    if (msg?.to) jidsToTry.push(msg.to);
    if (msg?.author) jidsToTry.push(msg.author);

    // Try getChatById for candidate JIDs
    for (const jid of jidsToTry) {
        if (!jid) continue;
        try {
            const chat = await client.getChatById(jid);
            if (chat) return chat;
        } catch (e) {
            // Silently fall back
        }
    }

    // Try msg.getChat() as fallback
    if (msg && typeof msg.getChat === 'function') {
        try {
            const chat = await msg.getChat();
            if (chat) return chat;
        } catch (e) {
            // Silently fall back
        }
    }

    // Search existing active chats in client.getChats() by matching phone digits
    if (cleanPhone && cleanPhone.length >= 8) {
        try {
            const lastDigits = cleanPhone.slice(-8);
            const chats = await client.getChats();
            const matchedChat = chats.find(c => {
                const cUser = c.id?.user || '';
                return cUser.endsWith(lastDigits) || cleanPhone.endsWith(cUser);
            });
            if (matchedChat) {
                console.log(`[TRACE] 🔍 getSafeChat matched phone ${cleanPhone} to chat ${matchedChat.id._serialized} via digit search`);
                return matchedChat;
            }
        } catch (e) {
            // Silently fall back to synthetic wrapper
        }
    }

    // Synthetic Fallback Chat wrapper — guarantees getSafeChat never throws and always permits sending
    const primaryJid = msg?.from || jidsToTry.find(j => j.endsWith('@c.us')) || (cleanPhone ? `${cleanPhone}@c.us` : null);
    const fallbackPhoneJid = jidsToTry.find(j => j.endsWith('@c.us')) || (cleanPhone ? `${cleanPhone}@c.us` : null);

    if (primaryJid) {
        console.log(`[TRACE] 🛠️ getSafeChat creating synthetic Chat wrapper (primary: ${primaryJid}, fallback: ${fallbackPhoneJid})`);
        return {
            id: { _serialized: primaryJid, user: primaryJid.replace('@c.us', '').replace('@lid', '') },
            sendMessage: async (content, options) => {
                try {
                    console.log(`[TRACE] 📤 Synthetic sendMessage attempting to ${primaryJid}`);
                    return await client.sendMessage(primaryJid, content, options);
                } catch (e) {
                    if (fallbackPhoneJid && fallbackPhoneJid !== primaryJid) {
                        console.log(`[TRACE] 📤 Primary sendMessage to ${primaryJid} failed (${e.message}). Trying fallback ${fallbackPhoneJid}...`);
                        return await client.sendMessage(fallbackPhoneJid, content, options);
                    }
                    throw e;
                }
            },
            sendStateTyping: async () => {
                try {
                    const chat = await client.getChatById(primaryJid).catch(() => null);
                    if (chat && typeof chat.sendStateTyping === 'function') {
                        return await chat.sendStateTyping();
                    }
                } catch (e) { }
            },
            markUnread: async () => {
                try {
                    const chat = await client.getChatById(primaryJid).catch(() => null);
                    if (chat && typeof chat.markUnread === 'function') {
                        return await chat.markUnread();
                    }
                } catch (e) { }
            }
        };
    }

    throw new Error(`Could not get WhatsApp chat for phone ${phone} / JID ${msg?.from}`);
}

// Helper: Safely resolve a WhatsApp Contact instance (protects against LID @lid lookup crashes)
async function getSafeContact(client, msg, phone) {
    if (!client) return { isMyContact: false, name: msg?.pushname || '', pushname: msg?.pushname || '' };

    const jidsToTry = [];
    let cleanPhone = phone ? String(phone).replace(/[^0-9]/g, '') : '';

    if (cleanPhone) {
        jidsToTry.push(cleanPhone + '@c.us');
        if (cleanPhone.startsWith('549') && cleanPhone.length >= 12) {
            jidsToTry.push('54' + cleanPhone.substring(3) + '@c.us');
        } else if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549') && cleanPhone.length >= 11) {
            jidsToTry.push('549' + cleanPhone.substring(2) + '@c.us');
        }
    }

    if (msg?.from) jidsToTry.push(msg.from);

    for (const jid of jidsToTry) {
        if (!jid) continue;
        try {
            const contact = await client.getContactById(jid);
            if (contact) return contact;
        } catch (e) { }
    }

    if (msg && typeof msg.getContact === 'function') {
        try {
            const contact = await msg.getContact();
            if (contact) return contact;
        } catch (e) { }
    }

    return { isMyContact: false, name: msg?.pushname || '', pushname: msg?.pushname || '' };
}

// Safely clear contents of a directory (works cleanly on Docker volume mount points)
function clearDirectoryContents(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    try {
        console.log(`[CLEANUP] Clearing session contents in ${dirPath}...`);
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const curPath = path.join(dirPath, file);
            fs.rmSync(curPath, { recursive: true, force: true });
        }
        console.log(`[CLEANUP] Successfully cleared session contents in ${dirPath}`);
    } catch (e) {
        console.warn(`[CLEANUP] Warning while clearing directory ${dirPath}:`, e.message);
    }
}

// Remove Chromium process singleton locks left by previous containers or crashes
function removeChromiumLocks(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const findAndUnlinkLocks = (dir) => {
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                try {
                    const stat = fs.lstatSync(fullPath);
                    if (stat.isDirectory()) {
                        findAndUnlinkLocks(fullPath);
                    } else if (file.startsWith('SingletonLock') || file.startsWith('SingletonCookie') || file.startsWith('SingletonSocket')) {
                        fs.unlinkSync(fullPath);
                        console.log(`[CLEANUP] 🔓 Removed stale Chromium lock file: ${fullPath}`);
                    }
                } catch (err) {}
            }
        } catch (err) {}
    };
    findAndUnlinkLocks(dirPath);
}

// Start WhatsApp client
async function startBot(forceClean = false) {
    botState = 'connecting';
    currentQR = null;

    const sessionName = process.env.SESSION_NAME || '.wwebjs_auth';
    const authPath = path.join(process.cwd(), sessionName);

    if (forceClean) {
        clearDirectoryContents(authPath);
    } else {
        console.log(`[INIT] Preserving session directory (${sessionName}) to allow auto-login without QR re-scan.`);
        // Crucial: remove leftover Chromium lock files from previous container hosts to prevent Code 21 (profile locked)
        removeChromiumLocks(authPath);
    }

    // CLEANUP: Destroy old client if it exists
    if (client) {
        console.log('[INIT] Destroying previous client instance...');
        try {
            await client.destroy();
        } catch (e) {
            console.warn('[INIT] Error destroying old client:', e.message);
        }
        client = null;
    }

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: authPath
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions'
            ]
        }
    });

    // QR code handler
    client.on('qr', (qr) => {
        // Suppress QR if already connected/authenticated
        if (botState === 'connected') return;

        console.log('QR Code received');
        currentQR = qr;
        qrcode.generate(qr, { small: true });

        // Clear existing timeout
        if (qrTimeout) clearTimeout(qrTimeout);

        // Set 60-second timeout for QR
        qrTimeout = setTimeout(() => {
            if (botState === 'connecting') {
                botState = 'disconnected';
                currentQR = null;
                console.log('QR timeout - no scan detected. Bot stopped.');
            }
        }, 60000);
    });

    // Connected handler
    client.on('authenticated', () => {
        console.log('[INIT] Client authenticated');
        botState = 'connected';
        currentQR = null;
    });

    client.on('auth_failure', msg => {
        console.error('[INIT] AUTHENTICATION FAILURE', msg);
        botState = 'disconnected';
        currentQR = null;
        clearDirectoryContents(authPath);
    });

    client.on('loading_screen', (percent, message) => {
        console.log('[INIT] LOADING SCREEN', percent, message);
    });

    // Ready handler
    client.on('ready', async () => {
        console.log('✅ WhatsApp bot is ready!');
        botState = 'connected';
        currentQR = null;
        // Clear any leftover phone processing locks in MongoDB
        await Setting.deleteMany({ key: { $regex: '^lock_phone_' } }).catch(err => {
            console.error('[INIT] Error cleaning stale phone locks:', err);
        });

        // Run the background database migration for LID contacts
        runLidMigration(client).catch(err => {
            console.error('[MIGRATION] Error in runLidMigration:', err);
        });
    });

    // Disconnected handler
    client.on('disconnected', (reason) => {
        console.log('Bot disconnected. Reason:', reason);
        botState = 'disconnected';
        currentQR = null;

        const reasonStr = String(reason || '').toUpperCase();
        const isUnlinked = reasonStr.includes('LOGOUT') || reasonStr.includes('NAVIGATION') || reasonStr.includes('UNPAIRED') || reasonStr.includes('CONFLICT');

        if (isUnlinked) {
            console.log(`[INIT] ⚠️ Session unlinked/logged out from phone (Reason: ${reason}). Wiping session directory...`);
            clearDirectoryContents(authPath);
            return;
        }

        // Auto-reconnect only for temporary network disconnections if session files exist
        if (fs.existsSync(authPath)) {
            console.log('[WATCHDOG] ⚡ Network disconnected event fired. Triggering automatic reconnection in 5s...');
            setTimeout(() => {
                autoRecoverBot('disconnected_event');
            }, 5000);
        }
    });

    // Safety timeout: If connecting with saved session hangs for >40s without QR or Ready, wipe session & generate fresh QR
    if (!forceClean && fs.existsSync(authPath)) {
        setTimeout(async () => {
            if (botState === 'connecting' && !currentQR) {
                console.warn('[INIT] ⚠️ Bot stuck in connecting state with saved session for 40s. Session likely revoked on phone. Cleaning session and generating fresh QR...');
                clearDirectoryContents(authPath);
                await startBot(true);
            }
        }, 40000);
    }

    // Heartbeat log to confirm process is alive
    setInterval(() => {
        console.log(`[HEARTBEAT] Bot runner alive. State: ${botState}. Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    }, 20 * 60 * 1000); // Every 20 minutes

    // Call Handler (New Implementation)
    client.on('call', async (call) => {
        console.log('[TRACE] 📞 Incoming call from:', call.from);
        try {
            const sourceId = await resolveLidToPhone(client, call.from);
            const phone = sourceId.replace('@c.us', '').replace('@lid', '');

            // 1. Get Contact Info
            const wppContact = await client.getContactById(call.from);

            // 2. Logic: If saved contact, IGNORE (let it ring/missed call)
            if (wppContact.isMyContact) {
                console.log(`[TRACE] 📞 Call from CONTACT ${phone}. Ignoring to allow normal ringing.`);
                return;
            }

            // 3. Logic: If NOT saved, REJECT and Trigger Flow
            console.log(`[TRACE] 📞 Call from NON-CONTACT ${phone}. Rejecting and triggering flow.`);
            await call.reject();

            // Check DB for existing contact or create
            let dbContact = await Contact.findOne({ phone });
            if (!dbContact) {
                dbContact = await Contact.create({
                    phone,
                    status: 'pendiente',
                    source: 'organic',
                    firstSeenAt: new Date(),
                    lastSeenAt: new Date(),
                    tags: ['call-rejected'],
                    meta: {}
                });
            }

            // Check if already in conversation
            let conversation = await Conversation.findOne({ phone, state: 'active' });
            if (conversation) {
                const chat = await client.getChatById(call.from);
                await chat.sendMessage("⚠️ Te acabamos de cortar la llamada porque soy un asistente virtual. Por favor continuá escribiendo por aquí.");
                return;
            }

            // Select Flow (simulate organic entry)
            // Reuse selectFlow function
            const selectedFlow = await selectFlow({ isAgendado: false, source: dbContact.source, phone });

            if (!selectedFlow) {
                console.log('[TRACE] ❌ No flow found for rejected call.');
                return;
            }

            // Start Conversation
            conversation = await Conversation.create({
                phone,
                flowVersion: selectedFlow.publishedVersion,
                currentStepId: selectedFlow.published.entryStepId,
                state: 'active',
                tags: [],
                loopDetection: {
                    currentStepId: selectedFlow.published.entryStepId,
                    messagesInCurrentStep: 0,
                    lastStepChangeAt: new Date(),
                }
            });

            // Send Welcome Message with Prefix
            const chat = await client.getChatById(call.from);
            const prefix = "👋 ¡Hola! No podemos atender llamadas de voz por este medio, pero soy el asistente virtual de la clínica y estoy aquí para ayudarte.\n\n";

            // Reuse handleStepLogic but we need to inject the prefix logic or just send it manually first?
            // Sending manually first is safer to ensure the prefix is seen.
            await chat.sendMessage(prefix);

            // Now trigger the standard step logic "mocking" a message to start checking the step
            // We need to simulate the "Initial Step Entry" (messagesInCurrentStep = 0)
            // We can just call handleStepLogic with a dummy msg object.

            const mockMsg = {
                body: '',
                from: call.from,
                getChat: async () => chat
            };

            // We pass the flow definition explicitly
            const flowDef = await Flow.findOne({ publishedVersion: conversation.flowVersion });
            await handleStepLogic(client, mockMsg, conversation, flowDef, dbContact);

        } catch (e) {
            console.error('[ERROR] Error handling call:', e);
        }
    });

    // --- MULTI-INSTANCE PROTECTION ---
    const INSTANCE_ID = Math.random().toString(36).substring(7).toUpperCase();
    console.log(`[INIT] Starting Bot Instance ${INSTANCE_ID}`);
    const processedMessages = new Set();
    setInterval(() => processedMessages.clear(), 3600000); // 1hr cleanup

    // --- GLOBAL MESSAGE LOGGER (INCOMING & OUTGOING) ---
    const loggedHistory = new Set();
    setInterval(() => loggedHistory.clear(), 3600000 * 2);

    client.on('message_create', async (msg) => {
        try {
            const messageId = msg.id._serialized;
            if (loggedHistory.has(messageId)) return;
            loggedHistory.add(messageId);

            if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return;
            if (msg.from.endsWith('@g.us') || msg.to.endsWith('@g.us')) return;

            let sourceId = msg.fromMe ? msg.to : msg.from;
            sourceId = await resolveLidToPhone(client, sourceId);
            const phone = sourceId.replace('@c.us', '').replace('@lid', '');

            await Message.create({
                phone,
                direction: msg.fromMe ? 'out' : 'in',
                text: msg.body || (msg.hasMedia ? '[Archivo Multimedia]' : ''),
                timestamp: new Date(msg.timestamp * 1000)
            });

            // PERSISTENT UNREAD: After EVERY bot message, re-mark as unread if forceUnread is true
            // This is the centralized, DB-driven approach — guarantees unread persists until human clears it
            if (msg.fromMe) {
                try {
                    const conv = await Conversation.findOne({ phone, state: { $in: ['active', 'paused'] } });
                    if (conv && conv.forceUnread !== false) {
                        // Default behavior: mark as unread (forceUnread defaults to true)
                        setTimeout(async () => {
                            try {
                                const chat = await msg.getChat();
                                await chat.markUnread();
                            } catch (e) { /* silently fail */ }
                        }, 3000); // 3s delay to win race against WA auto-read
                    }
                } catch (e) { /* silently fail */ }
            }
        } catch (e) {
            console.error('[ERROR] Global message logger failed:', e);
        }
    });

    // Message handler
    client.on('message', async (msg) => {
        const messageId = msg.id._serialized;
        if (processedMessages.has(messageId)) return;
        processedMessages.add(messageId);

        let sourceId = msg.from;
        sourceId = await resolveLidToPhone(client, sourceId);
        const phone = sourceId.replace('@c.us', '').replace('@lid', '');

        const lockKey = `lock_phone_${phone}`;
        const releaseLock = async () => {
            await Setting.deleteOne({ key: lockKey }).catch(() => { });
        };
        let lockTimeout;

        try {
            // 1. ATOMIC CROSS-INSTANCE LOCK BY PHONE (WITH RETRIES & 15s STALE AUTO-CLEANUP)
            let lockAcquired = false;
            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    await Setting.create({ key: lockKey, instance: INSTANCE_ID, at: new Date() });
                    lockAcquired = true;
                    break;
                } catch (err) {
                    if (err.code === 11000) {
                        const existingLock = await Setting.findOne({ key: lockKey });
                        const lockAgeMs = existingLock && existingLock.at ? (Date.now() - new Date(existingLock.at).getTime()) : 999999;
                        if (lockAgeMs > 15000) {
                            console.log(`[LOCK] 🔓 Found stale phone lock for ${phone} (${Math.round(lockAgeMs / 1000)}s old). Removing lock.`);
                            await Setting.deleteOne({ key: lockKey }).catch(() => { });
                        } else {
                            // Wait 600ms for previous message processing turn to complete, then retry
                            await new Promise(r => setTimeout(r, 600));
                        }
                    } else {
                        throw err;
                    }
                }
            }

            if (!lockAcquired) {
                console.log(`[TRACE][${INSTANCE_ID}] 🔒 Lock for ${phone} busy after retries. Processing message.`);
            }

            lockTimeout = setTimeout(releaseLock, 60000); // 60s safety timeout

            // SILENT FILTERS
            if (msg.from === 'status@broadcast') { await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout); return; }
            if (msg.from.endsWith('@g.us')) { await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout); return; }

            // P1 FIX: Ignore system/notification messages (phone number changes, security code changes, etc.)
            // These are NOT real user messages and should never trigger the bot.
            const ALLOWED_MSG_TYPES = ['chat', 'image', 'ptt', 'audio', 'video', 'document', 'sticker', 'location', 'vcard', 'multi_vcard', 'order', 'list_response', 'buttons_response'];
            if (!ALLOWED_MSG_TYPES.includes(msg.type)) {
                console.log(`[TRACE] 🚫 Ignoring system message type "${msg.type}" from ${msg.from}`);
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            // Also ignore messages with completely empty body and no media (system-generated ghosts)
            if (!msg.body && !msg.hasMedia) {
                console.log(`[TRACE] 🚫 Ignoring empty message from ${msg.from} (likely system event)`);
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            const sender = msg.from;
            const body = msg.body;
            console.log(`[TRACE][${INSTANCE_ID}] 📨 PROCESSING: "${body}" from ${sender} (type: ${msg.type})`);

            // 2. SESSION TIME FILTER
            const msgDate = new Date(msg.timestamp * 1000);
            // Default 10-minute safety buffer prior to sessionStartTime to account for latency and clock drift
            let defaultBufferMs = 10 * 60 * 1000;
            let safetyThreshold = sessionStartTime ? new Date(sessionStartTime.getTime() - defaultBufferMs) : null;
            try {
                const safetySetting = await Setting.findOne({ key: 'bot_safety' });
                if (safetySetting && safetySetting.value && safetySetting.value.activationOffset !== undefined) {
                    const offsetMs = safetySetting.value.activationOffset * 60 * 1000;
                    safetyThreshold = sessionStartTime ? new Date(sessionStartTime.getTime() - offsetMs) : null;
                }
            } catch (e) {
                console.error('[ERROR] Could not fetch safety settings.');
            }

            if (sessionStartTime && safetyThreshold && msgDate < safetyThreshold) {
                console.log(`[TRACE] ⏳ Message timestamp (${msgDate.toISOString()}) prior to safety threshold (${safetyThreshold.toISOString()}). Skipping.`);
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            console.log(`[TRACE] 📨 RAW MESSAGE from ${sender}: "${body}"`);

            // --- NAVIGATION INTERCEPTOR (V/M) ---
            const inputRaw = (body || '').trim().toLowerCase();
            const isNav = inputRaw === 'm' || inputRaw === 'v' || inputRaw === 'menu' || inputRaw === 'atras' || inputRaw.includes('menu principal') || inputRaw.includes('volver');

            if (isNav) {
                console.log(`[TRACE] 🔓 Universal Navigation command detected from ${phone}: "${inputRaw}"`);
                // If there's an existing conversation, unpause it in DB and CLEAR ALL PENDING FORM/FREE-TEXT MODES
                await Conversation.updateMany(
                    { phone, state: { $in: ['active', 'paused'] } }, 
                    { 
                        $set: { 
                            state: 'active', 
                            'formState.active': false,
                            'freeTextState.active': false,
                            handoffAckSent: false
                        } 
                    }
                );
            }

            // 3. CONTACT & CONVERSATION
            const chatContact = await getSafeContact(client, msg, phone); // Get full WPP contact info
            const currentStatus = chatContact.isMyContact ? 'agendado' : 'no_agendado';
            
            let contact = await Contact.findOne({ phone });
            if (!contact) {
                contact = await Contact.create({
                    phone,
                    name: chatContact.name || msg.pushname || '', // Prefer Address Book name
                    pushname: msg.pushname || '',
                    status: currentStatus, source: 'organic',
                    firstSeenAt: new Date(), lastSeenAt: new Date(), tags: [], meta: {},
                    events: [{ event: `Contacto creado. Estado inicial: ${currentStatus}`, date: new Date() }]
                });
                console.log(`[TRACE] 👤 New contact created: ${phone} (name: "${contact.name}", pushname: "${msg.pushname || 'none'}", status: ${currentStatus})`);
            } else {
                const contactUpdate = { lastSeenAt: new Date() };
                if (msg.pushname) contactUpdate.pushname = msg.pushname;
                
                // Prioritize Address Book name if available and contact doesn't have a specific manual name
                if (chatContact.name && (!contact.name || contact.name === contact.pushname)) {
                    contactUpdate.name = chatContact.name;
                    contact.name = chatContact.name;
                } else if (msg.pushname && !contact.name) {
                    contactUpdate.name = msg.pushname;
                    contact.name = msg.pushname;
                }

                // Check for status change (e.g. they got added to contacts)
                if (contact.status !== currentStatus) {
                    contactUpdate.status = currentStatus;
                    await Contact.updateOne(
                        { _id: contact._id },
                        {
                            $set: contactUpdate,
                            $push: { events: { event: `Estado comercial actualizado a: ${currentStatus}`, date: new Date() } }
                        }
                    );
                } else {
                    await Contact.updateOne({ _id: contact._id }, { $set: contactUpdate });
                }
            }

            // Find active or paused conversation - SORT BY UPDATED AT
            let activeConversations = await Conversation.find({ phone, state: { $in: ['active', 'paused'] } }).sort({ updatedAt: -1 });
            if (activeConversations.length > 1) {
                console.log(`[WARNING] ⚠️ Multiple active/paused conversations found for ${phone}. Closing duplicates.`);
                const kept = activeConversations.shift();
                await Conversation.updateMany({ phone, state: { $in: ['active', 'paused'] }, _id: { $ne: kept._id } }, { $set: { state: 'closed' } });
                activeConversations = [kept];
            }
            let conversation = activeConversations[0];

            if (msg.body.trim().toUpperCase() === 'RESET') {
                if (activeConversations.length > 0) {
                    await Conversation.updateMany({ phone, state: 'active' }, { $set: { state: 'closed' } });
                }
                const chat = await getSafeChat(client, msg, phone);
                await chat.sendMessage('🔄 Conversación reiniciada.');
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            if (!conversation) {
                const chatContact = await getSafeContact(client, msg, phone);
                let selectedFlow = await selectFlow({ isAgendado: chatContact.isMyContact, source: contact.source, phone });

                // FALLBACK FOR USERS WITH NO MATCHING FLOW RULE
                if (!selectedFlow) {
                    selectedFlow = await Flow.findOne({ isActive: true, published: { $ne: null } }).sort({ 'activationRules.priority': -1 });
                    if (!selectedFlow) {
                        selectedFlow = await Flow.findOne({ published: { $ne: null } }).sort({ updatedAt: -1 });
                    }
                    if (!selectedFlow) {
                        console.log(`[DEBUG] No fallback flow available for ${phone}. Ignoring.`);
                        await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout); return;
                    }
                    console.log(`[DEBUG] Using fallback flow "${selectedFlow.name}" for new contact ${phone}.`);
                }

                conversation = await Conversation.create({
                    phone, flowId: selectedFlow._id, flowVersion: selectedFlow.publishedVersion,
                    currentStepId: selectedFlow.published.entryStepId,
                    state: 'active', tags: [],
                    loopDetection: { currentStepId: selectedFlow.published.entryStepId, messagesInCurrentStep: 0, lastStepChangeAt: new Date() }
                });
                console.log(`[TRACE] New conversation: ${conversation._id}`);
            } else {
                console.log(`[TRACE] Active conversation: ${conversation._id} at ${conversation.currentStepId}`);
                const chatContact = await getSafeContact(client, msg, phone);
                const forcingFlow = await selectFlow({ isAgendado: chatContact.isMyContact, source: contact.source, forceOnly: true, body: msg.body, phone });

                if (forcingFlow) {
                    if (conversation.state === 'paused') {
                        console.log(`[TRACE] 🔓 Force restart keyword detected! Unpausing conversation for ${phone}`);
                    }

                    console.log(`[TRACE] ⚡ FORCE RESTART: "${forcingFlow.name}"`);
                    await Conversation.updateMany({ phone, state: { $in: ['active', 'paused'] } }, { $set: { state: 'closed' } });
                    conversation = await Conversation.create({
                        phone, flowId: forcingFlow._id, flowVersion: forcingFlow.publishedVersion,
                        currentStepId: forcingFlow.published.entryStepId,
                        state: 'active', tags: [],
                        loopDetection: { currentStepId: forcingFlow.published.entryStepId, messagesInCurrentStep: 0, lastStepChangeAt: new Date() }
                    });
                }
            }

            // 🔓 ALLOW ESCAPE FROM PAUSE (Greetings, Nav Commands, Options & Stale Pauses)
            const cleanBody = (msg.body || '').trim().toLowerCase();
            const GREETINGS_AND_NAV = [
                'hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'hola!', 'hello',
                'v', 'm', 'volver', 'menu', 'atras', 'inicio', 'empezar', 'reset',
                '1', '2', '3', '4', 'a', 'b', 'c', 'd'
            ];
            const isGreetingOrNav = GREETINGS_AND_NAV.some(term => cleanBody === term || cleanBody.startsWith(term + ' ')) || cleanBody.includes('menu principal');
            
            const pausedDurationMs = conversation.updatedAt ? (Date.now() - new Date(conversation.updatedAt).getTime()) : 0;
            const isStalePause = pausedDurationMs > 12 * 60 * 60 * 1000; // 12 hours

            if (conversation.state === 'paused' && (isGreetingOrNav || isStalePause)) {
                console.log(`[TRACE] 🔓 Auto-unpausing conversation for ${phone} (Reason: ${isGreetingOrNav ? 'Greeting/Nav keyword' : 'Stale pause >12h'}).`);
                conversation.state = 'active';
                if (conversation.formState) conversation.formState.active = false;
                if (conversation.freeTextState) conversation.freeTextState.active = false;
                conversation.handoffAckSent = false;
                
                await Conversation.updateOne(
                    { _id: conversation._id },
                    { 
                        $set: { 
                            state: 'active',
                            'formState.active': false,
                            'freeTextState.active': false,
                            handoffAckSent: false
                        } 
                    }
                );
            }

            // --- FINAL SILENCE GATE ---
            // If the conversation is officially paused, we STOP here. No automation.
            if (conversation.state === 'paused' && !msg.hasMedia) {
                // ============================================================
                // HANDOFF ACKNOWLEDGMENT
                // When the user sends their first message after a handoff step,
                // send a one-time acknowledgment so they know their message arrived.
                // Text is pulled dynamically from the flow step configuration.
                // ============================================================
                if (!conversation.handoffAckSent) {
                    let ackMessage = null;
                    const flow = await Flow.findOne({ publishedVersion: conversation.flowVersion });

                    if (flow && flow.published && flow.published.steps) {
                        const steps = flow.published.steps;
                        const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];
                        const lastStep = getStep(conversation.currentStepId);

                        if (lastStep?.actions?.handoffAckMessage) {
                            ackMessage = lastStep.actions.handoffAckMessage;

                            // 🚀 DYNAMICALLY APPEND M/V TEXT TO ACK MESSAGE
                            if (lastStep.showNavigation !== false) {
                                const defaultNavMenu = '🔹 *V:* Volver atrás\n🔹 *M:* Menú principal';
                                const defaultNavBack = '_(Si te equivocaste, escribí *V* para volver)_';
                                if (lastStep.id !== flow.published.entryStepId) {
                                    ackMessage += '\n\n' + (flow.published.msgNavigationMenu || defaultNavMenu);
                                } else {
                                    ackMessage += '\n\n' + (flow.published.msgNavigationBack || defaultNavBack);
                                }
                            }
                        }
                    }

                    if (ackMessage) {
                        try {
                            const chat = await getSafeChat(client, msg, phone);
                            await chat.sendMessage(ackMessage);
                            await Conversation.updateOne({ _id: conversation._id }, { $set: { handoffAckSent: true } });
                            console.log(`[TRACE] 📨 Handoff ACK sent to ${phone}`);
                        } catch (ackErr) {
                            console.error(`[ERROR] Failed to send handoff ACK to ${phone}:`, ackErr);
                        }
                    } else {
                        // Mark as sent anyway to avoid evaluating DB queries again
                        await Conversation.updateOne({ _id: conversation._id }, { $set: { handoffAckSent: true } });
                    }
                }
                console.log(`[TRACE] 🛑 Conversation is PAUSED for ${phone}. Bot remains silent.`);
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }


            // Try strict ID first (if exists), then fallback to publishedVersion
            let flow = null;
            if (conversation.flowId) {
                flow = await Flow.findById(conversation.flowId);
            } else {
                flow = await Flow.findOne({ publishedVersion: conversation.flowVersion });
            }

            // Verify if the current step still exists (flow might have been edited)
            let isFlowBroken = !flow || !flow.published;
            if (flow && flow.published && flow.published.steps) {
                const getStep = (id) => (typeof flow.published.steps.get === 'function') ? flow.published.steps.get(id) : flow.published.steps[id];
                if (!getStep(conversation.currentStepId)) isFlowBroken = true;
            }

            // If the flow is broken (e.g. republished or deleted) while we are active, graceful restart
            if (isFlowBroken && conversation.state !== 'paused') {
                console.log(`[WARNING] Flow V${conversation.flowVersion} missing or step broken for ${phone}. Forcing restart.`);
                await Conversation.updateOne({ _id: conversation._id }, { $set: { state: 'closed' } });

                const chatContact = await getSafeContact(client, msg, phone);
                const selectedFlow = await selectFlow({ isAgendado: chatContact.isMyContact, source: contact.source, phone });

                if (!selectedFlow) {
                    console.log(`[TRACE] No fallback flow found for ${phone}.`);
                    await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                    return;
                }

                conversation = await Conversation.create({
                    phone, flowId: selectedFlow._id, flowVersion: selectedFlow.publishedVersion,
                    currentStepId: selectedFlow.published.entryStepId,
                    state: 'active', tags: [],
                    loopDetection: { currentStepId: selectedFlow.published.entryStepId, messagesInCurrentStep: 0, lastStepChangeAt: new Date() }
                });
                flow = selectedFlow;
            }

            if (!flow || conversation.state === 'paused') {
                console.log(`[TRACE] Flow missing or Bot PAUSED for ${phone}.`);
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            // ============================================================
            // FREE TEXT CAPTURE INTERCEPTOR (Otros Temas / Consultas Libres)
            // Triggered when freeTextState.active is true.
            // ============================================================
            if (conversation.freeTextState && conversation.freeTextState.active) {
                const freeInput = (msg.body || '').trim();
                const chat = await getSafeChat(client, msg, phone);

                // Allow V/M to cancel
                const freeInputLow = freeInput.toLowerCase();
                if (freeInputLow === 'v' || freeInputLow === 'm' || freeInputLow === 'menu' || freeInputLow === 'volver') {
                    await Conversation.updateOne({ _id: conversation._id }, { $set: { 'freeTextState.active': false } });
                    await handleStepLogic(client, msg, conversation, flow, contact);
                    await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                    return;
                }

                if (freeInput.length < 3) {
                    await sendTyping(chat);
                    await randomDelay(500, 300);
                    await chat.sendMessage('Por favor escribí tu consulta en detalle 🙏');
                    await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                    return;
                }

                const ackMessage = conversation.freeTextState.ackMessage
                    || '✅ Recibimos tu consulta. Un integrante del equipo la revisará y te responderá a la brevedad. 🙏\n\n🔹 *M:* Menú principal';

                await Conversation.updateOne({ _id: conversation._id }, {
                    $set: {
                        'freeTextState.active': false,
                        'freeTextState.collectedText': freeInput,
                        'freeTextState.collectedAt': new Date(),
                    },
                    $addToSet: { tags: { $each: ['otros-temas', 'atencion-requerida'] } }
                });

                await sendTyping(chat);
                await randomDelay(800, 400);
                await chat.sendMessage(ackMessage);

                // Mark unread + WA label so Salvador sees it immediately
                markUnreadWithDelay(chat);
                await syncWhatsAppLabel(chat, 'Consulta Libre');

                console.log(`[TRACE] 📝 FreeText captured from ${phone}: "${freeInput.substring(0, 60)}..."`);
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            // ============================================================
            // LEAD CAPTURE FORM INTERCEPTOR
            // Triggered when formState.active is true.
            // Collects name (full) then email before entering the intended step.
            // Prompts are loaded from the flow step configuration.
            // ============================================================
            if (conversation.formState && conversation.formState.active) {
                const formInput = (msg.body || '').trim();
                const chat = await getSafeChat(client, msg, phone);

                // Allow V/M to cancel the form
                const formInputLow = formInput.toLowerCase();
                if (formInputLow === 'v' || formInputLow === 'm' || formInputLow === 'menu' || formInputLow === 'volver') {
                    await Conversation.updateOne({ _id: conversation._id }, { $set: { 'formState.active': false } });
                    conversation.formState.active = false; // UPDATE LOCAL OBJECT too
                    await handleStepLogic(client, msg, conversation, flow, contact);
                    if (lockTimeout) clearTimeout(lockTimeout);
                    await releaseLock();
                    return;
                }

                if (conversation.formState.currentField === 'name') {
                    // Accept any text of 2+ chars as name
                    if (formInput.length < 2) {
                        await sendTyping(chat);
                        await randomDelay(500, 300);
                        await chat.sendMessage('Por favor ingresá tu nombre y apellido completo 🙏');
                        await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                        return;
                    }

                    // Get the step config for email prompt
                    const steps = flow.published.steps;
                    const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];
                    const pendingStep = getStep(conversation.formState.pendingStepId);
                    const emailPrompt = pendingStep?.actions?.leadDataEmailPrompt || '¡Gracias! Ahora necesito tu *email* para poder enviarte información detallada 📧';

                    await Conversation.updateOne({ _id: conversation._id }, {
                        $set: { 'formState.name': formInput, 'formState.currentField': 'email', 'formState.attempts': 0 }
                    });
                    await sendTyping(chat);
                    await randomDelay(600, 300);
                    await chat.sendMessage(emailPrompt);
                    await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                    return;
                }

                if (conversation.formState.currentField === 'email') {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    const currentAttempts = conversation.formState.attempts || 0;

                    if (!emailRegex.test(formInput)) {
                        if (currentAttempts >= 2) {
                            // 3 failed attempts: skip email, continue anyway
                            console.log(`[TRACE] 📋 Lead form: email validation failed 3x for ${phone}. Skipping email.`);
                            const savedName = conversation.formState.name;
                            const pendingStepId = conversation.formState.pendingStepId;
                            await Contact.updateOne({ phone }, { $set: { name: savedName } });
                            await Conversation.updateOne({ _id: conversation._id }, {
                                $set: {
                                    'formState.active': false,
                                    'formState.email': '',
                                    currentStepId: pendingStepId,
                                    'loopDetection.currentStepId': pendingStepId,
                                    'loopDetection.messagesInCurrentStep': 0,
                                    'loopDetection.lastStepChangeAt': new Date()
                                }
                            });
                            conversation.currentStepId = pendingStepId;
                            conversation.formState.active = false;
                            conversation.loopDetection.messagesInCurrentStep = 0;
                            conversation.loopDetection.currentStepId = pendingStepId;
                            // P2 FIX: Refresh from DB before recursive call
                            const freshConv2 = await Conversation.findById(conversation._id);
                            if (freshConv2) {
                                freshConv2.loopDetection.messagesInCurrentStep = 0;
                                await handleStepLogic(client, msg, freshConv2, flow, contact);
                            } else {
                                await handleStepLogic(client, msg, conversation, flow, contact);
                            }
                            if (lockTimeout) clearTimeout(lockTimeout);
                            await releaseLock();
                            return;
                        }
                        await Conversation.updateOne({ _id: conversation._id }, { $inc: { 'formState.attempts': 1 } });
                        await sendTyping(chat);
                        await randomDelay(500, 300);
                        await chat.sendMessage('Ese email no parece válido 🤔 Por favor ingresá uno correcto (ej: nombre@ejemplo.com)');
                        await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                        return;
                    }

                    // Valid email — save everything to Contact and advance
                    const savedName = conversation.formState.name;
                    const pendingStepId = conversation.formState.pendingStepId;
                    console.log(`[TRACE] 📋 Lead form COMPLETE for ${phone}: name="${savedName}" email="${formInput}"`);
                    await Contact.updateOne({ phone }, { $set: { name: savedName, email: formInput } });
                    await Conversation.updateOne({ _id: conversation._id }, {
                        $set: {
                            'formState.active': false,
                            'formState.email': formInput,
                            currentStepId: pendingStepId,
                            'loopDetection.currentStepId': pendingStepId,
                            'loopDetection.messagesInCurrentStep': 0,
                            'loopDetection.lastStepChangeAt': new Date()
                        }
                    });
                    conversation.currentStepId = pendingStepId;
                    conversation.formState.active = false;
                    conversation.loopDetection.messagesInCurrentStep = 0;
                    conversation.loopDetection.currentStepId = pendingStepId;

                    // Mark unread + WA label so Salvador sees it immediately
                    markUnreadWithDelay(chat);
                    await syncWhatsAppLabel(chat, 'Dejó Sus Datos');

                    // P2 FIX: Force-refresh the conversation object from DB before recursive call
                    // to ensure handleStepLogic sees the correct state
                    const freshConv = await Conversation.findById(conversation._id);
                    if (freshConv) {
                        freshConv.loopDetection.messagesInCurrentStep = 0;
                        await handleStepLogic(client, msg, freshConv, flow, contact);
                    } else {
                        await handleStepLogic(client, msg, conversation, flow, contact);
                    }
                    if (lockTimeout) clearTimeout(lockTimeout);
                    await releaseLock();
                    return;
                }
            }

            // --- LEAD CAPTURE FORM TRIGGER ---
            // Trigger the form if the current step OR a selected option leads to a step with `collectLeadData: true`
            const stepRequiresCapture = (() => {
                const steps = flow?.published?.steps;
                if (!steps || !conversation.currentStepId) return null;
                const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];
                const currentStep = getStep(conversation.currentStepId);
                if (!currentStep) return null;

                // 1. Check if the CURRENT step itself requires lead capture
                if (currentStep.actions?.collectLeadData) {
                    return { id: currentStep.id, step: currentStep };
                }

                // 2. Check if the user selected an option that leads to a capture step
                const input = (msg.body || '').trim();
                const matchedOpt = findMatchingOption(input, currentStep.options);
                if (matchedOpt) {
                    const targetStep = getStep(matchedOpt.option.nextStepId);
                    if (targetStep && targetStep.actions?.collectLeadData) {
                        return { id: matchedOpt.option.nextStepId, step: targetStep };
                    }
                }
                return null;
            })();

            if (stepRequiresCapture && (!contact.name || !contact.email)) {
                const chat = await getSafeChat(client, msg, phone);
                const namePrompt = stepRequiresCapture.step.actions?.leadDataNamePrompt || '¡Perfecto! Antes de continuar necesito un par de datos 😊\n\n¿Cuál es tu *nombre y apellido*?';

                await Conversation.updateOne({ _id: conversation._id }, {
                    $set: {
                        'formState.active': true,
                        'formState.pendingStepId': stepRequiresCapture.id,
                        'formState.currentField': 'name',
                        'formState.name': '',
                        'formState.email': '',
                        'formState.attempts': 0,
                    }
                });
                conversation.formState = { active: true, pendingStepId: stepRequiresCapture.id, currentField: 'name', name: '', email: '', attempts: 0 };
                await sendTyping(chat);
                await randomDelay(600, 300);
                await chat.sendMessage(namePrompt);
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            // --- FREE TEXT TRIGGER ---
            // Triggered when user selects an option that leads to a step with `collectFreeText: true`
            const nextFreeTextStep = (() => {
                const steps = flow?.published?.steps;
                if (!steps || !conversation.currentStepId) return null;
                const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];
                const currentStep = getStep(conversation.currentStepId);
                if (!currentStep) return null;

                const input = (msg.body || '').trim();
                const matchedOpt = findMatchingOption(input, currentStep.options);
                if (matchedOpt) {
                    const targetStep = getStep(matchedOpt.option.nextStepId);
                    if (targetStep && targetStep.actions?.collectFreeText) {
                        return { id: matchedOpt.option.nextStepId, step: targetStep };
                    }
                }
                return null;
            })();

            if (nextFreeTextStep) {
                const chat = await getSafeChat(client, msg, phone);
                const freeTextPrompt = nextFreeTextStep.step.actions?.freeTextPrompt
                    || '¡Entendido! Por favor describí tu consulta y un integrante del equipo te responderá a la brevedad. 🙏';
                const freeTextAck = nextFreeTextStep.step.actions?.freeTextAckMessage
                    || '✅ Recibimos tu consulta. Un integrante del equipo la revisará y te responderá a la brevedad. 🙏\n\n🔹 *M:* Menú principal';

                // First, send the prompt asking for the free text
                await Conversation.updateOne({ _id: conversation._id }, {
                    $set: {
                        currentStepId: nextFreeTextStep.id,
                        'freeTextState.active': true,
                        'freeTextState.ackMessage': freeTextAck,
                        'loopDetection.currentStepId': nextFreeTextStep.id,
                        'loopDetection.messagesInCurrentStep': 0,
                        'loopDetection.lastStepChangeAt': new Date()
                    }
                });

                await sendTyping(chat);
                await randomDelay(600, 300);
                await chat.sendMessage(freeTextPrompt);
                console.log(`[TRACE] 📝 FreeText prompt sent to ${phone} for step ${nextFreeTextStep.id}`);
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            await handleStepLogic(client, msg, conversation, flow, contact);

            // GLOBAL: Always mark as unread after bot has finished its turn.
            // This ensures Salvador sees the unread notification for every incoming message.
            const chat = await getSafeChat(client, msg, phone);
            markUnreadWithDelay(chat);

            // FINAL CLEANUP
            if (lockTimeout) clearTimeout(lockTimeout);
            await releaseLock();

        } catch (e) {
            console.error('[ERROR] Fatal Error in message handler:', e);
            if (lockTimeout) clearTimeout(lockTimeout);
            await releaseLock();
        }
    });

    // Helper: Logic to handle a step
    async function handleStepLogic(client, msg, conversation, flow, contact) {
        const steps = flow.published.steps;
        const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];

        console.log(`[TRACE][${conversation._id}] 🤖 Handling message with Flow V${flow.publishedVersion} at Step: ${conversation.currentStepId}`);

        let loopSafety = 0;
        const input = (msg.body || '').trim().toLowerCase();

        // 1. UNIVERSAL COMMANDS (V/M) - Only if NOT paused
        const isPaused = conversation.state === 'paused';
        const GREETINGS_NAV = ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'hola!', 'hello', 'm', 'menu', 'inicio', 'empezar', 'reset'];
        const isMenuOrGreeting = GREETINGS_NAV.some(t => input === t || input.startsWith(t + ' ')) || input.includes('menu principal');

        if (!isPaused && isMenuOrGreeting) {
            console.log(`[TRACE] 🏠 Universal Menu/Greeting requested by ${contact.phone}: "${input}"`);
            const newStepId = flow.published.entryStepId;
            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $set: {
                        state: 'active', // Ensure state is active on nav
                        currentStepId: newStepId,
                        history: [],
                        "loopDetection.currentStepId": newStepId,
                        "loopDetection.messagesInCurrentStep": 0,
                        "loopDetection.lastStepChangeAt": new Date()
                    }
                }
            );
            conversation.currentStepId = newStepId;
            conversation.state = 'active';
            conversation.history = [];
            conversation.loopDetection.messagesInCurrentStep = 0;

            const currentStep = getStep(newStepId);
            if (currentStep) {
                // Check if entry step requires lead capture first
                if (currentStep.actions?.collectLeadData && (!contact.name || !contact.email)) {
                    const namePrompt = currentStep.actions?.leadDataNamePrompt || '¡Perfecto! Antes de continuar necesito un par de datos 😊\n\n¿Cuál es tu *nombre y apellido*?';
                    await Conversation.updateOne({ _id: conversation._id }, {
                        $set: {
                            'formState.active': true,
                            'formState.pendingStepId': currentStep.id,
                            'formState.currentField': 'name',
                            'formState.name': '',
                            'formState.email': '',
                            'formState.attempts': 0,
                        }
                    });
                    const chat = await getSafeChat(client, msg, contact.phone);
                    await sendTyping(chat);
                    await randomDelay(600, 300);
                    await chat.sendMessage(namePrompt);
                    return;
                }

                const response = formatMessage(currentStep, flow);
                const chat = await getSafeChat(client, msg, contact.phone);
                await sendTyping(chat);
                await randomDelay(600, 300);
                await chat.sendMessage(response);
                markUnreadWithDelay(chat);
            }
            return;
        }
        else if (!isPaused && (input === 'v' || input === 'atras' || input.includes('volver'))) {
            console.log(`[TRACE] ⬅️ Universal Back requested by ${contact.phone}`);
            let newStepId = flow.published.entryStepId;
            let newHistory = [...(conversation.history || [])];

            if (newHistory.length > 0) {
                newStepId = newHistory.pop();
            }

            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $set: {
                        state: 'active', // Ensure state is active on nav
                        currentStepId: newStepId,
                        history: newHistory,
                        "loopDetection.currentStepId": newStepId,
                        "loopDetection.messagesInCurrentStep": 0,
                        "loopDetection.lastStepChangeAt": new Date()
                    }
                }
            );
            conversation.currentStepId = newStepId;
            conversation.state = 'active';
            conversation.history = newHistory;
            conversation.loopDetection.messagesInCurrentStep = 0;

            const currentStep = getStep(newStepId);
            if (currentStep) {
                const response = formatMessage(currentStep, flow);
                const chat = await getSafeChat(client, msg, contact.phone);
                await sendTyping(chat);
                await randomDelay(600, 300);
                await chat.sendMessage(response);
                markUnreadWithDelay(chat);
            }
            return;
        }

        // 1.5a VOICE MESSAGE (PTT) DETECTION
        // Detect voice notes (Audio/PTT) and respond asking user to write text instead
        if (msg.type === 'ptt' || msg.type === 'audio') {
            console.log(`[TRACE] 🎤 Voice message (PTT) received from ${contact.phone}. Sending text request.`);
            const chat = await getSafeChat(client, msg, contact.phone);
            await sendTyping(chat);
            await randomDelay(800, 400);

            // NOTE: This field is set in Flow Builder → Reglas → "Mensaje al recibir audios".
            // The flow must be PUBLISHED (not just saved) for changes to take effect.
            const pttMsg = (flow && flow.published && flow.published.msgPttResponse)
                || '🎤 Por el momento preferimos comunicarnos por texto para organizarnos mejor. Por favor escribinos tu consulta 🙏\n\n🔹 *M:* Menú principal';

            await chat.sendMessage(pttMsg);
            await Conversation.updateOne(
                { _id: conversation._id },
                { $addToSet: { tags: 'mensaje-de-voz' } }
            );
            // Mark unread so Salvador sees the audio in his inbox
            markUnreadWithDelay(chat);
            return;
        }

        // 1.5 MEDIA DETECTION (Receipts / Payment Proof)
        if (msg.hasMedia) {
            console.log(`[TRACE] 📸 Media detected from ${contact.phone}.`);

            // FIX 2: PAYMENT GUARD — Only send the comprobante ACK if user is actually in a payment-awaiting step.
            // Steps that are valid places to receive a payment proof:
            const PAYMENT_STEPS = ['esperando_pago_reserva', 'esperando_comprobante', 'waiting_payment'];
            const isInPaymentStep = PAYMENT_STEPS.some(s => conversation.currentStepId?.toLowerCase().includes(s)
                || conversation.currentStepId === s);

            if (!isInPaymentStep) {
                console.log(`[TRACE] 🚫 Media received outside payment step (step: ${conversation.currentStepId}). Sending menu fallback.`);
                const chat = await getSafeChat(client, msg, contact.phone);
                await sendTyping(chat);
                await randomDelay(800, 400);
                await chat.sendMessage('No pude entender ese archivo. Escribí *M* para volver al menú principal o *V* para volver atrás.');
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            await Contact.updateOne(
                { phone }, 
                { 
                    $addToSet: { tags: 'pago-enviado' },
                    $push: { events: { event: 'Etiqueta agregada: pago-enviado', date: new Date() } }
                }
            );
            await Conversation.updateOne(
                { _id: conversation._id },
                { $addToSet: { tags: 'pago-enviado' } }
            );

            const chat = await getSafeChat(client, msg, contact.phone);
            // Mark unread + WA label — Salvador needs to verify this payment
            markUnreadWithDelay(chat);
            await syncWhatsAppLabel(chat, 'Pago Enviado');

            await sendTyping(chat);
            await randomDelay(1000, 500);

            let mediaAckMsg = (flow && flow.published && flow.published.msgMediaAck)
                ? flow.published.msgMediaAck
                : '✅ ¡Recibimos tu archivo! Un administrador lo revisará en breve para confirmar tu pago y turno. ¡Gracias! 👤';

            const showNav = flow && flow.published && flow.published.showNavigationOnMediaAck !== undefined
                ? flow.published.showNavigationOnMediaAck
                : true;

            if (showNav) {
                const defaultNavMenu = '🔹 *V:* Volver atrás\n🔹 *M:* Menú principal';
                mediaAckMsg += '\n\n' + (flow?.published?.msgNavigationMenu || defaultNavMenu);
            }

            await chat.sendMessage(mediaAckMsg);

            await syncWhatsAppLabel(chat, 'Derivado con Personal');
            return; // Stop processing for this message
        }

        let targetOption = null;

        // 2. STATE MACHINE LOOP
        while (loopSafety < 5) {
            loopSafety++;
            const currentStep = getStep(conversation.currentStepId);

            if (!currentStep) {
                console.error(`[TRACE] ❌ Step definition missing for ID: ${conversation.currentStepId}`);
                break;
            }

            // --- ACTION HANDLER ---
            if (currentStep.actions) {
                console.log(`[TRACE][${conversation._id}] ⚡ Actions detected for ${currentStep.id}: ${JSON.stringify(currentStep.actions)}`);
                const ops = {};
                if (currentStep.actions.pauseConversation || PAUSE_STEP_IDS.includes(currentStep.id)) {
                    if (!currentStep.actions.pauseConversation) {
                        console.log(`[TRACE][${conversation._id}] ⚠️ FAIL-SAFE: Forcing pause for handoff step ${currentStep.id}`);
                    } else {
                        console.log(`[TRACE][${conversation._id}] ⏸️ Specific Action: pauseConversation detected.`);
                    }
                    ops.$set = { state: 'paused' };
                    conversation.state = 'paused';
                    const chat = await getSafeChat(client, msg, contact.phone);
                    await syncWhatsAppLabel(chat, 'Quiso Hablar Asesor');
                    // Mark unread — requires human attention now
                    markUnreadWithDelay(chat);
                }
                if (currentStep.actions.addTags && Array.isArray(currentStep.actions.addTags)) {
                    ops.$addToSet = { tags: { $each: currentStep.actions.addTags } };
                }
                if (Object.keys(ops).length > 0) {
                    await Conversation.updateOne({ _id: conversation._id }, ops);
                }
            }

            // Entry Point (Send Message)
            if (conversation.loopDetection.messagesInCurrentStep === 0) {
                // 1. Proactive State Sync: Mark as 'sending' to prevent parallel triggers
                await Conversation.updateOne(
                    { _id: conversation._id },
                    {
                        $set: { "loopDetection.messagesInCurrentStep": 1 },
                        $inc: { __v: 1 }
                    }
                );
                conversation.loopDetection.messagesInCurrentStep = 1;

                // AUTO-TAG: if entering a payment step for the first time, tag as 'intento-pagar'
                const PAYMENT_KEYWORDS = ['pago', 'reserva', 'turno', 'payment', 'link_pago', 'link-pago'];
                const isPaymentStep = PAYMENT_KEYWORDS.some(k => (currentStep.id || '').toLowerCase().includes(k));
                if (isPaymentStep) {
                    await Conversation.updateOne(
                        { _id: conversation._id },
                        { $addToSet: { tags: 'intento-pagar' } }
                    );
                    await Contact.updateOne(
                        { phone: contact.phone }, 
                        { 
                            $addToSet: { tags: 'intento-pagar' },
                            $push: { events: { event: 'Etiqueta agregada: intento-pagar', date: new Date() } }
                        }
                    );
                    console.log(`[TRACE][${conversation._id}] 💳 Auto-tagged 'intento-pagar' for step ${currentStep.id}`);
                }

                const response = formatMessage(currentStep, flow);
                const chat = await getSafeChat(client, msg, contact.phone);

                // AUTO-TAG: if step contains info-rich content, tag as 'solicito-info'
                const INFO_KEYWORDS = ['tienda.rad-implantes.com.ar', '.pdf', 'protesis', 'implante', 'presupuesto', 'informe'];
                const isInfoStep = INFO_KEYWORDS.some(k => response.toLowerCase().includes(k) || (currentStep.id || '').toLowerCase().includes(k));
                if (isInfoStep) {
                    await Contact.updateOne(
                        { phone: contact.phone }, 
                        { 
                            $addToSet: { tags: 'solicito-info' },
                            $push: { events: { event: 'Etiqueta agregada: solicito-info', date: new Date() } }
                        }
                    );
                    await Conversation.updateOne(
                        { _id: conversation._id },
                        { $addToSet: { tags: 'solicito-info' } }
                    );
                    console.log(`[TRACE][${conversation._id}] ℹ️ Auto-tagged 'solicito-info' for step ${currentStep.id}`);
                    
                    // Also sync label in WA and mark as unread immediately
                    await syncWhatsAppLabel(chat, 'ℹ️ SOLICITÓ INFO');
                    markUnreadWithDelay(chat);
                }

                try {
                    await sendTyping(chat);
                    await randomDelay(1000, 500);

                    if (currentStep.mediaUrl) {
                        const alreadySentMedia = (conversation.visitedMediaSteps || []).includes(currentStep.id);

                        if (!alreadySentMedia) {
                            // First visit: send media + text
                            try {
                                const mediaUrl = currentStep.mediaUrl;
                                let media;
                                if (mediaUrl.startsWith('/uploads/')) {
                                    const filePath = path.join(__dirname, 'public', mediaUrl);
                                    console.log(`[TRACE][${conversation._id}] 📂 Loading local media from: ${filePath}`);
                                    media = MessageMedia.fromFilePath(filePath);
                                } else {
                                    console.log(`[TRACE][${conversation._id}] 🖼️ Fetching remote media from: ${mediaUrl}`);
                                    media = await MessageMedia.fromUrl(mediaUrl);
                                }
                                console.log(`[TRACE][${conversation._id}] 📤 Sending Media + Text[${currentStep.id}]: "${response.replace(/\n/g, ' ')}"`);
                                await chat.sendMessage(media, { caption: response });
                                // Track that we sent media for this step
                                await Conversation.updateOne({ _id: conversation._id }, { $addToSet: { visitedMediaSteps: currentStep.id } });
                                if (!conversation.visitedMediaSteps) conversation.visitedMediaSteps = [];
                                conversation.visitedMediaSteps.push(currentStep.id);
                            } catch (mediaError) {
                                console.error(`[ERROR] Failed to fetch media from ${currentStep.mediaUrl}:`, mediaError);
                                console.log(`[TRACE][${conversation._id}] 📤 Falling back to Text Only[${currentStep.id}]: "${response.replace(/\n/g, ' ')}"`);
                                await chat.sendMessage(response);
                            }
                        } else {
                            // Revisit: text only (no image to avoid gallery spam)
                            console.log(`[TRACE][${conversation._id}] 📤 Revisit (no media)[${currentStep.id}]: "${response.replace(/\n/g, ' ')}"`);
                            await chat.sendMessage(response);
                        }
                    } else {
                        console.log(`[TRACE][${conversation._id}] 📤 Sending[${currentStep.id}]: "${response.replace(/\n/g, ' ')}"`);
                        await chat.sendMessage(response);
                    }

                    // --- REMARKETING CLOSURE ---
                    // If this is a terminal step (no options) and was tagged as solicito-info,
                    // send a final amigable closure to avoid the flow feeling 'truncated'.
                    const isTerminal = !currentStep.options || currentStep.options.length === 0;
                    const isInfoFlow = (conversation.tags || []).includes('solicito-info');
                    
                    if (isTerminal && isInfoFlow && conversation.state !== 'paused') {
                        await randomDelay(1500, 500);
                        const farewellMsg = "¡Esperamos que esta información te sea de gran utilidad! 😊\n\nSi tenés alguna otra duda, podés escribir *M* para volver al menú o simplemente aguardar a que un integrante del equipo te contacte a la brevedad. ¡Que tengas un excelente día! 🙏";
                        console.log(`[TRACE][${conversation._id}] 👋 Sending remarketing closure msg.`);
                        await chat.sendMessage(farewellMsg);
                    }

                    // --- TERMINAL PAUSE ---
                    // If this step just paused the conversation, we stop processing AFTER sending the message.
                    if (conversation.state === 'paused') {
                        console.log(`[TRACE][${conversation._id}] 🛑 Terminal message sent. Bot now entering SILENCE.`);
                        return;
                    }
                } catch (error) {
                    console.error('[ERROR] Failed to send message:', error);
                    // Rollback state if sending failed so it can retry
                    await Conversation.updateOne({ _id: conversation._id }, { $set: { "loopDetection.messagesInCurrentStep": 0 } });
                }
                break;
            }

            // Evaluation (Process Input)
            const options = currentStep.options || [];
            const matchedOpt = findMatchingOption(input, options);
            if (matchedOpt) {
                console.log(`[TRACE][${conversation._id}] ✅ Option Matched! Input="${input}" -> Option "${matchedOpt.option.key}: ${matchedOpt.option.label}" (Index ${matchedOpt.index})`);
                targetOption = matchedOpt.option;
            }

            // If match found, break loop to handle transition below
            if (targetOption) {
                break;
            }

            // --- CAPTURE MODE CHECK ---
            // If the step has NO options but HAS a nextStepId, it's a data-capture step.
            // Any input is accepted and moves to the next step.
            if (options.length === 0 && currentStep.nextStepId) {
                console.log(`[TRACE] 📝 Capture step detected: ${currentStep.id}. Input recognized: "${input}"`);
                targetOption = {
                    nextStepId: currentStep.nextStepId,
                    label: 'Capture: ' + input.substring(0, 10)
                };
                break;
            }

            // If NO match found, handle fallback inside the loop or break
            // We need to break to let the fallback logic AFTER the loop run?
            // Actually, the structure assumes we handle logic *inside* or *after*?
            // Existing logic had fallback inside.

            // Let's rely on the code AFTER the while loop to handle the transition if targetOption is set.
            // If targetOption is NOT set, we do fallback here.

            // --- SMART FALLBACK ---
            const text = input.toLowerCase();

            // Strict handoff: Only explicit calls for help
            const HANDOFF_KEYWORDS = ['ayuda', 'humano', 'asesor', 'persona'];
            const isHandoffRequest = HANDOFF_KEYWORDS.some(k => text.includes(k));

            if (isHandoffRequest) {
                console.log(`[TRACE] 👤 Handoff Requested: Input "${input}" contains help keyword.`);
                await Conversation.updateOne(
                    { _id: conversation._id },
                    {
                        $addToSet: { tags: 'intervencion-humana' }
                    }
                );
                const chat = await getSafeChat(client, msg, contact.phone);
                await chat.sendMessage("👍 Recibido. Un asesor humano revisará tu mensaje y te responderá a la brevedad.");
                return;
            }

            // Standard Fallback logic with configurable lockout
            console.log(`[TRACE] ⚠️ Invalid Option: ${input}`);

            const newCount = (conversation.loopDetection.messagesInCurrentStep || 0) + 1;
            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $set: { "loopDetection.messagesInCurrentStep": newCount }
                }
            );
            conversation.loopDetection.messagesInCurrentStep = newCount;

            const maxAttempts = (flow && flow.published && flow.published.fallbackMaxAttempts) || 5;
            const chat = await getSafeChat(client, msg, contact.phone);

            if (newCount >= maxAttempts) {
                // LOCKOUT: Too many failed attempts
                const lockoutMsg = (flow && flow.published && flow.published.msgFallbackLockout)
                    || 'Intentaste demasiadas veces. Cuando estés listo, escribí *M* para volver al menú o *V* para volver atrás.';
                console.log(`[TRACE] 🔒 Lockout triggered for ${contact.phone} after ${newCount} attempts.`);
                await Conversation.updateOne(
                    { _id: conversation._id },
                    { $addToSet: { tags: 'fallback-lockout' } }
                );
                await chat.sendMessage(lockoutMsg);
                return;
            }

            // Normal fallback (editable from flow settings)
            let fallbackMsg = (flow && flow.published && flow.published.msgFallback)
                || "No comprendí tu mensaje. Si deseás ser atendido por un asesor, por favor aguardá a ser contactado. \n\nCaso contrario, podés usar:\n🔹 *V:* Volver atrás\n🔹 *M:* Menú principal";

            await chat.sendMessage(fallbackMsg);
            return;
        }

        // 3. MATCH OR FALLBACK
        if (targetOption) {
            console.log(`[TRACE][${conversation._id}] ✅ Option Matched: ${targetOption.label} -> ${targetOption.nextStepId}`);
            // Atomic state update for transition
            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $push: { history: conversation.currentStepId }, // SAVE CURRENT STEP TO HISTORY
                    $set: {
                        currentStepId: targetOption.nextStepId,
                        "loopDetection.messagesInCurrentStep": 0,
                        "loopDetection.lastStepChangeAt": new Date()
                    },
                    $inc: { __v: 1 }
                }
            );

            // Sync memory object before recursion to prevent infinite looping on the old step
            if (!conversation.history) conversation.history = [];
            conversation.history.push(conversation.currentStepId);
            conversation.currentStepId = targetOption.nextStepId;
            conversation.loopDetection.messagesInCurrentStep = 0;
            conversation.loopDetection.currentStepId = targetOption.nextStepId;

            // Recursive next step - P3.1: If the NEW step is a capture step, trigger form logic directly
            const steps = flow?.published?.steps;
            const nextStep = (typeof steps.get === 'function') ? steps.get(targetOption.nextStepId) : steps[targetOption.nextStepId];
            
            if (nextStep?.actions?.collectLeadData && (!contact.name || !contact.email)) {
                console.log(`[TRACE] 📋 Next step ${nextStep.id} requires capture. Triggering form immediately.`);
                const namePrompt = nextStep.actions?.leadDataNamePrompt || '¡Perfecto! Antes de continuar necesito un par de datos 😊\n\n¿Cuál es tu *nombre y apellido*?';
                const chat = await getSafeChat(client, msg, contact.phone);
                
                await Conversation.updateOne({ _id: conversation._id }, {
                    $set: {
                        'formState.active': true,
                        'formState.pendingStepId': nextStep.id,
                        'formState.currentField': 'name',
                        'formState.name': '',
                        'formState.email': '',
                        'formState.attempts': 0,
                    }
                });
                await sendTyping(chat);
                await randomDelay(600, 300);
                await chat.sendMessage(namePrompt);
                return;
            }

            await handleStepLogic(client, msg, conversation, flow, contact); // Recursive next step
            return;
        }
    } // End of handleStepLogic

    // Start client initialization
    await client.initialize();
} // End of startBot

// --- AUTOMATIC WATCHDOG & SELF-HEALING ENGINE ---
let isRecovering = false;

const autoRecoverBot = async (reason) => {
    if (isRecovering) return;
    isRecovering = true;
    console.log(`[WATCHDOG] 🔄 Auto-recovering bot runner (Reason: ${reason})...`);

    try {
        botState = 'connecting';
        if (client) {
            try {
                await client.destroy();
            } catch (e) {
                console.warn('[WATCHDOG] Error destroying client:', e.message);
            }
            client = null;
        }

        await new Promise(r => setTimeout(r, 3000));

        // Re-start bot preserving saved session
        await startBot(false);
        console.log('[WATCHDOG] ✅ Auto-recovery restart triggered successfully.');
    } catch (err) {
        console.error('[WATCHDOG] ❌ Auto-recovery failed:', err.message);
        botState = 'disconnected';
    } finally {
        isRecovering = false;
    }
};

const runWatchdogCheck = async () => {
    if (isRecovering) return;

    const sessionName = process.env.SESSION_NAME || '.wwebjs_auth';
    const authPath = path.join(process.cwd(), sessionName);

    // 1. If state claims connected, verify Puppeteer & WhatsApp page responsiveness
    if (botState === 'connected' && client) {
        let isAlive = false;
        try {
            const statePromise = client.getState();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Health state check timeout')), 10000)
            );

            const state = await Promise.race([statePromise, timeoutPromise]);
            if (state === 'CONNECTED' || state === 'PAIRING') {
                isAlive = true;
            }
        } catch (err) {
            console.warn('[WATCHDOG] ⚠️ Health check ping failed:', err.message);
            isAlive = false;
        }

        if (!isAlive) {
            console.error('[WATCHDOG] 🚨 Bot is FROZEN or UNRESPONSIVE! Initiating self-healing restart...');
            await autoRecoverBot('frozen_unresponsive');
        }
    } else if (botState === 'disconnected' && fs.existsSync(authPath)) {
        // Auto-reconnect if session exists but state is disconnected
        console.log('[WATCHDOG] ⚡ Disconnected state with valid session detected. Re-triggering bot...');
        await autoRecoverBot('disconnected_state_recovery');
    }
};

// Run watchdog health check every 2 minutes
setInterval(runWatchdogCheck, 2 * 60 * 1000);

// Format message with options and dynamic variables
function formatMessage(step, flow) {
    let messageBody = step.message;

    if (messageBody.includes('{PROXIMOS_DIAS}')) {
        const nextDays = getNextBookingDays(7);
        let daysList = '';
        nextDays.forEach((d, i) => { daysList += `${String.fromCharCode(65 + i)}) ${d.label}\n`; });
        messageBody = messageBody.replace('{PROXIMOS_DIAS}', daysList.trim());
        return messageBody;
    }

    let msg = messageBody + '\n\n';
    if (step.options && step.options.length > 0) {
        step.options.forEach(opt => { msg += `${opt.key}) ${opt.label}\n`; });
    }

    // Navigation Labels (V/M)
    const hasPauseAction = step.actions && (step.actions.pauseConversation === true || step.actions.pauseConversation === 'true');
    const isHandoff = hasPauseAction || PAUSE_STEP_IDS.includes(step.id);

    console.log(`[DEBUG] formatMessage: Step=${step.id}, isHandoff=${isHandoff}, hasPauseAction=${hasPauseAction}, Actions=${JSON.stringify(step.actions || {})}`);

    // Navigation Labels (V/M) — only if step has showNavigation enabled (default: true)
    if (flow && flow.published && step.showNavigation !== false) {
        const defaultNavMenu = '🔹 *V:* Volver atrás\n🔹 *M:* Menú principal';
        const defaultNavBack = '_(Si te equivocaste, escribí *V* para volver)_';

        if (step.id !== flow.published.entryStepId) {
            msg += '\n\n' + (flow.published.msgNavigationMenu || defaultNavMenu);
        } else {
            msg += '\n\n' + (flow.published.msgNavigationBack || defaultNavBack);
        }
    }

    return msg.trim();
}

// Generate next X booking days (excluding Sundays by default)
function getNextBookingDays(count = 7) {
    const days = [];
    const date = new Date();
    date.setDate(date.getDate() + 1); // Start from tomorrow

    while (days.length < count) {
        if (date.getDay() !== 0) { // Skip Sundays
            const label = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' });
            days.push({
                label: label.charAt(0).toUpperCase() + label.slice(1),
                date: new Date(date)
            });
        }
        date.setDate(date.getDate() + 1);
    }
    return days;
}

// Select flow based on rules
async function selectFlow({ isAgendado, source, forceOnly = false, body = '', phone = '' }) {
    console.log(`[DEBUG] Finding flow for: Source=${source}, Agendado=${isAgendado}, ForceOnly=${forceOnly}, Body="${body}"`);

    // DEBUG: Dump ALL flows to see what we have
    const allFlows = await Flow.find({});
    // console.log(`[DEBUG-CRITICAL] Total Documents in 'flows' collection: ${allFlows.length}`);

    const flows = await Flow.find({ isActive: true, published: { $ne: null } });
    // console.log(`[DEBUG] Found ${flows.length} ACTIVE & PUBLISHED flows.`);

    // Activation keywords (hardcoded for now to prevent infinite loops)
    // 'v' and 'volver' intentionally removed: they use history-based back-navigation, NOT full restart.
    // Only 'm' / 'menu' trigger a full restart to the main menu.
    const RESTART_KEYWORDS = ['hola', 'menu', 'inicio', 'empezar', 'reset', 'm'];

    // Filter by activation rules
    const matchingFlows = flows.filter(flow => {
        const rules = flow.activationRules;
        if (!rules) return false;

        const isVIP = phone === '5491144118569' || phone === '5491136753434';

        // Check source
        const sourceMatch = isVIP || (source === 'meta_ads' && rules.sources.meta_ads) ||
            (source === 'organic' && rules.sources.organic);

        // Check WhatsApp status
        const statusMatch = isVIP || (isAgendado && rules.whatsappStatus.agendado) ||
            (!isAgendado && rules.whatsappStatus.no_agendado);

        // Check forceRestart if forceOnly is requested
        if (forceOnly) {
            // If it's not a VIP, the flow must have forceRestart enabled
            if (!rules.forceRestart && !isVIP) return false;

            // CRITICAL FIX: Only allow force restart if message matches a keyword
            // This prevents "Every message restarts the flow" loops.
            const cleanBody = body.trim().toLowerCase();
            const isKeyword = RESTART_KEYWORDS.some(k => cleanBody === k || cleanBody.startsWith(k + ' '));

            if (!isKeyword) {
                console.log(`[DEBUG] Force restart ignored for "${flow.name}" - message "${cleanBody}" is not a keyword.`);
                return false;
            }
        }

        return sourceMatch && statusMatch;
    });

    if (matchingFlows.length === 0) {
        console.log('[DEBUG] No matching flows found after filtering.');
        return null;
    }

    // Sort by priority (highest first)
    matchingFlows.sort((a, b) => (b.activationRules?.priority || 0) - (a.activationRules?.priority || 0));
    console.log(`[DEBUG] Selected flow: "${matchingFlows[0].name}" (Priority ${matchingFlows[0].activationRules?.priority})`);

    return matchingFlows[0];
}

// Check if current time is within business hours
function isWithinBusinessHours(schedule) {
    if (!schedule) return true;

    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[now.getDay()];
    const dayConfig = schedule[currentDay];

    if (!dayConfig || !dayConfig.active) {
        return false;
    }

    const [openH, openM] = dayConfig.open.split(':').map(Number);
    const [closeH, closeM] = dayConfig.close.split(':').map(Number);

    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const openTimeMinutes = openH * 60 + openM;
    const closeTimeMinutes = closeH * 60 + closeM;

    return currentTimeMinutes >= openTimeMinutes && currentTimeMinutes <= closeTimeMinutes;
}

// Helper to sync WhatsApp Business Labels
async function syncWhatsAppLabel(chat, labelName) {
    try {
        if (!client.info || !client.info.isBusiness) return;

        const labels = await client.getLabels();
        let targetLabel = labels.find(l => l.name === labelName);

        if (!targetLabel) {
            console.log(`[TRACE] 🏷️ Label "${labelName}" not found in WhatsApp Business.`);
            return;
        }

        const chatLabels = await chat.getLabels();
        const statusLabels = ['BOT', 'Derivado con Personal'];

        for (const cl of chatLabels) {
            if (statusLabels.includes(cl.name) && cl.name !== labelName) {
                await chat.removeLabel(cl.id);
            }
        }

        if (!chatLabels.find(cl => cl.id === targetLabel.id)) {
            await chat.addLabel(targetLabel.id);
            console.log(`[TRACE] 🏷️ Applied label "${labelName}" to chat ${chat.id.user}`);
        }
    } catch (err) {
        console.error(`[ERROR] Failed to sync labels for ${chat.id.user}:`, err);
    }
}

// Auto-handoff function
async function triggerAutoHandoff(conversation, contact, currentStep) {
    if (conversation.state === 'paused') return; // Don't trigger twice

    console.log(`[TRACE] 👤 AUTO-HANDOFF triggered for ${conversation.phone}`);
    await Conversation.updateOne(
        { _id: conversation._id },
        {
            $set: { state: 'paused' },
            $addToSet: { tags: 'auto-handoff' }
        }
    );
    conversation.state = 'paused';

    // Send message to user
    const chat = await client.getChatById(conversation.phone + '@c.us');
    await chat.sendMessage('Un asesor te atenderá en breve. Gracias por tu paciencia. 👤');

    // WhatsApp Labels Sync
    await syncWhatsAppLabel(chat, 'Derivado con Personal');

    // Send notification to bot itself (admin will see it)
    const botNumber = client.info.wid.user;
    const notificationMsg = `🚨 DERIVACIÓN AUTOMÁTICA\n\nContacto: ${conversation.phone}\nNombre: ${contact.name || 'N/A'}\nRazón: Loop detectado (6+ mensajes sin avance)\nÚltimo paso: ${currentStep.title}\n\nRevisar conversación en el panel de admin.`;

    try {
        await client.sendMessage(botNumber + '@c.us', notificationMsg);
    } catch (e) {
        console.error('Error sending self-notification:', e);
    }

    console.log('Auto-handoff triggered for:', conversation.phone);
}

const lidResolutionMemoryCache = new Map();

// Helper to resolve LID to real JID with in-memory caching & timeout protection
async function resolveLidToPhone(client, sourceId) {
    if (!sourceId || !sourceId.includes('@lid')) return sourceId;
    
    // 0. Check in-memory cache first (0ms latency, zero Puppeteer / DB calls)
    if (lidResolutionMemoryCache.has(sourceId)) {
        return lidResolutionMemoryCache.get(sourceId);
    }

    // Helper: Wrap promise with a strict timeout (2500ms) to ensure pupPage NEVER blocks message handler
    const withTimeout = (promise, ms = 2500) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('LID resolution timeout')), ms))
        ]);
    };

    let resolvedJid = null;

    // 1. Try enforceLidAndPnRetrieval in page context with 2.5s timeout
    try {
        resolvedJid = await withTimeout(client.pupPage.evaluate(async (lid) => {
            try {
                if (window.WWebJS && window.WWebJS.enforceLidAndPnRetrieval) {
                    const res = await window.WWebJS.enforceLidAndPnRetrieval(lid);
                    if (res && res.phone && res.phone._serialized) {
                        return res.phone._serialized;
                    }
                }
            } catch (err) {}
            return null;
        }, sourceId));
    } catch (e) { }

    // 2. Try LidUtils if step 1 failed
    if (!resolvedJid) {
        try {
            resolvedJid = await withTimeout(client.pupPage.evaluate((lid) => {
                try {
                    if (window.Store && window.Store.WidFactory && window.Store.LidUtils) {
                        const wid = window.Store.WidFactory.createWid(lid);
                        const pnWid = window.Store.LidUtils.getPhoneNumber(wid);
                        if (pnWid && pnWid._serialized) {
                            return pnWid._serialized;
                        }
                    }
                } catch (err) {}
                return null;
            }, sourceId));
        } catch (e) { }
    }

    // 3. Try getContactById as fallback
    if (!resolvedJid) {
        try {
            const wppContact = await withTimeout(client.getContactById(sourceId));
            if (wppContact && wppContact.id && wppContact.id._serialized && wppContact.id._serialized.endsWith('@c.us')) {
                resolvedJid = wppContact.id._serialized;
            } else if (wppContact && wppContact.number && wppContact.number.length <= 13) {
                resolvedJid = wppContact.number + '@c.us';
            }
        } catch (e) { }
    }

    const finalResult = resolvedJid || sourceId;

    // Cache the result (if resolved to phone) to eliminate future lookups
    if (finalResult && finalResult.endsWith('@c.us')) {
        lidResolutionMemoryCache.set(sourceId, finalResult);
        console.log(`[TRACE] 💡 Cached LID resolution: ${sourceId} -> ${finalResult}`);
    }

    return finalResult;
}

// Background database migration script to resolve historical LID records
async function runLidMigration(client) {
    console.log('[MIGRATION] Starting database LID-to-Phone migration...');
    try {
        const contacts = await Contact.find({});
        console.log(`[MIGRATION] Scanning ${contacts.length} database contacts...`);
        let migratedCount = 0;

        for (const c of contacts) {
            const phone = c.phone || '';
            const isLid = (phone.includes('@lid') || (/^\d+$/.test(phone) && phone.length >= 14)) && !phone.includes('@newsletter');
            if (!isLid) continue;

            console.log(`[MIGRATION] Found LID contact: phone=${phone}, name=${c.name}`);
            const lidJid = phone.includes('@lid') ? phone : `${phone}@lid`;
            let realPhone = null;

            // 1. Try enforceLidAndPnRetrieval first in page context (queries server if not cached)
            try {
                const resolvedJid = await client.pupPage.evaluate(async (lid) => {
                    try {
                        if (window.WWebJS && window.WWebJS.enforceLidAndPnRetrieval) {
                            const res = await window.WWebJS.enforceLidAndPnRetrieval(lid);
                            if (res && res.phone && res.phone._serialized) {
                                return res.phone._serialized;
                            }
                        }
                    } catch (err) {}
                    return null;
                }, lidJid);

                if (resolvedJid) {
                    realPhone = resolvedJid.replace('@c.us', '');
                }
            } catch (err) {
                console.log(`[MIGRATION] enforceLidAndPnRetrieval failed for ${lidJid}:`, err.message);
            }

            // 2. Try LidUtils next in page context (local cache fallback)
            if (!realPhone) {
                try {
                    const resolvedJid = await client.pupPage.evaluate((lid) => {
                        try {
                            if (window.Store && window.Store.WidFactory && window.Store.LidUtils) {
                                const wid = window.Store.WidFactory.createWid(lid);
                                const pnWid = window.Store.LidUtils.getPhoneNumber(wid);
                                if (pnWid && pnWid._serialized) {
                                    return pnWid._serialized;
                                }
                            }
                        } catch (err) {}
                        return null;
                    }, lidJid);

                    if (resolvedJid) {
                        realPhone = resolvedJid.replace('@c.us', '');
                    }
                } catch (err) {
                    console.log(`[MIGRATION] LidUtils resolution failed for ${lidJid}:`, err.message);
                }
            }

            // 3. Try getContactLidAndPhone
            if (!realPhone) {
                try {
                    if (typeof client.getContactLidAndPhone === 'function') {
                        const mapping = await client.getContactLidAndPhone(lidJid);
                        if (mapping && mapping[0] && mapping[0].pn) {
                            realPhone = mapping[0].pn.replace('@c.us', '');
                        }
                    }
                } catch (err) {
                    console.log(`[MIGRATION] getContactLidAndPhone failed for ${lidJid}:`, err.message);
                }
            }

            // 4. Fallback: getContactById JID check
            if (!realPhone) {
                try {
                    const wppContact = await client.getContactById(lidJid);
                    if (wppContact && wppContact.id && wppContact.id._serialized && wppContact.id._serialized.endsWith('@c.us')) {
                        realPhone = wppContact.id._serialized.replace('@c.us', '');
                    } else if (wppContact && wppContact.number && wppContact.number.length <= 13) {
                        realPhone = wppContact.number;
                    }
                } catch (err) {
                    console.log(`[MIGRATION] Fallback getContactById failed for ${lidJid}:`, err.message);
                }
            }

            if (!realPhone) {
                console.log(`[MIGRATION] ⚠️ Could not resolve real phone number for ${phone}`);
                continue;
            }

            console.log(`[MIGRATION] ✅ Resolved LID ${phone} to Phone Number: ${realPhone}`);

            const oldPhone = c.phone;

            // 1. Merge or update contact
            const existingContact = await Contact.findOne({ phone: realPhone });
            if (existingContact) {
                console.log(`[MIGRATION] Merge contact: ${oldPhone} into existing ${realPhone}`);
                if (c.tags && c.tags.length > 0) {
                    const mergedTags = Array.from(new Set([...(existingContact.tags || []), ...c.tags]));
                    existingContact.tags = mergedTags;
                }
                if (c.name && (!existingContact.name || existingContact.name === existingContact.pushname)) {
                    existingContact.name = c.name;
                }
                if (c.events && c.events.length > 0) {
                    existingContact.events = [...(existingContact.events || []), ...c.events];
                }
                await existingContact.save();
                await Contact.deleteOne({ _id: c._id });
            } else {
                console.log(`[MIGRATION] Update contact phone: ${oldPhone} -> ${realPhone}`);
                c.phone = realPhone;
                // Clean @lid from name if it matches phone
                if (c.name && c.name.includes('@lid')) {
                    c.name = '';
                }
                await c.save();
            }

            // 2. Update Conversations
            const convs = await Conversation.find({ phone: oldPhone });
            for (const conv of convs) {
                const existingConv = await Conversation.findOne({ phone: realPhone, state: conv.state });
                if (existingConv) {
                    console.log(`[MIGRATION] Delete duplicate conversation for ${realPhone}`);
                    await Conversation.deleteOne({ _id: conv._id });
                } else {
                    console.log(`[MIGRATION] Update conversation phone: ${oldPhone} -> ${realPhone}`);
                    conv.phone = realPhone;
                    await conv.save();
                }
            }

            // 3. Update Messages
            console.log(`[MIGRATION] Update messages for phone: ${oldPhone} -> ${realPhone}`);
            await Message.updateMany({ phone: oldPhone }, { $set: { phone: realPhone } });

            migratedCount++;
        }

        console.log(`[MIGRATION] Database LID-to-Phone migration finished. Total migrated: ${migratedCount}`);
    } catch (error) {
        console.error('[MIGRATION] Fatal migration error:', error);
    }
}

// Start Express server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Bot API running on port ${PORT}`);
    console.log('Bot state:', botState);

    // Auto-start bot on container boot if saved session exists
    const sessionName = process.env.SESSION_NAME || '.wwebjs_auth';
    const authPath = path.join(process.cwd(), sessionName);
    if (fs.existsSync(authPath)) {
        console.log('[BOOT] 🚀 Existing WhatsApp session found. Auto-starting bot...');
        startBot(false).catch(err => {
            console.error('[BOOT] Error auto-starting bot:', err);
        });
    } else {
        console.log('To start bot, go to the admin panel → WhatsApp → Activar Bot');
    }
});
