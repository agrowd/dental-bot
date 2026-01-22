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
            const steps = flow.draft.steps;

            // Focus on steps that lead from welcome
            const queue = ['welcome'];
            const seen = new Set();

            while (queue.length > 0) {
                const id = queue.shift();
                if (seen.has(id)) continue;
                seen.add(id);

                const step = steps[id];
                if (!step) continue;

                console.log(`\n--- Step: ${step.title} (${id}) ---`);
                console.log(`Msg: ${step.message}`);
                if (step.options) {
                    step.options.forEach(o => {
                        console.log(`  ${o.key}) ${o.label} -> ${o.nextStepId}`);
                        if (o.nextStepId) queue.push(o.nextStepId);
                    });
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
