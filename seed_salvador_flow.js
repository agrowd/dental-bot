const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority';

const FlowSchema = new mongoose.Schema({
    name: String,
    description: String,
    isActive: Boolean,
    activationRules: mongoose.Schema.Types.Mixed,
    draft: mongoose.Schema.Types.Mixed,
    published: mongoose.Schema.Types.Mixed,
    publishedVersion: Number,
    createdAt: Date,
    updatedAt: Date
}, { strict: false });

const Flow = mongoose.model('Flow', FlowSchema);

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);

        const flowName = "Prueba Salvador";

        // Delete if exists
        await Flow.deleteOne({ name: flowName });

        const steps = {
            "welcome": {
                id: "welcome",
                title: "Inicio (Filtro Principal)",
                message: "¡Hola! Bienvenido a la Clínica Dental. Para derivarte con la persona indicada, por favor decinos quién sos:",
                options: [
                    { id: "opt-1", key: "A", label: "Soy paciente de la clínica", nextStepId: "derivacion_paciente" },
                    { id: "opt-2", key: "B", label: "Soy Profesional / Proveedor / Ofrezco servicios", nextStepId: "derivacion_profesional" },
                    { id: "opt-3", key: "C", label: "Es mi primera consulta (Quiero info)", nextStepId: "interes_tratamiento" }
                ]
            },
            "derivacion_paciente": {
                id: "derivacion_paciente",
                title: "Derivación Paciente",
                message: "¡Hola de nuevo! Como ya sos paciente de la casa, te derivamos directamente con un asistente humano para ayudarte con lo que necesites. Aguardanos un momento... 👤",
                options: [
                    { id: "opt-4", key: "M", label: "Volver al menú principal", nextStepId: "welcome" }
                ],
                actions: { pauseConversation: true }
            },
            "derivacion_profesional": {
                id: "derivacion_profesional",
                title: "Derivación Profesional",
                message: "Hola. Por favor dejanos tus datos o propuesta por este medio. Un responsable del área los revisará y se contactará con vos. Te derivamos a atención humana... 📁",
                options: [
                    { id: "opt-5", key: "M", label: "Volver al menú principal", nextStepId: "welcome" }
                ],
                actions: { pauseConversation: true }
            },
            "interes_tratamiento": {
                id: "interes_tratamiento",
                title: "Interés de Tratamiento",
                message: "¿En qué tratamiento estás interesado?",
                options: [
                    { id: "opt-6", key: "A", label: "Implantes", nextStepId: "captura_nombre" },
                    { id: "opt-7", key: "B", label: "Ortodoncia", nextStepId: "captura_nombre" },
                    { id: "opt-8", key: "C", label: "Estética Dental", nextStepId: "captura_nombre" },
                    { id: "opt-9", key: "D", label: "Limpieza", nextStepId: "captura_nombre" },
                    { id: "opt-10", key: "E", label: "Otro", nextStepId: "captura_nombre" },
                    { id: "opt-11", key: "M", label: "Atrás", nextStepId: "welcome" }
                ],
                actions: { addTags: ["interés-tratamiento"] }
            },
            "captura_nombre": {
                id: "captura_nombre",
                title: "Captura de Nombre",
                message: "¡Perfecto! Por favor, ingresá tu Nombre y Apellido:",
                options: [], // Wait for text input
                nextStepId: "captura_dni"
            },
            "captura_dni": {
                id: "captura_dni",
                title: "Captura de DNI",
                message: "Ahora, ingresá tu DNI (solo números):",
                options: [],
                nextStepId: "cierre_y_pago"
            },
            "cierre_y_pago": {
                id: "cierre_y_pago",
                title: "Cierre y Pago",
                message: "¡Excelente! Ya registramos tu interés. Para confirmar la consulta inicial con el especialista, por favor realizá el pago en el siguiente link. Una vez abonado, nos comunicaremos con vos para coordinar el día de tu cita. 💳",
                options: [
                    { id: "opt-12", key: "M", label: "Volver al inicio", nextStepId: "welcome" }
                ],
                actions: { registerAppointment: true }
            }
        };

        const flow = await Flow.create({
            name: flowName,
            description: "Flujo de filtrado para Salvador (Pacientes vs Nuevos vs Proveedores)",
            isActive: true,
            activationRules: {
                sources: { meta_ads: true, organic: true },
                whatsappStatus: { agendado: false, no_agendado: true },
                priority: 100, // High priority to override others
                forceRestart: true
            },
            draft: {
                entryStepId: "welcome",
                steps: steps
            },
            published: {
                entryStepId: "welcome",
                steps: steps
            },
            publishedVersion: 1,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log("✅ Flow 'Prueba Salvador' created successfully!");
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seed();
