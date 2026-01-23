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

    // Message handler
    client.on('message', async (msg) => {
        const sender = msg.from;
        const body = msg.body;

        try {
            // SILENT FILTERS
            if (msg.from === 'status@broadcast') return;
            if (msg.from.endsWith('@g.us')) return; // Ignore groups

            // TIME FILTER (Ignore old messages)
            const msgDate = new Date(msg.timestamp * 1000);
            if (sessionStartTime && msgDate < sessionStartTime) {
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

            // --- BUSINESS HOURS CHECK ---
            const businessHours = await Setting.findOne({ key: 'business_hours' });
            if (businessHours && businessHours.value.enabled) {
                const isClosed = !isWithinBusinessHours(businessHours.value.schedule);
                if (isClosed) {
                    console.log(`[TRACE] 🌙 CLINIC CLOSED. Checking if we should send out-of-office message.`);

                    // Only send if it's been more than 4 hours since last message or it's a new contact
                    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
                    const lastMsg = await Message.findOne({ phone }).sort({ timestamp: -1 });

                    if (!lastMsg || lastMsg.timestamp < fourHoursAgo) {
                        const chat = await msg.getChat();
                        await sendTyping(chat);
                        await randomDelay(2000, 1000);
                        await chat.sendMessage(businessHours.value.closedMessage || 'Estamos fuera de horario de atención.');
                        console.log(`[TRACE] ✅ Out-of-office message sent to ${phone}`);

                        // Save the outbound message
                        await Message.create({
                            phone,
                            text: businessHours.value.closedMessage,
                            direction: 'outbound',
                            timestamp: new Date()
                        });
                    } else {
                        console.log(`[TRACE] Skipping out-of-office message (already sent recently).`);
                    }
                    // We DON'T return here because we might still want to process the flow 
                    // (e.g. if they want to leave a query), but usually we stop or let it continue.
                    // The user said "registramos tu consulta y te contactaremos mañana", 
                    // so it's better to let the flow proceed so they can leave data.
                }
            }
            // ----------------------------

            // Find active conversation
            let conversation = await Conversation.findOne({ phone, state: 'active' });

            if (conversation) {
                console.log(`[TRACE] Found ACTIVE conversation ${conversation._id} for ${phone} at step ${conversation.currentStepId}`);
                if (client && client.info) {
                    const chat = await msg.getChat();
                    await syncWhatsAppLabel(chat, 'BOT');
                }
            }

            // Check for explicit "reset" command
            if (msg.body.trim().toUpperCase() === 'RESET') {
                if (conversation) {
                    conversation.state = 'closed';
                    await conversation.save();
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
                    // Archive old conversation
                    conversation.state = 'closed';
                    await conversation.save();

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

            // Handle the message within the current step
            await handleStepLogic(client, msg, conversation, flow, contact);

        } catch (e) {
            console.error('[ERROR] Error processing message:', e);
        }
    });

    // Helper: Logic to handle a step
    async function handleStepLogic(client, msg, conversation, flow, contact) {
        const steps = flow.published.steps;
        // Handle POJO vs Map
        const getStep = (id) => (typeof steps.get === 'function') ? steps.get(id) : steps[id];

        const currentStep = getStep(conversation.currentStepId);

        if (!currentStep) {
            console.error(`[TRACE] ❌ Step definition missing for ID: ${conversation.currentStepId}`);
            return;
        }

        console.log(`[TRACE] Current Step: "${currentStep.title}" (${conversation.currentStepId})`);

        // Case A: New Conversation or Step Entry
        if (conversation.loopDetection.messagesInCurrentStep === 0) {
            console.log(`[TRACE] 🆕 sending INITIAL message for step ${currentStep.id}`);
            const response = formatMessage(currentStep);
            const chat = await msg.getChat();

            try {
                await sendTyping(chat);
                await randomDelay(1000, 500);
                console.log(`[TRACE] 📤 Sending: "${response.replace(/\n/g, ' ')}"`);
                await chat.sendMessage(response);
            } catch (error) {
                if (error.message && error.message.includes('markedUnread')) {
                    console.warn('[WARN] Ignored known "markedUnread" error during send.');
                } else {
                    console.error('[ERROR] Failed to send message:', error);
                }
                try { await chat.clearState(); } catch (e) { }
            }

            // Update state with explicit verification
            conversation.loopDetection.messagesInCurrentStep = 1;
            conversation.markModified('loopDetection'); // Ensure nested change is tracked
            await conversation.save();
            console.log(`[TRACE] ✅ State UPDATED: messagesInCurrentStep = 1 for ${conversation._id}`);
            return;
        }

        // Case B: Existing Conversation.
        console.log(`[TRACE] 🔍 Processing user input: "${msg.body}" against options.`);

        const options = currentStep.options || [];
        let nextStepId = null;

        // normalization
        const input = msg.body.trim().toLowerCase();

        // Check options
        for (const opt of options) {
            const key = (opt.key || '').toLowerCase();
            const label = (opt.label || '').toLowerCase();

            // Match Key (A, B, C) or Label OR specific 'volver' check for 'm'
            if (input === key || input === label || (key === 'm' && input.includes('volve'))) {
                console.log(`[TRACE] ✅ Match found: Option "${opt.key}" (${opt.label}) -> Go to ${opt.nextStepId}`);
                nextStepId = opt.nextStepId;
                break;
            }
        }

        // Default / Fallback logic
        if (!nextStepId) {
            console.log(`[TRACE] ⚠️ No option matched for input "${input}".`);

            // Safety: Manual handoff keywords
            const HUMAN_KEYWORDS = ['humano', 'asesor', 'persona', 'ayuda', 'atencion', 'atención'];
            if (HUMAN_KEYWORDS.some(k => input.includes(k))) {
                console.log(`[TRACE] 👤 Human request detected. Triggering handoff.`);
                await triggerAutoHandoff(conversation, contact, currentStep);
                return;
            }

            // Increment error counter
            conversation.loopDetection.messagesInCurrentStep++;
            conversation.markModified('loopDetection');
            await conversation.save();

            if (conversation.loopDetection.messagesInCurrentStep > 3) {
                console.log(`[TRACE] 🔄 Loop detected (3+ errors). Triggering auto-handoff.`);
                await triggerAutoHandoff(conversation, contact, currentStep);
                return;
            }

            const chat = await msg.getChat();
            // Get custom fallback message from flow if available
            let fallbackMsg = 'No entendí esa opción. Por favor elegí una de las opciones válidas (ej: A).';
            try {
                const flowDef = await Flow.findOne({ publishedVersion: conversation.flowVersion });
                if (flowDef && flowDef.published && flowDef.published.fallbackMessage) {
                    fallbackMsg = flowDef.published.fallbackMessage;
                }
            } catch (e) {
                console.warn('[WARN] Could not fetch custom fallback message, using default.');
            }

            try {
                await sendTyping(chat);
                await randomDelay(500, 200);
                await chat.sendMessage(fallbackMsg);
            } catch (err) {
                if (err.message && err.message.includes('markedUnread')) {
                    console.warn('[WARN] Ignored known "markedUnread" error on fallback.');
                } else {
                    console.error('Error sending fallback:', err.message);
                }
            }
            return;
        }

        // Transition
        const nextStep = getStep(nextStepId);
        if (!nextStep) {
            console.error(`[TRACE] ❌ Target step "${nextStepId}" not found.`);
            return;
        }

        console.log(`[TRACE] 🔄 Transitioning to step: ${nextStep.title} (${nextStepId})`);

        conversation.currentStepId = nextStepId;
        conversation.loopDetection = {
            currentStepId: nextStepId,
            messagesInCurrentStep: 0, // Reset for new step
            lastStepChangeAt: new Date()
        };
        conversation.markModified('loopDetection');
        await conversation.save();
        console.log(`[TRACE] ✅ Step UPDATED to ${nextStepId} for ${conversation._id}`);

        // --- APPOINTMENT REGISTRATION LOGIC ---
        // If the next step is marked as an appointment registration step
        if (nextStep.actions && nextStep.actions.registerAppointment) {
            console.log(`[TRACE] 📅 Registering APPOINTMENT for ${phone}`);
            try {
                // Determine chosen day and time from conversation history
                const recentMsgs = await Message.find({ phone }).sort({ timestamp: -1 }).limit(10);
                // Simple heuristic: search for the most recent message that looks like a day or time
                // In a production app, we'd store these in the conversation state explicitly

                // Let's create the appointment with what we have
                await Appointment.create({
                    phone,
                    patientName: contact.name,
                    patientDni: contact.meta?.dni,
                    service: contact.tags?.filter(t => t !== 'auto-handoff').join(', ') || 'Consulta',
                    date: new Date(), // We'll improve this with actual picked date later
                    dayName: 'Pendiente de procesar',
                    timeSlot: 'Consultar chat',
                    status: 'pending'
                });
                console.log(`[TRACE] ✅ Appointment registered for ${phone}`);

                // --- PAYMENT LINK LOGIC ---
                const paymentConfig = await Setting.findOne({ key: 'payment_config' });
                if (paymentConfig && paymentConfig.value.enabled && paymentConfig.value.link) {
                    const chat = await msg.getChat();
                    const paymentMsg = paymentConfig.value.message.replace('{LINK}', paymentConfig.value.link);

                    console.log(`[TRACE] 💳 Sending payment link to ${phone}`);
                    await sendTyping(chat);
                    await randomDelay(2500, 1000);
                    await chat.sendMessage(paymentMsg);

                    // Save outbound message
                    await Message.create({
                        phone,
                        text: paymentMsg,
                        direction: 'outbound',
                        timestamp: new Date()
                    });
                }
                // --------------------------
            } catch (err) {
                console.error('[ERROR] Failed to register appointment:', err);
            }
        }
        // --------------------------------------

        // Send the message for the NEW step immediately
        const response = formatMessage(nextStep);
        const chat = await msg.getChat();

        try {
            await sendTyping(chat);
            await randomDelay(1000, 500);
            console.log(`[TRACE] 📤 Sending: "${response.replace(/\n/g, ' ')}"`);
            await chat.sendMessage(response);
        } catch (e) {
            if (e.message && e.message.includes('markedUnread')) {
                console.warn('[WARN] Ignored known "markedUnread" error on transition.');
            } else {
                console.error('[ERROR] Failed to send transition message:', e);
            }
            try { await chat.clearState(); } catch (err) { }
        }

        // Mark that we sent the message for this step
        conversation.loopDetection.messagesInCurrentStep = 1;
        conversation.markModified('loopDetection');
        await conversation.save();
        console.log(`[TRACE] ✅ State UPDATED: messagesInCurrentStep = 1 (after transition) for ${conversation._id}`);
    }

    await client.initialize();
    console.log('[INIT] Client initialized inside startBot');
}

// Format message with options and dynamic variables
function formatMessage(step, contact = null) {
    let messageBody = step.message;

    // Handle Dynamic Variables
    if (messageBody.includes('{PROXIMOS_DIAS}')) {
        const nextDays = getNextBookingDays(7);
        let daysList = '';
        nextDays.forEach((d, i) => {
            daysList += `${String.fromCharCode(65 + i)}) ${d.label}\n`;
        });
        messageBody = messageBody.replace('{PROXIMOS_DIAS}', daysList.trim());
        // Return immediately if it's a list replacement (options are already inside the var)
        return messageBody;
    }

    let msg = messageBody + '\n\n';
    if (step.options && step.options.length > 0) {
        step.options.forEach(opt => {
            msg += `${opt.key}) ${opt.label}\n`;
        });
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
    const RESTART_KEYWORDS = ['hola', 'menu', 'inicio', 'empezar', 'reset'];

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
    conversation.state = 'paused';
    if (!conversation.tags.includes('auto-handoff')) {
        conversation.tags.push('auto-handoff');
    }
    await conversation.save();

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

    // Auto-start bot on server launch disabled to save resources
    // startBot();
});
