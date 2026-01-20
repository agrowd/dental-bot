// @ts-nocheck
import mongoose, { Schema, Document } from 'mongoose';
import { Conversation as IConversation, ConversationState } from '../types';

interface IConversationDoc extends Omit<IConversation, 'id'>, Document {
    loopDetection: {
        currentStepId: string;
        messagesInCurrentStep: number;
        lastStepChangeAt: Date;
    };
}

const ConversationSchema = new Schema<IConversationDoc>({
    phone: {
        type: String,
        required: true,
        index: true,
    },
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
    createdAt: { type: Date, default: Date.now as any },
    updatedAt: { type: Date, default: Date.now as any },
});

// Update timestamp on save
ConversationSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.models.Conversation || mongoose.model<IConversationDoc>('Conversation', ConversationSchema);
