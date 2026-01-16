import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
    email: string;
    passwordHash: string;
    createdAt: Date;
}

const AdminSchema = new Schema<IAdmin>({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);
