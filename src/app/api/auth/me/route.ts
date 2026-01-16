import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Admin from '@/lib/models/Admin';

export async function GET(req: NextRequest) {
    try {
        const payload = await requireAuth(req);
        await dbConnect();

        const admin = await Admin.findById(payload.adminId);

        if (!admin) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            admin: {
                id: admin._id.toString(),
                email: admin.email,
            },
        });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
