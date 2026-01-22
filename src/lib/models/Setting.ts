import mongoose, { Schema, Document } from 'mongoose';

export interface ISetting extends Document {
    key: string;
    value: any;
    updatedAt: Date;
}

const SettingSchema = new Schema({
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

SettingSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.models.Setting || mongoose.model<ISetting>('Setting', SettingSchema);
