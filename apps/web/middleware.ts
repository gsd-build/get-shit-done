/**
 * Next.js Middleware for Cookie-Based Authentication
 *
 * Enabled when AUTH_USERNAME and AUTH_PASSWORD environment variables are set.
 * Redirects unauthenticated users to /login.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Explicitly satisfy browser favicon requests in environments
  // where no branded icon asset is configured yet.
  if (pathname === '/favicon.ico') {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  }

  // Skip auth for static files, Next.js internals, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/login' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('gsd-auth');

  if (!authCookie?.value) {
    // Redirect to login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists, allow request
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
};
