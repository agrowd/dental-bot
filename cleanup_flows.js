const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority';

async function cleanup() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Flow = mongoose.model('Flow', new mongoose.Schema({}, { strict: false }));
        const result = await Flow.updateMany({ name: { $ne: 'Prueba Salvador' } }, { isActive: false });
        console.log(`Deactivated ${result.modifiedCount} flows.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
cleanup();
