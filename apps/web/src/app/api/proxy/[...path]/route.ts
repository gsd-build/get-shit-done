import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000';
const AUTH_USERNAME = process.env['AUTH_USERNAME'];
const AUTH_PASSWORD = process.env['AUTH_PASSWORD'];

/**
 * Proxy API requests to the backend with authentication.
 * This allows the frontend to make authenticated API calls without exposing credentials.
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Check if user is authenticated
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('gsd-auth');

  if (!authCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await params;
  const apiPath = '/api/' + path.join('/');
  const url = new URL(apiPath, API_BASE);

  // Forward query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Build headers with Basic Auth
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (AUTH_USERNAME && AUTH_PASSWORD) {
    const credentials = Buffer.from(`${AUTH_USERNAME}:${AUTH_PASSWORD}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  try {
    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : null,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from API' },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
