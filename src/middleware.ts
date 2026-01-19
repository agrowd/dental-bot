import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('auth-token');
    const isLoginPage = request.nextUrl.pathname === '/login';
    const isAdminPage = request.nextUrl.pathname.startsWith('/admin');
    const isRootPage = request.nextUrl.pathname === '/';

    // Root -> Login
    if (isRootPage) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // If trying to access admin without token -> Redirect to login
    if (isAdminPage && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // If trying to access login WITH token -> Redirect to admin
    if (isLoginPage && token) {
        return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/login', '/'],
};
