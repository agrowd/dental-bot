
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const pathString = path.join('/');
    const targetUrl = `http://dental-bot-runner:4000/bot/${pathString}`;

    try {
        const res = await fetch(targetUrl);
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Proxy Error (GET):', error);
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
    const pathString = path.join('/');
    const targetUrl = `http://dental-bot-runner:4000/bot/${pathString}`;

    try {
        const body = await request.json().catch(() => ({}));
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        // Check if response has body
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            return NextResponse.json(data, { status: res.status });
        }

        return new NextResponse(null, { status: res.status });

    } catch (error) {
        console.error('Proxy Error (POST):', error);
        return NextResponse.json(
            { error: 'Error connecting to bot service' },
            { status: 502 }
        );
    }
}
