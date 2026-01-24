const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/odontobot';

const FlowSchema = new mongoose.Schema({
    name: String,
    isActive: Boolean,
    published: mongoose.Schema.Types.Mixed,
}, { strict: false });

if (!mongoose.models.Flow) {
    mongoose.model('Flow', FlowSchema);
}
const Flow = mongoose.model('Flow');

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        const flowName = "Prueba Salvador";

        const steps = {
            "welcome": {
                id: "welcome",
                title: "Inicio (Filtro Principal)",
                message: "¡Hola! Bienvenido a la Tienda Dental R.A.D. 🦷\n\nPor favor decinos quién sos para derivarte:\n\nA) Soy paciente de la clínica\nB) Soy Profesional / Proveedor\nC) Quiero info de tratamientos\nP) Realizar un Pago",
                options: [
                    { id: "opt-1", key: "A", label: "Paciente", nextStepId: "derivacion_paciente" },
                    { id: "opt-2", key: "B", label: "Profesional", nextStepId: "derivacion_profesional" },
                    { id: "opt-3", key: "C", label: "Info Tratamientos", nextStepId: "info_general" },
                    { id: "p-main", key: "P", label: "Pagar", nextStepId: "pago_info_general" }
                ]
            },
            "pago_info_general": {
                id: "pago_info_general",
                title: "Información de Pago",
                message: "💳 **Pagos RAD**\n\nPodés abonar tus consultas o tratamientos de forma segura aquí: https://rad.jaef.com/pagos\n\nUna vez realizado el pago, envianos el **comprobante (foto o PDF)** directamente por este chat. El sistema lo detectará automáticamente.",
                options: [
                    { id: "opt-confirm", key: "A", label: "Ya lo pagué (Enviar comprobante)", nextStepId: "instruccion_comprobante" },
                    { id: "opt-back", key: "M", label: "Menú principal", nextStepId: "welcome" }
                ]
            },
            "instruccion_comprobante": {
                id: "instruccion_comprobante",
                title: "Instruccion Comprobante",
                message: "¡Perfecto! Por favor, **adjuntá la foto o PDF de tu comprobante** ahora mismo.\n\nAl recibirlo, el bot se pausará y un humano revisará tu pago para confirmarte el turno. Estamos aguardando tu archivo... 👇",
                options: [
                    { id: "opt-no-tengo", key: "M", label: "Volver al inicio", nextStepId: "welcome" }
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
                message: "¡Bienvenido! Podés conocer nuestra propuesta en: 🌐 https://rad.jaef.com/profesionales\n\nO dejanos tu mensaje aquí y te contactaremos. 👇",
                options: [],
                actions: { pauseConversation: true }
            },
            "info_general": {
                id: "info_general",
                title: "Menú de Tratamientos",
                message: "Contamos con tecnología de punta para tu salud dental. Seleccioná el tratamiento de tu interés para ver info y costos:\n\nA) Implantes Dentales\nB) Prótesis (Dientes Provisorios)\nC) Estética y Blanqueamiento\nD) Limpieza y Prevención\nP) Realizar un Pago",
                options: [
                    { id: "t-1", key: "A", label: "Implantes", nextStepId: "info_implantes" },
                    { id: "t-2", key: "B", label: "Prótesis", nextStepId: "info_protesis" },
                    { id: "t-3", key: "C", label: "Estética", nextStepId: "info_estetica" },
                    { id: "t-4", key: "D", label: "Limpieza", nextStepId: "info_limpieza" },
                    { id: "p-treat", key: "P", label: "Pagar", nextStepId: "pago_info_general" }
                ]
            },
            "info_implantes": {
                id: "info_implantes",
                title: "Info Implantes",
                message: "🦷 **Implantes RAD**\n\nAcá tenés la información detallada: Entrá a este link para saber sobre nuestros tipos de implantes y materiales: https://rad.jaef.com/implantes\n\nPara realizar el pago del pre-presupuesto y reservar tu turno, usá este link: https://mpago.la/implantes-rad",
                options: [{ id: "opt-next-1", key: "A", label: "Quiero este tratamiento", nextStepId: "captura_nombre" }]
            },
            "info_protesis": {
                id: "info_protesis",
                title: "Info Prótesis",
                message: "🦷 **Prótesis RAD**\n\nAcá tenés la información: Entrá a este link para saber sobre prótesis fijas y removibles: https://rad.jaef.com/protesis\n\nPodés realizar el pago de la seña aquí: https://mpago.la/protesis-rad",
                options: [{ id: "opt-next-2", key: "A", label: "Quiero este tratamiento", nextStepId: "captura_nombre" }]
            },
            "info_estetica": {
                id: "info_estetica",
                title: "Info Estética",
                message: "✨ **Estética Dental RAD**\n\nAcá tenés la información: Entrá a este link para conocer nuestros diseños de sonrisa: https://rad.jaef.com/estetica\n\nRealizá el pago de tu sesión aquí: https://mpago.la/estetica-rad",
                options: [{ id: "opt-next-3", key: "A", label: "Quiero este tratamiento", nextStepId: "captura_nombre" }]
            },
            "info_limpieza": {
                id: "info_limpieza",
                title: "Info Limpieza",
                message: "🧼 **Limpieza RAD**\n\nAcá tenés la información: Entrá a este link para saber sobre nuestro sistema de limpieza profunda: https://rad.jaef.com/limpieza\n\nAboná tu turno de limpieza aquí: https://mpago.la/limpieza-rad",
                options: [{ id: "opt-next-4", key: "A", label: "Quiero este tratamiento", nextStepId: "captura_nombre" }]
            },
            "captura_nombre": {
                id: "captura_nombre",
                title: "Captura de Nombre",
                message: "¡Genial! Por favor, ingresá tu Nombre y Apellido para agendarte:",
                options: [],
                nextStepId: "captura_dni"
            },
            "captura_dni": {
                id: "captura_dni",
                title: "Captura de DNI",
                message: "Gracias. Ahora ingresá tu DNI (solo números):",
                options: [],
                nextStepId: "cierre_final"
            },
            "cierre_final": {
                id: "cierre_final",
                title: "Cierre",
                message: "¡Listo! Ya registramos tus datos. Un asesor revisará tu pedido y se contactará con vos en breve para confirmar el turno. ¡Gracias por confiar en RAD!",
                options: [],
                actions: { pauseConversation: true }
            }
        };

        const existing = await Flow.findOne({ name: flowName });
        if (existing) {
            existing.published = { entryStepId: "welcome", steps: steps, fallbackMessage: "No entiendo. Escribí una opción o M para volver al menú." };
            existing.draft = existing.published;
            existing.publishedVersion = (existing.publishedVersion || 0) + 1;
            existing.updatedAt = new Date();
            await existing.save();
            console.log(`✅ Flow '${flowName}' updated to V${existing.publishedVersion} with specific links and P option.`);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
seed();
