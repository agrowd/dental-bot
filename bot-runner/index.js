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
    if (botState === 'connected') {
        return res.json({ status: 'already_connected' });
    }

    if (botState === 'connecting') {
        return res.json({ status: 'already_connecting' });
    }

    // Check cooldown (2 minutes between retries)
    const now = Date.now();
    const cooldownMs = 2 * 60 * 1000;
    if (lastRetryTime && (now - lastRetryTime) < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastRetryTime)) / 1000);
        return res.status(429).json({ error: `Cooldown active. Wait ${remaining}s` });
    }

    // Check retry limit (3 per hour)
    if (retryCount >= 5) {
        return res.status(429).json({ error: 'Max retries exceeded. Wait 1 hour.' });
    }

    try {
        await startBot();
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

// POST /bot/force-start
app.post('/bot/force-start', async (req, res) => {
    try {
        if (!client || botState !== 'connected') {
            return res.status(400).json({ error: 'El bot no está conectado a WhatsApp.' });
        }

        let { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Número de teléfono requerido.' });

        const cleanPhone = phone.replace(/\D/g, '');
        const chatId = `${cleanPhone}@c.us`;

        const flow = await Flow.findOne({ isActive: true, "published": { $ne: null } }).sort({ "activationRules.priority": -1 });
        if (!flow || !flow.published || !flow.published.steps) {
            return res.status(400).json({ error: 'No hay un flujo activo configurado.' });
        }

        await Conversation.updateMany({ phone: cleanPhone, state: { $in: ['active', 'paused'] } }, { $set: { state: 'closed' } });

        let contact = await Contact.findOne({ phone: cleanPhone });
        if (!contact) {
            await Contact.create({
                phone: cleanPhone,
                status: 'pendiente',
                source: 'organic',
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                tags: ['forced-start'],
                meta: {}
            });
        }

        const conversation = await Conversation.create({
            phone: cleanPhone,
            flowId: flow._id,
            flowVersion: flow.publishedVersion,
            currentStepId: flow.published.entryStepId,
            state: 'active',
            tags: ['forced-start'],
            loopDetection: {
                currentStepId: flow.published.entryStepId,
                messagesInCurrentStep: 1, // SET TO 1 SO NEXT REPLY DOES NOT RESEND THE WELCOME TEXT
                lastStepChangeAt: new Date()
            }
        });

        const steps = flow.published.steps;
        const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];
        const firstStep = getStep(flow.published.entryStepId);

        if (!firstStep) {
            return res.status(400).json({ error: 'El flujo activo está roto (Falta paso inicial).' });
        }

        const msgText = formatMessage(firstStep, flow);
        await client.sendMessage(chatId, msgText);

        console.log(`[FORCE START] 🚀 Bot manually injected for ${cleanPhone}`);

        res.json({ success: true, message: 'Bot iniciado exitosamente.' });
    } catch (error) {
        console.error('[FORCE START ERROR]', error);
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

// Start WhatsApp client
async function startBot() {
    botState = 'connecting';
    currentQR = null;

    // CLEANUP: Nuclear cleanup of session directory to prevent "Code: 21"
    const sessionName = process.env.SESSION_NAME || '.wwebjs_auth';
    const authPath = path.join(process.cwd(), sessionName);

    try {
        if (fs.existsSync(authPath)) {
            console.log(`[INIT] Removing existing session directory: ${sessionName}...`);
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('[INIT] Session directory removed.');
        }
    } catch (e) {
        console.warn('[INIT] Warning during cleanup:', e.message);
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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
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
    });

    client.on('loading_screen', (percent, message) => {
        console.log('[INIT] LOADING SCREEN', percent, message);
    });

    // Ready handler
    client.on('ready', () => {
        console.log('✅ WhatsApp bot is ready!');
        botState = 'connected';
        currentQR = null;
        sessionStartTime = new Date(); // Record activation time
        if (qrTimeout) clearTimeout(qrTimeout);
    });

    // Disconnected handler
    client.on('disconnected', (reason) => {
        console.log('Bot disconnected:', reason);
        botState = 'disconnected';
        currentQR = null;
    });

    // Heartbeat log to confirm process is alive
    setInterval(() => {
        console.log(`[HEARTBEAT] Bot runner alive. State: ${botState}. Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    }, 20 * 60 * 1000); // Every 20 minutes

    // Call Handler (New Implementation)
    client.on('call', async (call) => {
        console.log('[TRACE] 📞 Incoming call from:', call.from);
        try {
            const phone = call.from.replace('@c.us', '');

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
            if (sourceId.includes('@lid')) {
                try {
                    const wppContact = await client.getContactById(sourceId);
                    if (wppContact && wppContact.number) sourceId = wppContact.number;
                } catch (e) { }
            }
            const phone = sourceId.replace('@c.us', '').replace('@lid', '');

            await Message.create({
                phone,
                direction: msg.fromMe ? 'out' : 'in',
                text: msg.body || (msg.hasMedia ? '[Archivo Multimedia]' : ''),
                timestamp: new Date(msg.timestamp * 1000)
            });
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
        if (sourceId.includes('@lid')) {
            try {
                const wppContact = await client.getContactById(sourceId);
                if (wppContact && wppContact.number) sourceId = wppContact.number;
            } catch (e) { }
        }
        const phone = sourceId.replace('@c.us', '').replace('@lid', '');

        const lockKey = `lock_phone_${phone}`;
        const releaseLock = async () => {
            await Setting.deleteOne({ key: lockKey }).catch(() => { });
        };
        let lockTimeout;

        try {
            // 1. ATOMIC CROSS-INSTANCE LOCK BY PHONE
            try {
                await Setting.create({ key: lockKey, instance: INSTANCE_ID, at: new Date() });
            } catch (err) {
                if (err.code === 11000) {
                    console.log(`[TRACE][${INSTANCE_ID}] 🔒 Phone ${phone} is BUSY. Skipping parallel processing.`);
                    return;
                }
                throw err;
            }

            lockTimeout = setTimeout(releaseLock, 30000);

            // SILENT FILTERS
            if (msg.from === 'status@broadcast') { await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout); return; }
            if (msg.from.endsWith('@g.us')) { await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout); return; }

            const sender = msg.from;
            const body = msg.body;
            console.log(`[TRACE][${INSTANCE_ID}] 📨 PROCESSING: "${body}" from ${sender}`);

            // 2. SESSION TIME FILTER
            const msgDate = new Date(msg.timestamp * 1000);
            let safetyThreshold = sessionStartTime;
            try {
                const safetySetting = await Setting.findOne({ key: 'bot_safety' });
                if (safetySetting && safetySetting.value && safetySetting.value.activationOffset) {
                    const offsetMs = safetySetting.value.activationOffset * 60 * 1000;
                    safetyThreshold = new Date(sessionStartTime.getTime() - offsetMs);
                }
            } catch (e) {
                console.error('[ERROR] Could not fetch safety settings.');
            }

            if (sessionStartTime && msgDate < safetyThreshold) {
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            console.log(`[TRACE] 📨 RAW MESSAGE from ${sender}: "${body}"`);

            // --- NAVIGATION INTERCEPTOR (V/M) ---
            const inputRaw = (body || '').trim().toLowerCase();
            const isNav = inputRaw === 'm' || inputRaw === 'v' || inputRaw === 'menu' || inputRaw === 'atras' || inputRaw.includes('menu principal') || inputRaw.includes('volver');

            if (isNav) {
                console.log(`[TRACE] 🔓 Universal Navigation command detected from ${phone}: "${inputRaw}"`);
                // If there's an existing conversation, unpause it in DB
                await Conversation.updateMany({ phone, state: { $in: ['active', 'paused'] } }, { $set: { state: 'active' } });
            }

            // 3. CONTACT & CONVERSATION
            let contact = await Contact.findOne({ phone });
            if (!contact) {
                contact = await Contact.create({
                    phone, status: 'pendiente', source: 'organic',
                    firstSeenAt: new Date(), lastSeenAt: new Date(), tags: [], meta: {}
                });
            } else {
                await Contact.updateOne({ _id: contact._id }, { $set: { lastSeenAt: new Date() } });
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
                const chat = await msg.getChat();
                await chat.sendMessage('🔄 Conversación reiniciada.');
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            if (!conversation) {
                const chatContact = await msg.getContact();
                let selectedFlow = await selectFlow({ isAgendado: chatContact.isMyContact, source: contact.source, phone });

                // FIX 1: FALLBACK FOR USERS WITH NO MATCHING FLOW RULE
                // If no flow rule matches (e.g. user wrote a sentence, not a keyword),
                // use the highest-priority active published flow as the default entry point.
                if (!selectedFlow) {
                    selectedFlow = await Flow.findOne({ isActive: true, published: { $ne: null } }).sort({ 'activationRules.priority': -1 });
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
                const chatContact = await msg.getContact();
                const forcingFlow = await selectFlow({ isAgendado: chatContact.isMyContact, source: contact.source, forceOnly: true, body: msg.body, phone });

                if (forcingFlow) {
                    // SILENCE CHECK: Usually we ignore automation when paused.
                    // BUT: If the user sends a FORCE RESTART keyword (like V, M, or Hola), we allow it to "break" the pause.
                    if (conversation.state === 'paused') {
                        console.log(`[TRACE] 🔓 Force restart keyword detected! Unpausing conversation for ${phone}`);
                        // Don't return here, continue with the restart logic below
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

            // 🔓 ALLOW ESCAPE FROM PAUSE (Emergency Nav Commands)
            const cleanBody = (msg.body || '').trim().toLowerCase();
            const isEmergencyNav = cleanBody === 'v' || cleanBody === 'm' || cleanBody === 'volver' || cleanBody === 'menu' || cleanBody === 'atras' || cleanBody.includes('menu principal');

            if (conversation.state === 'paused' && isEmergencyNav) {
                console.log(`[TRACE] 🔓 Emergency Escape Command executed by ${phone}. Unpausing!`);
                conversation.state = 'active';
                await Conversation.updateOne(
                    { _id: conversation._id },
                    { $set: { state: 'active' } }
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
                            const chat = await msg.getChat();
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

                const chatContact = await msg.getContact();
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
                const chat = await msg.getChat();

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
                const chat = await msg.getChat();

                // Allow V/M to cancel the form
                const formInputLow = formInput.toLowerCase();
                if (formInputLow === 'v' || formInputLow === 'm' || formInputLow === 'menu' || formInputLow === 'volver') {
                    await Conversation.updateOne({ _id: conversation._id }, { $set: { 'formState.active': false } });
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
                            await handleStepLogic(client, msg, conversation, flow, contact);
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
                    await handleStepLogic(client, msg, conversation, flow, contact);
                    if (lockTimeout) clearTimeout(lockTimeout);
                    await releaseLock();
                    return;
                }
            }

            // --- LEAD CAPTURE FORM TRIGGER ---
            // Trigger the form if the user selected an option that leads to a step with `collectLeadData: true`
            const nextStepForCapture = (() => {
                const steps = flow?.published?.steps;
                if (!steps || !conversation.currentStepId) return null;
                const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];
                const currentStep = getStep(conversation.currentStepId);
                if (!currentStep) return null;

                const input = (msg.body || '').trim().toLowerCase();
                for (const opt of (currentStep.options || [])) {
                    const key = (opt.key || '').toLowerCase();
                    const label = (opt.label || '').toLowerCase();
                    if (input === key || input === label || (input.length > 3 && label.includes(input))) {
                        const targetStep = getStep(opt.nextStepId);
                        if (targetStep && targetStep.actions?.collectLeadData) {
                            return { id: opt.nextStepId, step: targetStep };
                        }
                    }
                }
                return null;
            })();

            if (nextStepForCapture && (!contact.name || !contact.email)) {
                const chat = await msg.getChat();
                const namePrompt = nextStepForCapture.step.actions?.leadDataNamePrompt || '¡Perfecto! Antes de continuar necesito un par de datos 😊\n\n¿Cuál es tu *nombre y apellido*?';

                await Conversation.updateOne({ _id: conversation._id }, {
                    $set: {
                        'formState.active': true,
                        'formState.pendingStepId': nextStepForCapture.id,
                        'formState.currentField': 'name',
                        'formState.name': '',
                        'formState.email': '',
                        'formState.attempts': 0,
                    }
                });
                conversation.formState = { active: true, pendingStepId: nextStepForCapture.id, currentField: 'name', name: '', email: '', attempts: 0 };
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

                const input = (msg.body || '').trim().toLowerCase();
                for (const opt of (currentStep.options || [])) {
                    const key = (opt.key || '').toLowerCase();
                    const label = (opt.label || '').toLowerCase();
                    if (input === key || input === label || (input.length > 3 && label.includes(input))) {
                        const targetStep = getStep(opt.nextStepId);
                        if (targetStep && targetStep.actions?.collectFreeText) {
                            return { id: opt.nextStepId, step: targetStep };
                        }
                    }
                }
                return null;
            })();

            if (nextFreeTextStep) {
                const chat = await msg.getChat();
                const freeTextPrompt = nextFreeTextStep.step.actions?.freeTextPrompt
                    || '¡Entendido! Por favor desc ribi tu consulta y un integrante del equipo te responderá a la brevedad. 🙏';
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
        if (!isPaused && (input === 'm' || input === 'menu' || input.includes('menu principal'))) {
            console.log(`[TRACE] 🏠 Universal Menu requested by ${contact.phone}`);
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
            // Removed early return to allow immediate menu response
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
            // Removed early return to allow immediate back response
        }

        // 1.5a VOICE MESSAGE (PTT) DETECTION
        // Detect voice notes (Audio/PTT) and respond asking user to write text instead
        if (msg.type === 'ptt' || msg.type === 'audio') {
            console.log(`[TRACE] 🎤 Voice message (PTT) received from ${contact.phone}. Sending text request.`);
            const chat = await msg.getChat();
            await sendTyping(chat);
            await randomDelay(800, 400);

            const pttMsg = (flow && flow.published && flow.published.msgPttResponse)
                || '🎤 Por el momento no podemos recibir mensajes de voz. Por favor escribinos tu consulta en texto y te responderemos a la brevedad 🙏\n\n🔹 *M:* Menú principal';

            await chat.sendMessage(pttMsg);
            await Conversation.updateOne(
                { _id: conversation._id },
                { $addToSet: { tags: 'mensaje-de-voz' } }
            );
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
                const chat = await msg.getChat();
                await sendTyping(chat);
                await randomDelay(800, 400);
                await chat.sendMessage('No pude entender ese archivo. Escribí *M* para volver al menú principal o *V* para volver atrás.');
                await releaseLock(); if (lockTimeout) clearTimeout(lockTimeout);
                return;
            }

            await Conversation.updateOne(
                { _id: conversation._id },
                { $addToSet: { tags: 'pago-enviado' } }
            );

            const chat = await msg.getChat();
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
                    const chat = await msg.getChat();
                    await syncWhatsAppLabel(chat, 'Derivado con Personal');
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

                const response = formatMessage(currentStep, flow);
                const chat = await msg.getChat();

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

            for (const opt of options) {
                const key = (opt.key || '').toLowerCase();
                const label = (opt.label || '').toLowerCase();
                if (key === 'h' || label.includes('asesor')) {
                    console.log(`[TRACE][${conversation._id}] 🕵️ FOUND OPTION H IN EVALUATION: ${JSON.stringify(opt)}`);
                }
                if (input === key || input === label || (input.length > 3 && label.includes(input))) {
                    targetOption = opt;
                    break;
                }
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
                const chat = await msg.getChat();
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
            const chat = await msg.getChat();

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

            // Update local object for recursion
            conversation.currentStepId = targetOption.nextStepId;
            conversation.loopDetection.messagesInCurrentStep = 0;
            await handleStepLogic(client, msg, conversation, flow, contact); // Recursive next step
            return;
        }
    } // End of handleStepLogic

    await client.initialize();
    console.log('[INIT] Client initialized inside startBot');
} // End of startBot

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

// Start Express server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Bot API running on port ${PORT}`);
    console.log('Bot state:', botState);
    console.log('To start bot, go to the admin panel → WhatsApp → Activar Bot');
});
