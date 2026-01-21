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

const Flow = mongoose.model('Flow', FlowSchema);
const Contact = mongoose.model('Contact', ContactSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message = mongoose.model('Message', MessageSchema);

// Bot state
let botState = 'disconnected'; // disconnected | connecting | connected | error
let currentQR = null;
let qrTimeout = null;
let client = null;
let retryCount = 0;
let lastRetryTime = 0;

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
    const authPath = process.env.WHATSAPP_SESSION_PATH || './.wwebjs_auth';
    try {
        if (fs.existsSync(authPath)) {
            console.log('[INIT] Removing existing session directory...');
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('[INIT] Session directory removed.');
        }
    } catch (e) {
        console.warn('[INIT] Warning during cleanup:', e.message);
    }

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: process.env.WHATSAPP_SESSION_PATH || './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // QR code handler
    client.on('qr', (qr) => {
        console.log('QR Code received');
        currentQR = qr;
        qrcode.generate(qr, { small: true });

        // Clear existing timeout
        if (qrTimeout) clearTimeout(qrTimeout);

        // Set 45-second timeout for QR
        qrTimeout = setTimeout(() => {
            if (botState === 'connecting') {
                botState = 'error';
                currentQR = null;
                console.log('QR timeout - no scan detected');
            }
        }, 45000);
    });

    // Connected handler
    client.on('authenticated', () => {
        console.log('[INIT] Client authenticated');
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

    // Message handler
    client.on('message', async (msg) => {
        const sender = msg.from;
        const body = msg.body;
        console.log(`[TRACE] 📨 RAW MESSAGE from ${sender}: "${body}"`);

        try {
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

            // Find active conversation
            let conversation = await Conversation.findOne({ phone, state: 'active' });

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
                const forcingFlow = await selectFlow({ isAgendado, source: contact.source, forceOnly: true });

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

    // Format message with options
    function formatMessage(step) {
        let msg = step.message + '\n\n';
        step.options.forEach(opt => {
            msg += `${opt.key}) ${opt.label}\n`;
        });
        return msg.trim();
    }

    // Select flow based on rules
    async function selectFlow({ isAgendado, source, forceOnly = false }) {
        console.log(`[DEBUG] Finding flow for: Source=${source}, Agendado=${isAgendado}, ForceOnly=${forceOnly}`);

        // DEBUG: Dump ALL flows to see what we have
        const allFlows = await Flow.find({});
        console.log(`[DEBUG-CRITICAL] Total Documents in 'flows' collection: ${allFlows.length}`);
        if (allFlows.length > 0) {
            console.log('[DEBUG-CRITICAL] First flow in DB:', JSON.stringify(allFlows[0], null, 2));
        }

        const flows = await Flow.find({ isActive: true, published: { $ne: null } });
        console.log(`[DEBUG] Found ${flows.length} ACTIVE & PUBLISHED flows.`);

        // Filter by activation rules
        const matchingFlows = flows.filter(flow => {
            const rules = flow.activationRules;
            if (!rules) {
                console.log(`[DEBUG] Flow ${flow.name} skipped: No activation rules.`);
                return false;
            }

            // Check source
            const sourceMatch = (source === 'meta_ads' && rules.sources.meta_ads) ||
                (source === 'organic' && rules.sources.organic);

            // Check WhatsApp status
            const statusMatch = (isAgendado && rules.whatsappStatus.agendado) ||
                (!isAgendado && rules.whatsappStatus.no_agendado);

            // Check forceRestart if forceOnly is requested
            if (forceOnly && !rules.forceRestart) return false;

            console.log(`[DEBUG] Checking Flow "${flow.name}": SourceMatch=${sourceMatch} (${source} vs ${JSON.stringify(rules.sources)}), StatusMatch=${statusMatch} (${isAgendado} vs ${JSON.stringify(rules.whatsappStatus)})`);

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

    // Auto-handoff function
    async function triggerAutoHandoff(conversation, contact, currentStep) {
        conversation.state = 'paused';
        conversation.tags.push('auto-handoff');
        await conversation.save();

        // Send message to user
        const chat = await client.getChatById(conversation.phone + '@c.us');
        await chat.sendMessage('Un asesor te atenderá en breve. Gracias por tu paciencia. 👤');

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
    });
