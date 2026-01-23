import mongoose, { Schema, Document } from 'mongoose';

export interface IBotInstance extends Document {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'starting' | 'error';
    port: number;
    whatsappNumber?: string;
    createdAt: Date;
    updatedAt: Date;
}

const BotInstanceSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: {
        type: String,
        enum: ['online', 'offline', 'starting', 'error'],
        default: 'offline'
    },
    port: { type: Number, required: true, unique: true },
    whatsappNumber: { type: String },
}, {
    timestamps: true
});

export default mongoose.models.BotInstance || mongoose.model<IBotInstance>('BotInstance', BotInstanceSchema);
