// Mock data for frontend development
import { FlowDocument, Contact, Conversation, Message } from './types';

// Helper to create option
const opt = (key: string, label: string, nextStepId: string) => ({
    id: `opt-${key}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    key,
    label,
    nextStepId
});

export const mockFlows: FlowDocument[] = [
    {
        id: 'flow-1',
        name: 'Flujo para Contactos NO Agendados',
        description: 'Para números desconocidos (no guardados en la agenda)',
        activationRules: {
            sources: { meta_ads: true, organic: true },
            whatsappStatus: { agendado: false, no_agendado: true },
            priority: 1
        },
        isActive: true,
        draft: {
            entryStepId: 'start',
            steps: {
                'start': {
                    id: 'start',
                    title: 'Bienvenida',
                    message: 'Hola 👋 Soy el asistente virtual de la Clínica Dental. ¿En qué puedo ayudarte?\n\nElegí una opción:',
                    options: [
                        { id: 'opt-1', key: 'A', label: 'Agendar turno', nextStepId: 'turnos' },
                        { id: 'opt-2', key: 'B', label: 'Consultar precios', nextStepId: 'precios' },
                        { id: 'opt-3', key: 'C', label: 'Ubicación y horarios', nextStepId: 'ubicacion' },
                        { id: 'opt-4', key: 'D', label: 'Hablar con un asesor', nextStepId: 'handoff' }
                    ]
                },
                'turnos': {
                    id: 'turnos',
                    title: 'Selección de Servicio',
                    message: '¡Perfecto! ¿Para qué servicio querés agendar?',
                    options: [
                        { id: 'opt-5', key: 'A', label: 'Carillas dentales', nextStepId: 'horario' },
                        { id: 'opt-6', key: 'B', label: 'Blanqueamiento', nextStepId: 'horario' },
                        { id: 'opt-7', key: 'C', label: 'Limpieza dental', nextStepId: 'horario' },
                        { id: 'opt-8', key: 'D', label: 'Consulta general', nextStepId: 'horario' },
                        { id: 'opt-9', key: 'E', label: 'Ortodoncia', nextStepId: 'horario' }
                    ],
                    actions: { addTags: ['turno'] }
                },
                'horario': {
                    id: 'horario',
                    title: 'Preferencia Horaria',
                    message: 'Genial. ¿En qué horario te queda mejor?',
                    options: [
                        { id: 'opt-10', key: 'A', label: 'Mañana (9-12hs)', nextStepId: 'confirmar' },
                        { id: 'opt-11', key: 'B', label: 'Tarde (14-18hs)', nextStepId: 'confirmar' },
                        { id: 'opt-12', key: 'C', label: 'Noche (18-21hs)', nextStepId: 'confirmar' }
                    ]
                },
                'confirmar': {
                    id: 'confirmar',
                    title: 'Confirmación',
                    message: '✅ ¡Listo! Registramos tu solicitud.\n\nUn asesor te contactará pronto.',
                    options: [
                        { id: 'opt-13', key: 'A', label: 'Volver al inicio', nextStepId: 'start' }
                    ]
                },
                'precios': {
                    id: 'precios',
                    title: 'Consulta de Precios',
                    message: '💰 Nuestros servicios:\n\n• Limpieza: $15.000\n• Blanqueamiento: $45.000\n• Carillas: desde $80.000',
                    options: [
                        { id: 'opt-14', key: 'A', label: 'Agendar turno', nextStepId: 'turnos' },
                        { id: 'opt-15', key: 'B', label: 'Hablar con asesor', nextStepId: 'handoff' },
                        { id: 'opt-16', key: 'C', label: 'Volver al inicio', nextStepId: 'start' }
                    ]
                },
                'ubicacion': {
                    id: 'ubicacion',
                    title: 'Ubicación',
                    message: '📍 Av. Corrientes 1234, CABA\n🕐 Lun-Vie: 9-21hs | Sáb: 9-14hs',
                    options: [
                        { id: 'opt-17', key: 'A', label: 'Agendar turno', nextStepId: 'turnos' },
                        { id: 'opt-18', key: 'B', label: 'Volver al inicio', nextStepId: 'start' }
                    ]
                },
                'handoff': {
                    id: 'handoff',
                    title: 'Derivar a Humano',
                    message: '👤 Un asesor te atenderá en breve.\n\nPodés escribir tu consulta.',
                    options: [
                        { id: 'opt-19', key: 'A', label: 'Volver al menú', nextStepId: 'start' }
                    ],
                    actions: { pauseConversation: true }
                }
            }
        },
        published: null,
        publishedVersion: 0,
        createdAt: '2024-01-10T10:00:00Z',
        updatedAt: '2024-01-15T14:30:00Z'
    },
    {
        id: 'flow-2',
        name: 'Flujo para Contactos AGENDADOS',
        description: 'Para pacientes conocidos (guardados en la agenda)',
        activationRules: {
            sources: { meta_ads: true, organic: true },
            whatsappStatus: { agendado: true, no_agendado: false },
            priority: 10
        },
        isActive: true,
        draft: {
            entryStepId: 'bienvenida',
            steps: {
                'bienvenida': {
                    id: 'bienvenida',
                    title: 'Bienvenida Paciente',
                    message: '👋 ¡Hola! Qué gusto verte de nuevo.\n\n¿En qué podemos ayudarte?',
                    options: [
                        { id: 'opt-20', key: 'A', label: 'Consultar mi turno', nextStepId: 'consultar' },
                        { id: 'opt-21', key: 'B', label: 'Nuevo turno', nextStepId: 'nuevo' },
                        { id: 'opt-22', key: 'C', label: 'Hablar con recepción', nextStepId: 'handoff' }
                    ]
                },
                'consultar': {
                    id: 'consultar',
                    title: 'Consultar Turno',
                    message: '📅 Consultando tus turnos...\n\nRecepción te confirmará los detalles.',
                    options: [
                        { id: 'opt-23', key: 'A', label: 'Volver', nextStepId: 'bienvenida' }
                    ],
                    actions: { pauseConversation: true }
                },
                'nuevo': {
                    id: 'nuevo',
                    title: 'Nuevo Turno',
                    message: '¿Para qué servicio?',
                    options: [
                        { id: 'opt-24', key: 'A', label: 'Control/Limpieza', nextStepId: 'confirmar' },
                        { id: 'opt-25', key: 'B', label: 'Tratamiento', nextStepId: 'confirmar' },
                        { id: 'opt-26', key: 'C', label: 'Volver', nextStepId: 'bienvenida' }
                    ]
                },
                'confirmar': {
                    id: 'confirmar',
                    title: 'Confirmación',
                    message: '✅ ¡Registrado! Te contactamos pronto.',
                    options: [
                        { id: 'opt-27', key: 'A', label: 'Volver', nextStepId: 'bienvenida' }
                    ]
                },
                'handoff': {
                    id: 'handoff',
                    title: 'Recepción',
                    message: '👤 Recepción te atenderá en breve.',
                    options: [
                        { id: 'opt-28', key: 'A', label: 'Volver', nextStepId: 'bienvenida' }
                    ],
                    actions: { pauseConversation: true }
                }
            }
        },
        published: null,
        publishedVersion: 0,
        createdAt: '2024-01-12T10:00:00Z',
        updatedAt: '2024-01-15T14:30:00Z'
    }
];

export const mockFlow = mockFlows[0];

export const mockContacts: Contact[] = [
    {
        id: 'c1',
        phone: '+5491155551234',
        firstSeenAt: '2024-01-15T10:30:00Z',
        lastSeenAt: '2024-01-15T11:45:00Z',
        source: 'meta_ads',
        status: 'agendado',
        tags: ['turno', 'carillas'],
        meta: { campaign: 'carillas_enero' }
    },
    {
        id: 'c2',
        phone: '+5491155555678',
        firstSeenAt: '2024-01-15T09:00:00Z',
        lastSeenAt: '2024-01-15T09:15:00Z',
        source: 'meta_ads',
        status: 'pendiente',
        tags: ['consulta']
    }
];

export const mockConversations: Conversation[] = [
    {
        id: 'conv1',
        phone: '+5491155551234',
        flowVersion: 1,
        currentStepId: 'confirmar',
        state: 'active',
        tags: ['turno'],
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T11:45:00Z'
    }
];

export const mockMessages: Record<string, Message[]> = {
    '+5491155551234': [
        { id: 'm1', phone: '+5491155551234', direction: 'in', text: 'Hola', timestamp: '2024-01-15T10:30:00Z' },
        { id: 'm2', phone: '+5491155551234', direction: 'out', text: 'Hola 👋 Soy el asistente virtual.\n\nA) Agendar turno\nB) Precios\nC) Ubicación', timestamp: '2024-01-15T10:30:05Z' }
    ]
};

export function getMessagesForPhone(phone: string): Message[] {
    return mockMessages[phone] || [];
}

export const mockStats = {
    totalLeads: 47,
    leadsThisWeek: 12,
    agendados: 23,
    pendientes: 15,
    noAgendados: 9,
    activeConversations: 8,
    pausedConversations: 3
};
