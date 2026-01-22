// Types for OdontoBot

// Dynamic option - can have any key, not just A/B/C/D
export interface StepOption {
  id: string;        // Unique ID for this option
  key: string;       // Display key (A, B, C, D, 1, 2, etc.)
  label: string;     // Option text
  nextStepId: string; // Where to go when selected
}

export interface StepActions {
  setLeadStatus?: 'agendado' | 'no_agendado' | 'pendiente';
  addTags?: string[];
  pauseConversation?: boolean;
}

export interface FlowStep {
  id: string;
  title: string;
  message: string;
  options: StepOption[];  // Dynamic array of options (can add/remove)
  actions?: StepActions;
}

export interface Flow {
  id: string;
  name: string;
  entryStepId: string;
  steps: Record<string, FlowStep>;
  publishedVersion: number;
  updatedAt: string;
}

// Activation rules determine when a flow is triggered
export interface ActivationRules {
  // Source filter: which sources activate this flow
  sources: {
    meta_ads: boolean;    // Viene de anuncio de Meta
    organic: boolean;     // Viene orgánico (escribió directo)
  };
  // WhatsApp contact status: is the contact saved in clinic's phone?
  whatsappStatus: {
    agendado: boolean;     // Contacto GUARDADO en la agenda del teléfono de la clínica (paciente conocido)
    no_agendado: boolean;  // Contacto NO guardado (número desconocido)
  };
  // Priority: higher number = higher priority when multiple flows match
  priority: number;
  // Always trigger: force restart even if conversation exists
  forceRestart?: boolean;
}

export interface FlowDocument {
  id: string;
  name: string;
  description?: string;
  activationRules: ActivationRules;
  draft: {
    entryStepId: string;
    fallbackMessage?: string;
    steps: Record<string, FlowStep>;
  };
  published: {
    entryStepId: string;
    fallbackMessage?: string;
    steps: Record<string, FlowStep>;
  } | null;
  publishedVersion: number;
  isActive: boolean;  // Enable/disable flow
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus = 'agendado' | 'no_agendado' | 'pendiente';
export type LeadSource = 'meta_ads' | 'organic';
export type ConversationState = 'active' | 'paused' | 'closed';

export interface Contact {
  id: string;
  phone: string;
  firstSeenAt: string;
  lastSeenAt: string;
  source: LeadSource;
  status: LeadStatus;
  meta?: Record<string, string>;
  tags: string[];
}

export interface Conversation {
  id: string;
  phone: string;
  flowVersion: number;
  currentStepId: string;
  state: ConversationState;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  phone: string;
  direction: 'in' | 'out';
  text: string;
  timestamp: string;
}

export interface Admin {
  id: string;
  email: string;
  createdAt: string;
}

// Validation result
export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
