// @ts-nocheck
import mongoose, { Schema, Document } from 'mongoose';
import { Conversation as IConversation, ConversationState } from '../types';

interface IConversationDoc extends Omit<IConversation, 'id'>, Document {
    loopDetection: {
        currentStepId: string;
        messagesInCurrentStep: number;
        lastStepChangeAt: Date;
    };
    history: string[]; // Stack of step IDs visited
    visitedMediaSteps: string[]; // Steps where media was already sent (skip on revisit)
    handoffAckSent: boolean; // True after the first "ack" message is sent in a paused/handoff state
    forceUnread: boolean; // When true, bot re-marks chat as unread after every interaction until human clears it
    formState: {
        active: boolean;      // Currently collecting data
        pendingStepId: string; // Step to go to after form completes
        currentField: string; // 'name' | 'email'
        name: string;
        email: string;
        attempts: number;     // Retry counter for validation
    };
}

const ConversationSchema = new Schema<IConversationDoc>({
    phone: {
        type: String,
        required: true,
        index: true,
    },
    flowId: { type: Schema.Types.ObjectId, ref: 'Flow', required: false },
    flowVersion: { type: Number, required: true },
    currentStepId: { type: String, required: true },
    state: {
        type: String,
        enum: ['active', 'paused', 'closed'],
        default: 'active',
    },
    tags: [String],
    loopDetection: {
        currentStepId: { type: String, default: '' },
        messagesInCurrentStep: { type: Number, default: 0 },
        lastStepChangeAt: { type: Date, default: Date.now as any },
    },
    history: { type: [String], default: [] },
    visitedMediaSteps: { type: [String], default: [] },
    handoffAckSent: { type: Boolean, default: false },
    forceUnread: { type: Boolean, default: true }, // Default: always mark as unread until human reads
    formState: {
        active: { type: Boolean, default: false },
        pendingStepId: { type: String, default: '' },
        currentField: { type: String, default: '' },
        name: { type: String, default: '' },
        email: { type: String, default: '' },
        attempts: { type: Number, default: 0 },
    },
    createdAt: { type: Date, default: Date.now as any },
    updatedAt: { type: Date, default: Date.now as any },
});

// Update timestamp on save
ConversationSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.models.Conversation || mongoose.model<IConversationDoc>('Conversation', ConversationSchema);
