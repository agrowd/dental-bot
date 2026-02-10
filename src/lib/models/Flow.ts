// @ts-nocheck
import mongoose, { Schema, Document } from 'mongoose';
import { FlowDocument as IFlowDocument, ActivationRules, FlowStep } from '../types';

interface IFlowDoc extends Omit<IFlowDocument, 'id'>, Document { }

const ActivationRulesSchema = new Schema<ActivationRules>({
    sources: {
        meta_ads: { type: Boolean, default: true },
        organic: { type: Boolean, default: true },
    },
    whatsappStatus: {
        agendado: { type: Boolean, default: false },
        no_agendado: { type: Boolean, default: true },
    },
    priority: { type: Number, default: 1 },
    forceRestart: { type: Boolean, default: false },
}, { _id: false });

const StepOptionSchema = new Schema({
    id: String,
    key: String,
    label: String,
    nextStepId: String,
}, { _id: false });

const StepActionsSchema = new Schema({
    setLeadStatus: { type: String, enum: ['agendado', 'no_agendado', 'pendiente'] },
    addTags: [String],
    pauseConversation: Boolean,
}, { _id: false });

const FlowStepSchema = new Schema<FlowStep>({
    id: String,
    title: String,
    message: String,
    options: [StepOptionSchema],
    nextStepId: String,
    actions: StepActionsSchema,
}, { _id: false });

const FlowContentSchema = new Schema({
    entryStepId: String,
    fallbackMessage: { type: String, default: 'No entendí esa opción. Por favor elegí una de las opciones válidas (ej: A).' },
    steps: { type: Schema.Types.Mixed },
}, { _id: false });

const FlowSchema = new Schema<IFlowDoc>({
    name: { type: String, required: true },
    description: String,
    activationRules: { type: ActivationRulesSchema, required: true },
    draft: { type: FlowContentSchema, required: true },
    published: { type: FlowContentSchema, default: null },
    publishedVersion: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now as any },
    updatedAt: { type: Date, default: Date.now as any },
});

// Update timestamp on save
FlowSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.models.Flow || mongoose.model<IFlowDoc>('Flow', FlowSchema);
