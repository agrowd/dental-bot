const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority';

const FlowSchema = new mongoose.Schema({
    name: String,
    isActive: Boolean,
    activationRules: mongoose.Schema.Types.Mixed,
    published: mongoose.Schema.Types.Mixed,
    publishedVersion: Number,
    updatedAt: Date
}, { strict: false });

const Flow = mongoose.model('Flow', FlowSchema);

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        const flowName = "Prueba Salvador";
        await Flow.deleteOne({ name: flowName });

        const steps = {
            "welcome": {
                id: "welcome",
                title: "Inicio (Filtro Principal)",
                message: "¡Hola! Bienvenido a la Tienda Dental R.A.D. Para derivarte con la persona indicada o informarte de nuestros tratamientos, por favor decinos quién sos:",
                options: [
                    { id: "opt-1", key: "A", label: "Soy paciente de la clínica", nextStepId: "derivacion_paciente" },
                    { id: "opt-2", key: "B", label: "Soy Profesional / Proveedor / Ofrezco servicios", nextStepId: "derivacion_profesional" },
                    { id: "opt-3", key: "C", label: "Es mi primera consulta (Quiero info)", nextStepId: "interes_tratamiento" }
                ]
            },
            "derivacion_paciente": {
                id: "derivacion_paciente",
                title: "Atencion del Paciente",
                message: "¡Hola de nuevo! Como ya sos paciente de la casa, te derivamos directamente con un asistente humano para ayudarte con lo que necesites. Aguardanos un momento... 👤",
                options: [{ id: "opt-4", key: "M", label: "Volver", nextStepId: "welcome" }],
                actions: { pauseConversation: true }
            },
            "derivacion_profesional": {
                id: "derivacion_profesional",
                title: "Derivación Profesional",
                message: "Hola. Por favor dejanos tus datos o propuesta por este medio. Un responsable del área los revisará y se contactará con vos. Te derivamos a atención humana... 📁",
                options: [{ id: "opt-5", key: "M", label: "Volver", nextStepId: "welcome" }],
                actions: { pauseConversation: true }
            },
            "interes_tratamiento": {
                id: "interes_tratamiento",
                title: "Interés en Tratamiento",
                message: "¿En qué tratamiento o producto RAD estás interesado?",
                options: [
                    { id: "opt-6", key: "A", label: "Implantes", nextStepId: "cierre_y_pago" },
                    { id: "opt-7", key: "B", label: "Prótesis sin Implantes", nextStepId: "cierre_y_pago" },
                    { id: "opt-8", key: "C", label: "Estética Dental", nextStepId: "cierre_y_pago" },
                    { id: "opt-9", key: "D", label: "Limpieza", nextStepId: "cierre_y_pago" },
                    { id: "opt-10", key: "E", label: "Otro", nextStepId: "cierre_y_pago" }
                ],
                actions: { addTags: ["interes-tratamiento"] }
            },
            "cierre_y_pago": {
                id: "cierre_y_pago",
                title: "Cierre y Pago",
                message: "¡Excelente elección! Para confirmar tu presupuesto o la consulta presencial con el especialista, por favor realizá el pago en el siguiente link. \n\nElegí una opción para recibir el enlace:",
                options: [
                    { id: "opt-12", key: "A", label: "Quiero Informe Online", nextStepId: "pago_online" },
                    { id: "opt-13", key: "B", label: "Quiero Consulta Profesional", nextStepId: "pago_presencial" }
                ]
            },
            "pago_online": {
                id: "pago_online",
                title: "Pago Informe Online",
                message: "Perfecto, elegiste **Informe Online**. Recibirás el link de pago ahora mismo. Una vez abonado, procesaremos tu informe.",
                options: [{ id: "opt-15", key: "M", label: "Volver al inicio", nextStepId: "welcome" }],
                actions: { registerAppointment: true, addTags: ["pago-online"] }
            },
            "pago_presencial": {
                id: "pago_presencial",
                title: "Pago Consulta Especialista",
                message: "Excelente, elegiste **Consulta Presencial**. Recibirás el link de pago ahora mismo. Una vez abonado, te llamaremos para coordinar.",
                options: [{ id: "opt-16", key: "M", label: "Volver al inicio", nextStepId: "welcome" }],
                actions: { registerAppointment: true, addTags: ["pago-presencial"] }
            }
        };

        await Flow.create({
            name: flowName,
            isActive: true,
            activationRules: {
                sources: { meta_ads: true, organic: true },
                whatsappStatus: { agendado: false, no_agendado: true },
                priority: 100,
                forceRestart: true
            },
            published: { entryStepId: "welcome", steps: steps },
            publishedVersion: 3,
            updatedAt: new Date()
        });

        console.log("✅ Flow 'Prueba Salvador' upgraded to 100% MENU (Removed text inputs).");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
seed();
