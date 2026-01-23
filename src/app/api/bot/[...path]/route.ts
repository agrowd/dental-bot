
import { NextRequest, NextResponse } from 'next/server';
import BotInstance from '@/lib/models/BotInstance';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;

    // Path structure: /api/bot/[instanceId]/[...endpoint]
    // Example: /api/bot/bot-123/status
    if (path.length < 2) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const instanceId = path[0];
    const endpoint = path.slice(1).join('/');

    try {
        const instance = await BotInstance.findOne({ id: instanceId });
        if (!instance) {
            return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
        }

        const targetUrl = `http://localhost:${instance.port}/bot/${endpoint}`;
        const res = await fetch(targetUrl);
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error(`Proxy Error (GET) for ${instanceId}:`, error);
        return NextResponse.json(
            { error: 'Error connecting to bot service' },
            { status: 502 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;

    if (path.length < 2) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const instanceId = path[0];
    const endpoint = path.slice(1).join('/');

    try {
        const instance = await BotInstance.findOne({ id: instanceId });
        if (!instance) {
            return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
        }

        const targetUrl = `http://localhost:${instance.port}/bot/${endpoint}`;
        const body = await request.json().catch(() => ({}));
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            return NextResponse.json(data, { status: res.status });
        }

        return new NextResponse(null, { status: res.status });

    } catch (error) {
        console.error(`Proxy Error (POST) for ${instanceId}:`, error);
        return NextResponse.json(
            { error: 'Error connecting to bot service' },
            { status: 502 }
        );
    }
}
