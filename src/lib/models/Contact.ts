// @ts-nocheck
import mongoose, { Schema, Document } from 'mongoose';
import { Contact as IContact, LeadSource, LeadStatus } from '../types';

interface IContactDoc extends Omit<IContact, 'id'>, Document {
    name?: string;
    email?: string;
    events?: { event: string; date: Date }[];
}

const ContactSchema = new Schema<IContactDoc>({
    phone: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    firstSeenAt: { type: Date, default: Date.now as any },
    lastSeenAt: { type: Date, default: Date.now as any },
    source: {
        type: String,
        enum: ['meta_ads', 'organic'],
        required: true,
    },
    status: {
        type: String,
        enum: ['agendado', 'no_agendado', 'pendiente'], // Keeping pendiente just for backward DB compat, but new default is no_agendado
        default: 'no_agendado',
    },
    meta: { type: Map, of: String },
    tags: [String],
    events: [{
        event: String,
        date: { type: Date, default: Date.now }
    }],
});

// Update lastSeenAt on save
ContactSchema.pre('save', function (next) {
    if (this.isModified('status') || this.isModified('tags')) {
        this.lastSeenAt = new Date();
    }
    next();
});

export default mongoose.models.Contact || mongoose.model<IContactDoc>('Contact', ContactSchema);
