require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const flows = await db.collection('flows').find({ isActive: true, published: { $ne: null } }).toArray();
    
    if (flows.length === 0) { console.log("NO FLOWS"); process.exit(0); }
    
    const flow = flows[0];
    const entryStepId = flow.published.entryStepId;
    const entryStep = flow.published.steps[entryStepId];
    
    const optA = entryStep.options.find(o => o.key.toLowerCase() === 'a');
    if (!optA) {
        console.log("OPTION A NOT FOUND");
    } else {
        const targetStep = flow.published.steps[optA.nextStepId];
        console.log("TARGET STEP FULL DETAILS:");
        console.log(JSON.stringify(targetStep, null, 2));
    }
    process.exit(0);
}

run();
