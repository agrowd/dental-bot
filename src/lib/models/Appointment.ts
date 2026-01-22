import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
    phone: string;
    patientName?: string;
    patientDni?: string;
    service?: string;
    date: Date; // Actual calculated date
    dayName: string; // e.g., 'Martes 23/01'
    timeSlot: string; // e.g., '14:30'
    status: 'pending' | 'confirmed' | 'cancelled';
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AppointmentSchema = new Schema({
    phone: { type: String, required: true },
    patientName: String,
    patientDni: String,
    service: String,
    date: { type: Date, required: true },
    dayName: String,
    timeSlot: String,
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
    notes: String,
}, { timestamps: true });

export default mongoose.models.Appointment || mongoose.model<IAppointment>('Appointment', AppointmentSchema);
