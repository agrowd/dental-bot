const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority';

async function inspect() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Flow = mongoose.model('Flow', new mongoose.Schema({}, { strict: false }));
        const flowDoc = await Flow.findOne({ name: /Prueba 3/i });

        if (flowDoc) {
            const flow = flowDoc.toObject();
            console.log('Flow Name:', flow.name);
            console.log('Entry Step:', flow.draft.entryStepId);
            const steps = flow.draft.steps;

            Object.keys(steps).forEach(id => {
                const step = steps[id];
                console.log(`\n--- Step ID: ${id} ---`);
                console.log(`Title: ${step.title}`);
                console.log(`Message: ${step.message}`);
                console.log('Options:');
                if (step.options && Array.isArray(step.options)) {
                    step.options.forEach(o => {
                        console.log(`  ${o.key}) ${o.label} -> ${o.nextStepId}`);
                    });
                }
            });
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
