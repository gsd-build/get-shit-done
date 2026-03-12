/**
 * Next.js Middleware for HTTP Basic Authentication
 *
 * Enabled when AUTH_USERNAME and AUTH_PASSWORD environment variables are set.
 * Protects all routes except static assets and API routes.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_USERNAME = process.env['AUTH_USERNAME'];
const AUTH_PASSWORD = process.env['AUTH_PASSWORD'];
const AUTH_ENABLED = Boolean(AUTH_USERNAME && AUTH_PASSWORD);

export function middleware(request: NextRequest) {
  // Skip auth if not enabled
  if (!AUTH_ENABLED) {
    return NextResponse.next();
  }

  // Skip auth for static files and Next.js internals
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for Basic Auth header
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="GSD Labs"',
      },
    });
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials ?? '', 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      return NextResponse.next();
    }

    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="GSD Labs"',
      },
    });
  } catch {
    return new NextResponse('Invalid authentication header', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="GSD Labs"',
      },
    });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
