const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/odontobot';

const FlowSchema = new mongoose.Schema({}, { strict: false });
const ConversationSchema = new mongoose.Schema({}, { strict: false });
const ContactSchema = new mongoose.Schema({}, { strict: false });

const Flow = mongoose.model('Flow', FlowSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Contact = mongoose.model('Contact', ContactSchema);

async function nuclearFix() {
    try {
        console.log("☢️  STARTING NUCLEAR CLEANUP...");
        await mongoose.connect(MONGODB_URI);

        const flowName = "Prueba Salvador";
        const viperNumber = '5491144118569';

        // 1. DELETE ALL FLOWS with this name
        console.log(`🗑️  Deleting all flows named "${flowName}"...`);
        const delFlows = await Flow.deleteMany({ name: flowName });
        console.log(`✅ Deleted ${delFlows.deletedCount} old flows.`);

        // 2. DELETE ALL CONVERSATIONS for the VIP number
        console.log(`🗑️  Wiping conversations for ${viperNumber}...`);
        const delConvs = await Conversation.deleteMany({ phone: viperNumber });
        console.log(`✅ Deleted ${delConvs.deletedCount} old conversations.`);

        // 3. RESET CONTACT META for OoO
        console.log(`🔄 Resetting contact metadata for out-of-office anti-spam...`);
        await Contact.updateOne({ phone: viperNumber }, { $set: { "meta.lastOOOSentAt": null } });

        // 4. SEED NEW FLOW (V100 to be sure it stands out)
        console.log(`🌱 Seeding FRESH Flow V100...`);

        const steps = {
            "welcome": {
                id: "welcome",
                title: "Inicio (Filtro Principal)",
                message: "¡Hola! Bienvenido a la Tienda Dental R.A.D. 🦷\n\nPor favor decinos quién sos para derivarte:",
                options: [
                    { id: "opt-1", key: "A", label: "Soy paciente de la clínica", nextStepId: "derivacion_paciente" },
                    { id: "opt-2", key: "B", label: "Soy Profesional / Proveedor", nextStepId: "derivacion_profesional" },
                    { id: "opt-3", key: "C", label: "Quiero info de tratamientos", nextStepId: "info_general" }
                ]
            },
            "pago_info_general": {
                id: "pago_info_general",
                title: "Información de Pago",
                message: "💳 **Pagos RAD**\n\nPodés abonar tus consultas o tratamientos de forma segura aquí: https://rad.jaef.com/pagos\n\nUna vez realizado el pago, envianos el **comprobante (foto o PDF)** directamente por este chat.",
                options: [
                    { id: "opt-confirm", key: "A", label: "Ya lo pagué (Enviar comprobante)", nextStepId: "instruccion_comprobante" }
                ]
            },
            "instruccion_comprobante": {
                id: "instruccion_comprobante",
                title: "Instruccion Comprobante",
                message: "¡Perfecto! Por favor, **adjuntá la foto o PDF de tu comprobante** ahora mismo.\n\nAl recibirlo, un humano revisará tu pago para confirmarte el turno. 👇",
                options: [],
                actions: { pauseConversation: true, addTags: ["esperando-comprobante"] }
            },
            "info_general": {
                id: "info_general",
                title: "Menú de Tratamientos",
                message: "Contamos con tecnología de punta para tu salud dental. Seleccioná el tratamiento de tu interés para ver info y costos:",
                options: [
                    { id: "t-1", key: "A", label: "Implantes Dentales", nextStepId: "info_implantes" },
                    { id: "t-2", key: "B", label: "Prótesis (Dientes Provisorios)", nextStepId: "info_protesis" },
                    { id: "t-3", key: "C", label: "Estética y Blanqueamiento", nextStepId: "info_estetica" },
                    { id: "t-4", key: "D", label: "Limpieza y Prevención", nextStepId: "info_limpieza" },
                    { id: "h-info", key: "H", label: "Hablar con un asesor", nextStepId: "ack_and_pause" }
                ]
            },
            "info_implantes": {
                id: "info_implantes",
                title: "Info Implantes",
                message: "🦷 **Implantes RAD**\n\nAcá tenés la información detallada: Entrá a este link para saber sobre nuestros tipos de implantes y materiales: https://rad.jaef.com/implantes\n\nPara realizar el pago del pre-presupuesto y reservar tu turno, usá este link: https://mpago.la/implantes-rad",
                options: [
                    { id: "opt-next-1", key: "A", label: "Quiero este tratamiento", nextStepId: "esperando_pago_reserva" },
                    { id: "h-imp", key: "H", label: "Hablar con un asesor", nextStepId: "ack_and_pause" }
                ]
            },
            "info_protesis": {
                id: "info_protesis",
                title: "Info Prótesis",
                message: "🦷 **Prótesis RAD**\n\nAcá tenés la información: Entrá a este link para saber sobre prótesis fijas y removibles: https://rad.jaef.com/protesis\n\nPodés realizar el pago de la seña aquí: https://mpago.la/protesis-rad",
                options: [
                    { id: "opt-next-2", key: "A", label: "Quiero este tratamiento", nextStepId: "esperando_pago_reserva" },
                    { id: "h-prot", key: "H", label: "Hablar con un asesor", nextStepId: "ack_and_pause" }
                ]
            },
            "info_estetica": {
                id: "info_estetica",
                title: "Info Estética",
                message: "✨ **Estética Dental RAD**\n\nAcá tenés la información: Entrá a este link para conocer nuestros diseños de sonrisa: https://rad.jaef.com/estetica\n\nRealizá el pago de tu sesión aquí: https://mpago.la/estetica-rad",
                options: [
                    { id: "opt-next-3", key: "A", label: "Quiero este tratamiento", nextStepId: "esperando_pago_reserva" },
                    { id: "h-est", key: "H", label: "Hablar con un asesor", nextStepId: "ack_and_pause" }
                ]
            },
            "info_limpieza": {
                id: "info_limpieza",
                title: "Info Limpieza",
                message: "🧼 **Limpieza RAD**\n\nAcá tenés la información: Entrá a este link para saber sobre nuestro sistema de limpieza profunda: https://rad.jaef.com/limpieza\n\nAboná tu turno de limpieza aquí: https://mpago.la/limpieza-rad",
                options: [
                    { id: "opt-next-4", key: "A", label: "Quiero este tratamiento", nextStepId: "esperando_pago_reserva" },
                    { id: "h-limp", key: "H", label: "Hablar con un asesor", nextStepId: "ack_and_pause" }
                ]
            },
            "esperando_pago_reserva": {
                id: "esperando_pago_reserva",
                title: "Esperando Pago de Reserva",
                message: "¡Excelente elección! 🦷\n\nPara reservar tu lugar, por favor:\n1️⃣ Realizá el pago de la seña en el link del tratamiento.\n2️⃣ Mandame el **comprobante** (foto o PDF) por acá.\n\n*En cuanto reciba el comprobante, te pediré tus datos finales para agendarte.*",
                options: [
                    { id: "h-pay", key: "H", label: "Hablar con un asesor", nextStepId: "ack_and_pause" }
                ]
            },
            "ack_and_pause": {
                id: "ack_and_pause",
                title: "Confirmación y Pausa",
                message: "✅ Recibido.",
                options: [],
                actions: { pauseConversation: true, addTags: ["solicitud-humana"] }
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
            },
            "derivacion_paciente": {
                id: "derivacion_paciente",
                title: "Atencion del Paciente",
                message: "Por favor dejá tu mensaje. 👇",
                options: [],
                nextStepId: "ack_and_pause",
                actions: { addTags: ["atencion-paciente"] }
            },
            "derivacion_profesional": {
                id: "derivacion_profesional",
                title: "Derivación Profesional",
                message: "🦷 **Área Profesional**\n\n¿Ya trabajás con R.A.D. o querés presentarnos una propuesta?",
                options: [
                    { id: "prof-1", key: "A", label: "Ya trabajo con ustedes / Soy Staff", nextStepId: "profesional_activo_msg" },
                    { id: "prof-2", key: "B", label: "Quiero postularme / Ofrecer productos", nextStepId: "profesional_postulante_msg" }
                ]
            },
            "profesional_activo_msg": {
                id: "profesional_activo_msg",
                title: "Mensaje Profesional Activo",
                message: "Dejanos tu consulta aquí. 👇",
                options: [],
                nextStepId: "ack_and_pause",
                actions: { addTags: ["staff-profesional"] }
            },
            "profesional_postulante_msg": {
                id: "profesional_postulante_msg",
                title: "Mensaje Postulante",
                message: "Dejanos tu propuesta aquí. 👇",
                options: [],
                nextStepId: "ack_and_pause",
                actions: { addTags: ["propuesta-comercial"] }
            }
        };

        const flow = await Flow.create({
            name: flowName,
            description: "Flujo RAD - Versión NUCLEAR V103",
            isActive: true,
            activationRules: {
                sources: { meta_ads: true, organic: true },
                whatsappStatus: { agendado: true, no_agendado: true },
                priority: 1000, // Top priority
                forceRestart: true,
                activationOffset: 2
            },
            draft: { entryStepId: "welcome", steps: steps },
            published: {
                entryStepId: "welcome",
                steps: steps,
                fallbackMessage: "No entiendo esa opción. Por favor elegí una válida o escribí M para volver al inicio."
            },
            publishedVersion: 103,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log(`✅ NUCLEAR FIX COMPLETE. New Flow "${flowName}" seeded at Version ${flow.publishedVersion}.`);
        process.exit(0);

    } catch (e) {
        console.error("❌ NUCLEAR ERROR:", e);
        process.exit(1);
    }
}

nuclearFix();
