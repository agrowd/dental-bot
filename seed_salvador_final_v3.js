const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/odontobot';

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

if (!mongoose.models.Flow) {
    mongoose.model('Flow', FlowSchema);
}
const Flow = mongoose.model('Flow');

async function seed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);

        const flowName = "Prueba Salvador";

        const steps = {
            "welcome": {
                id: "welcome",
                title: "Inicio (Filtro Principal)",
                message: "¡Hola! Bienvenido a la Tienda Dental R.A.D. 🦷\n\nPara derivarte con la persona indicada o informarte de nuestros tratamientos, por favor decinos quién sos:",
                options: [
                    { id: "opt-1", key: "A", label: "Soy paciente de la clínica", nextStepId: "derivacion_paciente" },
                    { id: "opt-2", key: "B", label: "Soy Profesional / Proveedor", nextStepId: "derivacion_profesional" },
                    { id: "opt-3", key: "C", label: "Es mi primera consulta (Quiero info)", nextStepId: "info_general" }
                ]
            },
            "derivacion_paciente": {
                id: "derivacion_paciente",
                title: "Atencion del Paciente",
                message: "¡Hola de nuevo! Como ya sos paciente de la casa, te derivamos directamente con un asistente humano para ayudarte con lo que necesites. Aguardanos un momento... 👤",
                options: [],
                actions: { pauseConversation: true, addTags: ["atencion-paciente"] }
            },
            "derivacion_profesional": {
                id: "derivacion_profesional",
                title: "Derivación Profesional",
                message: "¡Excelente! Si sos profesional o proveedor, podés conocer nuestra propuesta académica y comercial en: 🌐 https://rad.jaef.com/profesionales\n\nSi preferís hablar con un responsable del área, dejanos tu mensaje aquí debajo y te contactaremos en breve. 👇",
                options: [],
                actions: { pauseConversation: true, addTags: ["perfil-profesional"] }
            },
            "info_general": {
                id: "info_general",
                title: "Información General",
                message: "¡Bienvenido a RAD! 🚀\n\nPodés descargar nuestro cuadernillo de tratamientos y precios estimados aquí: 📑 https://rad.jaef.com/tratamientos\n\nSi querés avanzar con algo específico, elegí una opción:\n\nA) Quiero un presupuesto online\nB) Quiero una cita presencial\nC) Hablar con un asesor",
                options: [
                    { id: "opt-101", key: "A", label: "Presupuesto Online", nextStepId: "captura_nombre" },
                    { id: "opt-102", key: "B", label: "Cita Presencial", nextStepId: "captura_nombre" },
                    { id: "opt-103", key: "C", label: "Hablar con asesor", nextStepId: "derivacion_humana" }
                ],
                actions: { addTags: ["primera-consulta"] }
            },
            "derivacion_humana": {
                id: "derivacion_humana",
                title: "Asesor Humano",
                message: "Te estamos derivando con un asesor para responder tus dudas. ¡Aguardanos un momento! 👤",
                options: [],
                actions: { pauseConversation: true }
            },
            "captura_nombre": {
                id: "captura_nombre",
                title: "Captura de Nombre",
                message: "¡Perfecto! Para poder asesorarte mejor, por favor ingresá tu Nombre y Apellido:",
                options: [],
                nextStepId: "captura_dni"
            },
            "captura_dni": {
                id: "captura_dni",
                title: "Captura de DNI",
                message: "Ahora, ingresá tu DNI (solo números y sin puntos):",
                options: [],
                nextStepId: "cierre_y_pago"
            },
            "cierre_y_pago": {
                id: "cierre_y_pago",
                title: "Cierre y Pago",
                message: "¡Excelente! Ya registramos tu interés. Para avanzar, tenés dos opciones:\n\n1️⃣ **Informe Online (Pre-presupuesto):** Recibí info detallada y un estimativo por chat.\n2️⃣ **Consulta Profesional:** Cita presencial con el especialista para un diagnóstico clínico.\n\nElegí una opción para recibir el link de pago y coordinar:",
                options: [
                    { id: "opt-12", key: "A", label: "Quiero Informe Online", nextStepId: "pago_online" },
                    { id: "opt-13", key: "B", label: "Quiero Consulta Profesional", nextStepId: "pago_presencial" }
                ]
            },
            "pago_online": {
                id: "pago_online",
                title: "Pago Informe Online",
                message: "Perfecto, elegiste **Informe Online**. Recibirás el link de pago ahora mismo. Una vez abonado, procesaremos tu informe especializado. 💳",
                options: [],
                actions: { registerAppointment: true, addTags: ["pago-online"] }
            },
            "pago_presencial": {
                id: "pago_presencial",
                title: "Pago Consulta Especialista",
                message: "Excelente, elegiste **Consulta Presencial**. Recibirás el link de pago ahora mismo. Una vez abonado, te llamaremos para coordinar el día y horario con el especialista. 🏥",
                options: [],
                actions: { registerAppointment: true, addTags: ["pago-presencial"] }
            }
        };

        const existing = await Flow.findOne({ name: flowName });

        if (existing) {
            existing.description = "Flujo RAD - Clasificación y Venta (V3 Final)";
            existing.isActive = true;
            existing.activationRules = {
                sources: { meta_ads: true, organic: true },
                whatsappStatus: { agendado: true, no_agendado: true },
                priority: 100,
                forceRestart: true,
                activationOffset: 2
            };
            existing.published = { entryStepId: "welcome", steps: steps, fallbackMessage: "No entendí esa opción. Por favor elegí una de las opciones válidas o escribí M para ir al menú principal." };
            existing.draft = existing.published;
            existing.publishedVersion = (existing.publishedVersion || 0) + 1;
            existing.updatedAt = new Date();
            await existing.save();
            console.log(`✅ Flow '${flowName}' UPDATED to version ${existing.publishedVersion}.`);
        } else {
            await Flow.create({
                name: flowName,
                description: "Flujo RAD - Clasificación y Venta (V3 Final)",
                isActive: true,
                activationRules: {
                    sources: { meta_ads: true, organic: true },
                    whatsappStatus: { agendado: true, no_agendado: true },
                    priority: 100,
                    forceRestart: true,
                    activationOffset: 2
                },
                draft: { entryStepId: "welcome", steps: steps },
                published: { entryStepId: "welcome", steps: steps },
                publishedVersion: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`✅ Flow '${flowName}' CREATED.`);
        }

        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seed();
