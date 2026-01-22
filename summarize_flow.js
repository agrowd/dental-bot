const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority';

const FlowSchema = new mongoose.Schema({
    name: String,
    draft: {
        entryStepId: String,
        steps: Map
    }
}, { strict: false });

const Flow = mongoose.model('Flow', FlowSchema);

async function inspect() {
    try {
        await mongoose.connect(MONGODB_URI);
        const flow = await Flow.findOne({ name: /Prueba 3/i });
        if (flow) {
            console.log('Flow Name:', flow.name);
            console.log('Entry Step:', flow.draft.entryStepId);
            const steps = flow.draft.steps;
            for (let [id, step] of Object.entries(steps)) {
                console.log(`\n--- Step ID: ${id} ---`);
                console.log(`Title: ${step.title}`);
                console.log(`Message: ${step.message}`);
                console.log('Options:');
                (step.options || []).forEach(o => {
                    console.log(`  ${o.key}) ${o.label} -> ${o.nextStepId}`);
                });
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
