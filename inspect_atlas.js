const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority';

const FlowSchema = new mongoose.Schema({
    name: String,
    draft: mongoose.Schema.Types.Mixed,
    published: mongoose.Schema.Types.Mixed
}, { strict: false });

const ConversationSchema = new mongoose.Schema({
    phone: String,
    currentStepId: String,
    state: String
}, { strict: false });

const MessageSchema = new mongoose.Schema({
    phone: String,
    text: String,
    direction: String,
    timestamp: Date
}, { strict: false });

const Flow = mongoose.model('Flow', FlowSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message = mongoose.model('Message', MessageSchema);

async function inspect() {
    try {
        await mongoose.connect(MONGODB_URI);

        console.log('--- FLOWS ---');
        const flow = await Flow.findOne({ name: /Prueba 3/i });
        if (flow) {
            console.log(JSON.stringify(flow, null, 2));
        } else {
            const allFlows = await Flow.find({}, { name: 1 });
            console.log('Flow not found. Available flows:', allFlows.map(f => f.name));
        }

        console.log('--- RECENT MESSAGES ---');
        const messages = await Message.find().sort({ timestamp: -1 }).limit(10);
        console.log(JSON.stringify(messages, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
