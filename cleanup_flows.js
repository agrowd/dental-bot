const mongoose = require('mongoose');

// Define Flow Schema
const FlowSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    activationRules: {
        sources: {
            meta_ads: { type: Boolean, default: false },
            organic: { type: Boolean, default: true }
        },
        whatsappStatus: {
            agendado: { type: Boolean, default: false },
            no_agendado: { type: Boolean, default: true }
        },
        priority: { type: Number, default: 0 },
        forceRestart: { type: Boolean, default: false }
    },
    draft: {
        entryStepId: String,
        steps: { type: Map, of: Object }
    },
    published: {
        entryStepId: String,
        steps: { type: Map, of: Object }
    },
    publishedVersion: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Flow = mongoose.model('Flow', FlowSchema);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://tryhard:Tryhard123@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority';

async function cleanup() {
    console.log('Connecting to MongoDB...');
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        console.log('Deleting ALL flows...');
        const res = await Flow.deleteMany({});
        console.log(`Deleted ${res.deletedCount} flows.`);

        console.log('Done.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}

cleanup();
