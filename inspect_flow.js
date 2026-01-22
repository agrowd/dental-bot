const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/odontobot';

const FlowSchema = new mongoose.Schema({
    name: String,
    draft: mongoose.Schema.Types.Mixed,
    published: mongoose.Schema.Types.Mixed
}, { strict: false });

const Flow = mongoose.model('Flow', FlowSchema);

async function inspect() {
    try {
        await mongoose.connect(MONGODB_URI);
        const flow = await Flow.findOne({ name: /Prueba 3/i });
        if (flow) {
            console.log(JSON.stringify(flow, null, 2));
        } else {
            const allFlows = await Flow.find({}, { name: 1 });
            console.log('Flow not found. Available flows:', allFlows.map(f => f.name));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
