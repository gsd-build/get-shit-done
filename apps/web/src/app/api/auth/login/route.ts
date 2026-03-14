import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_USERNAME = process.env['AUTH_USERNAME'];
const AUTH_PASSWORD = process.env['AUTH_PASSWORD'];

export async function POST(request: Request) {
  try {
    const authConfigured = Boolean(AUTH_USERNAME && AUTH_PASSWORD);
    if (!authConfigured) {
      return NextResponse.json({ success: true, authConfigured: false });
    }

    const body = await request.json();
    const { username, password } = body;

    // Check if credentials match
    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      // Create a simple auth token
      const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');

      // Set auth cookie using response headers
      const response = NextResponse.json({ success: true });
      response.cookies.set('gsd-auth', token, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
