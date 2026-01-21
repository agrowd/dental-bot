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

    // Message handler
    client.on('message', async (msg) => {
        try {
            await handleIncomingMessage(msg);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    await client.initialize();
}

// Main message handler
async function handleIncomingMessage(msg) {
    // Ignore status updates, broadcasts, and linked device notifications
    if (msg.from.includes('status') || msg.from.includes('broadcast') || msg.from.includes('@lid')) {
        return;
    }

    // Ignore group messages
    if (msg.from.includes('@g.us')) {
        return;
    }

    const phone = msg.from.replace('@c.us', '');
    console.log(`[DEBUG] Message from ${phone}: ${msg.body}`);

    // DEBUG: Reset command
    if (msg.body.trim().toUpperCase() === 'RESET') {
        await Conversation.updateMany({ phone }, { state: 'closed' });
        const chat = await msg.getChat();
        await chat.sendMessage('🔄 Conversación reiniciada por comando RESET.');
        console.log(`[DEBUG] Conversation reset for ${phone}`);
        return;
    }

    // Save incoming message
    await Message.create({
        phone,
        direction: 'in',
        text: msg.body,
        timestamp: new Date(),
    });

    // Get or create contact
    let contact = await Contact.findOne({ phone });
    if (!contact) {
        console.log(`[DEBUG] Creating new contact for ${phone}`);
        // New contact - detect source (TODO: integrate with Meta webhook)
        contact = await Contact.create({
            phone,
            source: 'organic', // Default to organic
            status: 'pendiente',
            tags: [],
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
        });
    } else {
        contact.lastSeenAt = new Date();
        await contact.save();
    }

    // Check if contact is saved in WhatsApp contacts
    const chatContact = await msg.getContact();
    const isAgendado = chatContact.isMyContact;
    console.log(`[DEBUG] Contact ${phone} - Is Agendado: ${isAgendado}, Source: ${contact.source}`);

    // Get active conversation or create new
    let conversation = await Conversation.findOne({ phone, state: { $ne: 'closed' } });

    // Try to find a forcing flow first
    const forcingFlow = await selectFlow({ isAgendado, source: contact.source, forceOnly: true });

    if (forcingFlow && forcingFlow.activationRules.forceRestart) {
        console.log(`[DEBUG] Force restart triggered by flow: ${forcingFlow.name}`);
        if (conversation) {
            conversation.state = 'closed';
            await conversation.save();
        }
        conversation = null; // Force creation of new conversation
    }

    // NEW CONVERSATION LOGIC
    if (!conversation) {
        console.log('[DEBUG] No active conversation. Attempting to start new flow.');
        // Select appropriate flow (if not already forced)
        const flow = forcingFlow || await selectFlow({ isAgendado, source: contact.source });

        if (!flow) {
            console.log('[DEBUG] No matching flow found for contact rules.');
            return;
        }
        console.log(`[DEBUG] Flow selected: ${flow.name} (v${flow.publishedVersion})`);

        conversation = await Conversation.create({
            phone,
            flowVersion: flow.publishedVersion,
            currentStepId: flow.published.entryStepId,
            state: 'active',
            tags: [],
            loopDetection: {
                currentStepId: flow.published.entryStepId,
                messagesInCurrentStep: 0,
                lastStepChangeAt: new Date(),
            }
        });

        // Send entry step message
        const steps = flow.published.steps;
        const currentStep = steps.get(flow.published.entryStepId);

        if (!currentStep) {
            console.log('Entry step not found!');
            return;
        }

        const response = formatMessage(currentStep);
        const chat = await msg.getChat();
        await sendTyping(chat);
        await randomDelay(2000, 1000); // Small initial delay
        await chat.sendMessage(response);

        // Save outgoing message
        await Message.create({
            phone,
            direction: 'out',
            text: response,
            timestamp: new Date(),
        });

    } else {
        // EXISTING CONVERSATION LOGIC
        console.log(`[DEBUG] Found existing active conversation in state: ${conversation.state}`);

        // Check if conversation is paused (handoff mode)
        if (conversation.state === 'paused') {
            console.log('Conversation paused - handoff active');
            return; // Do not respond
        }

        // Get current flow
        const flow = await Flow.findOne({ publishedVersion: conversation.flowVersion });
        if (!flow || !flow.published) {
            console.log('Flow not found or not published');
            return;
        }

        const steps = flow.published.steps;
        const currentStep = steps.get(conversation.currentStepId);

        if (!currentStep) {
            console.log('Current step not found');
            return;
        }

        // *** LOOP DETECTION ***
        if (conversation.loopDetection.currentStepId === conversation.currentStepId) {
            conversation.loopDetection.messagesInCurrentStep++;
        } else {
            conversation.loopDetection = {
                currentStepId: conversation.currentStepId,
                messagesInCurrentStep: 1,
                lastStepChangeAt: new Date(),
            };
        }

        // Auto-handoff after 6 messages without progress
        if (conversation.loopDetection.messagesInCurrentStep >= 6) {
            console.log('Loop detected - triggering auto-handoff');
            await triggerAutoHandoff(conversation, contact, currentStep);
            return;
        }

        await conversation.save();

        // Get chat for sending messages
        const chat = await msg.getChat();

        // Show typing indicator
        await sendTyping(chat);

        // *** HUMAN-LIKE DELAY (10-15 seconds) ***
        const messageLength = currentStep.message.length;
        const baseDelay = 10000;
        const extraDelay = messageLength > 100 ? 5000 : 0; // 15-20s for long messages
        await randomDelay(baseDelay, 5000 + extraDelay);

        // Parse user input
        const userInput = msg.body.trim().toUpperCase();
        const matchedOption = currentStep.options.find(opt => opt.key.toUpperCase() === userInput);

        if (matchedOption) {
            // Valid option - advance to next step
            const nextStepId = matchedOption.nextStepId;
            const nextStep = steps.get(nextStepId);

            if (!nextStep) {
                console.log('Next step not found:', nextStepId);
                return;
            }

            // Execute actions
            if (currentStep.actions) {
                if (currentStep.actions.addTags) {
                    conversation.tags.push(...currentStep.actions.addTags);
                    contact.tags.push(...currentStep.actions.addTags);
                    await contact.save();
                }
                if (currentStep.actions.setLeadStatus) {
                    contact.status = currentStep.actions.setLeadStatus;
                    await contact.save();
                }
                if (currentStep.actions.pauseConversation) {
                    conversation.state = 'paused';
                }
            }

            // Update conversation
            conversation.currentStepId = nextStepId;
            conversation.loopDetection = {
                currentStepId: nextStepId,
                messagesInCurrentStep: 0,
                lastStepChangeAt: new Date(),
            };
            await conversation.save();

            // Send next step
            const response = formatMessage(nextStep);
            await chat.sendMessage(response);

            // Save outgoing message
            await Message.create({
                phone,
                direction: 'out',
                text: response,
                timestamp: new Date(),
            });

        } else {
            // Invalid option - fallback
            const fallbackMsg = '⚠️ Para avanzar, elegí una de las opciones disponibles.\n\n' + formatMessage(currentStep);
            await chat.sendMessage(fallbackMsg);

            await Message.create({
                phone,
                direction: 'out',
                text: fallbackMsg,
                timestamp: new Date(),
            });
        }
    }
}

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
    const flows = await Flow.find({ isActive: true, published: { $ne: null } });
    console.log(`[DEBUG] Found ${flows.length} active published flows in DB.`);

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
