import mongoose, { Schema, Document } from 'mongoose';
import { Message as IMessage } from '../types';

interface IMessageDoc extends Omit<IMessage, 'id'>, Document { }

const MessageSchema = new Schema<IMessageDoc>({
    phone: {
        type: String,
        required: true,
        index: true,
    },
    direction: {
        type: String,
        enum: ['in', 'out'],
        required: true,
    },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now as any, index: true },
});

// Compound index for efficient queries
MessageSchema.index({ phone: 1, timestamp: -1 });

export default mongoose.models.Message || mongoose.model<IMessageDoc>('Message', MessageSchema);
