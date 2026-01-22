import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Appointment from '@/lib/models/Appointment';

// GET /api/appointments - List appointments ordered by date
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const appointments = await Appointment.find().sort({ date: 1 });
        return NextResponse.json({ appointments });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Get appointments error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/appointments/[id] - Update status/notes
// Will implement in a separate file or handle here if id is in query
export async function PATCH(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { id, status, notes } = await req.json();
        const appointment = await Appointment.findByIdAndUpdate(id, { status, notes }, { new: true });

        return NextResponse.json({ success: true, appointment });
    } catch (error: any) {
        console.error('Update appointment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
