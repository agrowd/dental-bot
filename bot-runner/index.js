const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ... (existing code)

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
    if (retryCount >= 3) {
        return res.status(429).json({ error: 'Max retries exceeded. Wait 1 hour.' });
    }

    try {
        await startBot();
        retryCount++;
        lastRetryTime = now;
        setTimeout(() => { retryCount = 0; }, 60 * 60 * 1000); // Reset after 1 hour

        res.json({ status: 'starting' });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
    }, 60000);

    // Call Handler (New Implementation)
    client.on('call', async (call) => {
        console.log('[TRACE] 📞 Incoming call from:', call.from);
        try {
            const phone = call.from.replace('@c.us', '');

            // VIP Whitelist: Only respond to Salvador for now
            const VIP_NUMBER = '5491144118569';
            if (phone !== VIP_NUMBER) {
                console.log(`[TRACE] ⛔ Call from NON-VIP number ${phone}. Ignoring due to whitelist.`);
                return;
            }

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
            const selectedFlow = await selectFlow({ isAgendado: false, source: dbContact.source });

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

    // Message handler
    client.on('message', async (msg) => {
        const messageId = msg.id._serialized;
        if (processedMessages.has(messageId)) return;
        processedMessages.add(messageId);

        try {
            // ATOMIC CROSS-INSTANCE LOCK
            const lockKey = `lock_${messageId}`;
            try {
                await Setting.create({ key: lockKey, instance: INSTANCE_ID, at: new Date() });
            } catch (err) {
                if (err.code === 11000) return; // Already locked
                throw err;
            }

            // Auto-cleanup lock after 30s
            setTimeout(() => { Setting.deleteOne({ key: lockKey }).catch(() => { }); }, 30000);

            // SILENT FILTERS
            if (msg.from === 'status@broadcast') return;
            if (msg.from.endsWith('@g.us')) return; // Ignore groups

            // Log with Instance ID AFTER initial filters
            const sender = msg.from;
            const body = msg.body;
            console.log(`[TRACE][${INSTANCE_ID}] 📨 PROCESSING: "${body}" from ${sender}`);

            const WHITELIST = ['5491144118569@c.us', '5491157351676@c.us'];
            if (!WHITELIST.includes(msg.from)) return;


            // 2. SESSION TIME FILTER (Ignore old unread messages)
            const msgDate = new Date(msg.timestamp * 1000);

            // Dynamic lookback check
            let safetyThreshold = sessionStartTime;
            try {
                const safetySetting = await Setting.findOne({ key: 'bot_safety' });
                if (safetySetting && safetySetting.value && safetySetting.value.activationOffset) {
                    const offsetMs = safetySetting.value.activationOffset * 60 * 1000;
                    safetyThreshold = new Date(sessionStartTime.getTime() - offsetMs);
                }
            } catch (e) {
                console.error('[ERROR] Could not fetch safety settings, using strict start time.');
            }

            if (sessionStartTime && msgDate < safetyThreshold) {
                // Silently skip old messages
                return;
            }

            console.log(`[TRACE] 📨 RAW MESSAGE from ${sender}: "${body}"`);
            if (msg.from === 'status@broadcast') return;

            // Extract phone number
            const phone = msg.from.replace('@c.us', '');
            console.log(`[TRACE] Processing message for phone: ${phone}`);

            // Get or create contact
            let contact = await Contact.findOne({ phone });
            if (!contact) {
                console.log(`[TRACE] Creating new contact for ${phone}`);
                contact = await Contact.create({
                    phone,
                    status: 'pendiente',
                    source: 'organic', // Default source
                    firstSeenAt: new Date(),
                    lastSeenAt: new Date(),
                    tags: [],
                    meta: {}
                });
            } else {
                // Update last seen
                contact.lastSeenAt = new Date();
                await contact.save();
                console.log(`[TRACE] Existing contact found: ${phone}. Status: ${contact.status}`);
            }

            /* 
            // --- BUSINESS HOURS CHECK (FIXED: Disabling per user request to test flow) ---
            const businessHours = await Setting.findOne({ key: 'business_hours' });
            if (businessHours && businessHours.value.enabled) {
                const isClosed = !isWithinBusinessHours(businessHours.value.schedule);
                if (isClosed) {
                    const now = new Date();
                    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

                    // ATOMIC UPDATE: Only send if lastOOOSentAt is old or missing
                    const updatedContact = await Contact.findOneAndUpdate(
                        {
                            _id: contact._id,
                            $or: [
                                { "meta.lastOOOSentAt": { $exists: false } },
                                { "meta.lastOOOSentAt": { $lt: oneHourAgo.toISOString() } },
                                { "meta.lastOOOSentAt": null }
                            ]
                        },
                        { $set: { "meta.lastOOOSentAt": now.toISOString() } },
                        { new: true }
                    );

                    if (updatedContact) {
                        console.log(`[TRACE] 🌙 CLINIC CLOSED. Sending out-of-office message to ${phone}`);
                        const chat = await msg.getChat();
                        await sendTyping(chat);
                        await randomDelay(1000, 500);
                        const msgText = businessHours.value.closedMessage || 'Estamos fuera de horario de atención.';
                        await chat.sendMessage(msgText);
                        contact = updatedContact; // Refresh local contact
                    } else {
                        console.log(`[TRACE] 🌙 CLINIC CLOSED. Skipping out-of-office spam.`);
                    }
                }
            }
            */
            // ----------------------------

            // Find active conversation
            let activeConversations = await Conversation.find({ phone, state: 'active' });
            if (activeConversations.length > 1) {
                console.log(`[WARNING] ⚠️ Multiple active conversations found for ${phone}. Closing all except the most recent.`);
                const kept = activeConversations.pop();
                await Conversation.updateMany({ phone, state: 'active', _id: { $ne: kept._id } }, { $set: { state: 'closed' } });
                activeConversations = [kept];
            }
            let conversation = activeConversations[0];

            // Check for explicit "reset" command
            if (msg.body.trim().toUpperCase() === 'RESET') {
                if (activeConversations.length > 0) {
                    await Conversation.updateMany({ phone, state: 'active' }, { $set: { state: 'closed' } });
                }
                const chat = await msg.getChat();
                await chat.sendMessage('🔄 Conversación reiniciada.');
                console.log(`[TRACE] RESET command received from ${phone}`);
                return;
            }

            // Decision Logic
            if (!conversation) {
                console.log(`[TRACE] No active conversation for ${phone}. Starting flow selection...`);
                // Determine if 'agendado' (mock logic since we can't really know without syncing contacts)
                const chatContact = await msg.getContact();
                const isAgendado = chatContact.isMyContact;

                console.log(`[TRACE] Selection Criteria -> Source: ${contact.source}, IsAgendado: ${isAgendado}`);

                const selectedFlow = await selectFlow({ isAgendado, source: contact.source });

                if (!selectedFlow) {
                    console.log(`[TRACE] ❌ No suitable flow found for ${phone}. Ignoring message.`);
                    return;
                }

                console.log(`[TRACE] ✅ Flow SELECTED: "${selectedFlow.name}" (v${selectedFlow.publishedVersion})`);

                // Start conversation
                conversation = await Conversation.create({
                    phone,
                    flowVersion: selectedFlow.publishedVersion,
                    currentStepId: selectedFlow.published.entryStepId,
                    state: 'active',
                    tags: [], // Initialize tags
                    loopDetection: {
                        currentStepId: selectedFlow.published.entryStepId,
                        messagesInCurrentStep: 0,
                        lastStepChangeAt: new Date(),
                    }
                });
                console.log(`[TRACE] New conversation created: ${conversation._id} starting at step ${conversation.currentStepId}`);
            } else {
                console.log(`[TRACE] Active conversation found: ${conversation._id} at step ${conversation.currentStepId}`);

                // Check for Force Restart Flows even if conversation exists
                const chatContact = await msg.getContact();
                const isAgendado = chatContact.isMyContact;
                const forcingFlow = await selectFlow({
                    isAgendado,
                    source: contact.source,
                    forceOnly: true,
                    body: msg.body
                });

                if (forcingFlow) {
                    console.log(`[TRACE] ⚡ FORCE RESTART by flow: "${forcingFlow.name}"`);
                    // Archive ALL existing active conversations
                    await Conversation.updateMany({ phone, state: 'active' }, { $set: { state: 'closed' } });

                    // Create new one
                    conversation = await Conversation.create({
                        phone,
                        flowVersion: forcingFlow.publishedVersion,
                        currentStepId: forcingFlow.published.entryStepId,
                        state: 'active',
                        tags: [],
                        loopDetection: {
                            currentStepId: forcingFlow.published.entryStepId,
                            messagesInCurrentStep: 0,
                            lastStepChangeAt: new Date(),
                        }
                    });
                    console.log(`[TRACE] Force restarted conversation: ${conversation._id}`);
                }
            }

            // Re-fetch flow to ensure we have the steps
            const flow = await Flow.findOne({ publishedVersion: conversation.flowVersion });

            if (!flow) {
                console.log(`[TRACE] ⚠️ Could not retrieve flow definition for existing conversation. Maybe flow was turned off?`);
                return;
            }

            // SILENCE CHECK: Stop bot if human attention is required
            if (conversation.state === 'paused') {
                console.log(`[TRACE] 🤫 Bot is PAUSED for ${phone}. Skipping automation.`);
                return;
            }

            // Handle the message within the current step
            await handleStepLogic(client, msg, conversation, flow, contact);

            // ATOMIC UPDATE: Sync last contact seen time one more time after processing 
            await Contact.updateOne({ _id: contact._id }, { $set: { lastSeenAt: new Date() } });

        } catch (e) {
            console.error('[ERROR] Error processing message:', e);
        }
    });

    // Helper: Logic to handle a step
    async function handleStepLogic(client, msg, conversation, flow, contact) {
        const steps = flow.published.steps;
        const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];

        let loopSafety = 0;
        const input = (msg.body || '').trim().toLowerCase();

        // 1. UNIVERSAL COMMANDS (V/M)
        if (input === 'm' || input === 'menu' || input.includes('menu principal')) {
            console.log(`[TRACE] 🏠 Universal Menu requested by ${contact.phone}`);
            const newStepId = flow.published.entryStepId;
            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $set: {
                        currentStepId: newStepId,
                        history: [],
                        "loopDetection.currentStepId": newStepId,
                        "loopDetection.messagesInCurrentStep": 0,
                        "loopDetection.lastStepChangeAt": new Date()
                    }
                }
            );
            conversation.currentStepId = newStepId;
            conversation.history = [];
            conversation.loopDetection.messagesInCurrentStep = 0;
            // Removed early return to allow immediate menu response
        }
        else if (input === 'v' || input === 'atras' || input.includes('volver')) {
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
                        currentStepId: newStepId,
                        history: newHistory,
                        "loopDetection.currentStepId": newStepId,
                        "loopDetection.messagesInCurrentStep": 0,
                        "loopDetection.lastStepChangeAt": new Date()
                    }
                }
            );
            conversation.currentStepId = newStepId;
            conversation.history = newHistory;
            conversation.loopDetection.messagesInCurrentStep = 0;
            // Removed early return to allow immediate back response
        }

        // 1.5 MEDIA DETECTION (Receipts)
        if (msg.hasMedia) {
            console.log(`[TRACE] 📸 Media detected from ${contact.phone}. Assuming receipt/document.`);

            // CONTEXTUAL HANDLING: If we are waiting for a reservation payment
            if (conversation.currentStepId === 'esperando_pago_reserva') {
                console.log(`[TRACE] 💳 Payment received for reservation. Advancing to data capture.`);
                await Conversation.updateOne(
                    { _id: conversation._id },
                    {
                        $push: { history: conversation.currentStepId },
                        $set: { currentStepId: 'captura_nombre' },
                        $addToSet: { tags: 'pago-enviado' }
                    }
                );
                conversation.currentStepId = 'captura_nombre';
                const chat = await msg.getChat();
                await chat.sendMessage('✅ ¡Recibimos tu comprobante de reserva! Muchas gracias.');
                // Trigger recursion to ask for Name immediately
                await handleStepLogic(client, msg, conversation, flow, contact);
                return;
            }

            // DEFAULT BEHAVIOR: Pause and wait for human
            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $set: { state: 'paused' },
                    $addToSet: { tags: 'pago-enviado' }
                }
            );
            conversation.state = 'paused';

            const chat = await msg.getChat();
            await sendTyping(chat);
            await randomDelay(1000, 500);
            await chat.sendMessage('✅ ¡Recibimos tu archivo! Un administrador lo revisará en breve para confirmar tu pago y turno. ¡Gracias! 👤');

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

            // Entry Point (Send Message)
            if (conversation.loopDetection.messagesInCurrentStep === 0) {
                const response = formatMessage(currentStep, flow);
                const chat = await msg.getChat();

                try {
                    await sendTyping(chat);
                    await randomDelay(1000, 500);
                    console.log(`[TRACE][${conversation._id}] 📤 Sending[${currentStep.id}]: "${response.replace(/\n/g, ' ')}"`);
                    await chat.sendMessage(response);
                } catch (error) {
                    console.error('[ERROR] Failed to send message:', error);
                }

                // Atomic Update instead of save()
                await Conversation.updateOne(
                    { _id: conversation._id },
                    {
                        $set: { "loopDetection.messagesInCurrentStep": 1 },
                        $inc: { __v: 1 }
                    }
                );
                conversation.loopDetection.messagesInCurrentStep = 1;
                break;
            }

            // Evaluation (Process Input)
            const options = currentStep.options || [];

            for (const opt of options) {
                const key = (opt.key || '').toLowerCase();
                const label = (opt.label || '').toLowerCase();
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
                        $set: { state: 'paused' },
                        $addToSet: { tags: 'intervencion-humana' }
                    }
                );
                conversation.state = 'paused';
                const chat = await msg.getChat();
                await chat.sendMessage("👍 Recibido. Un asesor humano revisará tu mensaje y te responderá a la brevedad.");
                return;
            }

            // Standard Fallback logic for everything else (Keep in Flow)
            console.log(`[TRACE] ⚠️ Invalid Option: ${input}`);

            // Increment loop detection but BE LESS AGGRESSIVE than handoff
            const newCount = (conversation.loopDetection.messagesInCurrentStep || 0) + 1;
            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $set: { "loopDetection.messagesInCurrentStep": newCount }
                }
            );
            conversation.loopDetection.messagesInCurrentStep = newCount;

            const chat = await msg.getChat();
            // Instead of auto-handoff, just give a softer fallback message
            let fallbackMsg = flow.published.fallbackMessage || 'No entendí esa opción. Por favor elegí una de las opciones válidas o escribí M para volver al inicio.';
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
    }



    await client.initialize();
    console.log('[INIT] Client initialized inside startBot');
}

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
    if (flow && flow.published && step.id !== flow.published.entryStepId) {
        msg += `\n\n🔹 *V:* Volver atrás\n🔹 *M:* Menú principal`;
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
async function selectFlow({ isAgendado, source, forceOnly = false, body = '' }) {
    console.log(`[DEBUG] Finding flow for: Source=${source}, Agendado=${isAgendado}, ForceOnly=${forceOnly}, Body="${body}"`);

    // DEBUG: Dump ALL flows to see what we have
    const allFlows = await Flow.find({});
    // console.log(`[DEBUG-CRITICAL] Total Documents in 'flows' collection: ${allFlows.length}`);

    const flows = await Flow.find({ isActive: true, published: { $ne: null } });
    // console.log(`[DEBUG] Found ${flows.length} ACTIVE & PUBLISHED flows.`);

    // Activation keywords (hardcoded for now to prevent infinite loops)
    const RESTART_KEYWORDS = ['hola', 'menu', 'inicio', 'empezar', 'reset', 'm'];

    // Filter by activation rules
    const matchingFlows = flows.filter(flow => {
        const rules = flow.activationRules;
        if (!rules) return false;

        // Check source
        const sourceMatch = (source === 'meta_ads' && rules.sources.meta_ads) ||
            (source === 'organic' && rules.sources.organic);

        // Check WhatsApp status
        const statusMatch = (isAgendado && rules.whatsappStatus.agendado) ||
            (!isAgendado && rules.whatsappStatus.no_agendado);

        // Check forceRestart if forceOnly is requested
        if (forceOnly) {
            if (!rules.forceRestart) return false;

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
    console.log('To start bot, POST to /bot/start');

    // Auto-start bot on server launch
    startBot();
});
