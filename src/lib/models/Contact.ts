// @ts-nocheck
import mongoose, { Schema, Document } from 'mongoose';
import { Contact as IContact, LeadSource, LeadStatus } from '../types';

interface IContactDoc extends Omit<IContact, 'id'>, Document { }

const ContactSchema = new Schema<IContactDoc>({
    phone: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    firstSeenAt: { type: Date, default: Date.now as any },
    lastSeenAt: { type: Date, default: Date.now as any },
    source: {
        type: String,
        enum: ['meta_ads', 'organic'],
        required: true,
    },
    status: {
        type: String,
        enum: ['agendado', 'no_agendado', 'pendiente'],
        default: 'pendiente',
    },
    meta: { type: Map, of: String },
    tags: [String],
});

// Update lastSeenAt on save
ContactSchema.pre('save', function (next) {
    if (this.isModified('status') || this.isModified('tags')) {
        this.lastSeenAt = new Date();
    }
    next();
});

export default mongoose.models.Contact || mongoose.model<IContactDoc>('Contact', ContactSchema);
