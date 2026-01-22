import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Setting from '@/lib/models/Setting';

// GET /api/settings - Fetch settings
export async function GET(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const key = searchParams.get('key');

        if (key) {
            const setting = await Setting.findOne({ key });
            return NextResponse.json({ setting: setting?.value || null });
        }

        const settings = await Setting.find();
        return NextResponse.json({ settings });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Get settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/settings - Update or create setting
export async function PUT(req: NextRequest) {
    try {
        await requireAuth(req);
        await dbConnect();

        const { key, value } = await req.json();

        if (!key) {
            return NextResponse.json({ error: 'Key is required' }, { status: 400 });
        }

        const setting = await Setting.findOneAndUpdate(
            { key },
            { value },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true, setting });
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('Update settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
