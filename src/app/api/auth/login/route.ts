import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { dbConnect } from '@/lib/db';
import Admin from '@/lib/models/Admin';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password required' },
                { status: 400 }
            );
        }

        // Find admin
        const admin = await Admin.findOne({ email: email.toLowerCase() });

        if (!admin) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await bcrypt.compare(password, admin.passwordHash);

        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Generate token
        const token = signToken({
            adminId: admin._id.toString(),
            email: admin.email,
        });

        // Set cookie
        const response = NextResponse.json({
            success: true,
            admin: {
                id: admin._id.toString(),
                email: admin.email,
            },
        });

        response.cookies.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 60, // 30 minutes
            path: '/',
        });

        // Set client-readable expiry cookie
        response.cookies.set('session-expiry', (Date.now() + 30 * 60 * 1000).toString(), {
            httpOnly: false, // Client can read
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 60,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
