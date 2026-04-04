import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const BOT_URL = process.env.BOT_URL || 'http://bot-runner:3000';

export async function POST(req: NextRequest) {
    try {
        await requireAuth(req);
        
        const body = await req.json();
        
        if (!body.phone || !body.targetStepId) {
            return NextResponse.json({ error: 'Faltan parámetros phone o targetStepId' }, { status: 400 });
        }

        const res = await fetch(`${BOT_URL}/bot/force-transition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        
        if (!res.ok) {
            return NextResponse.json({ error: data.error || 'Error en el bot' }, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('API force-transition error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
