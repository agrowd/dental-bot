import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

export interface JWTPayload {
    adminId: string;
    email: string;
}

export function signToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
        return null;
    }
}

export function getTokenFromRequest(req: NextRequest): string | null {
    // Try to get from cookie
    const cookieToken = req.cookies.get('auth-token')?.value;
    if (cookieToken) return cookieToken;

    // Try Authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return null;
}

export async function requireAuth(req: NextRequest): Promise<JWTPayload> {
    const token = getTokenFromRequest(req);

    if (!token) {
        throw new Error('Unauthorized: No token provided');
    }

    const payload = verifyToken(token);

    if (!payload) {
        throw new Error('Unauthorized: Invalid token');
    }

    return payload;
}
