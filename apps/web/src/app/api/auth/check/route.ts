import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const authConfigured = Boolean(
    process.env['AUTH_USERNAME'] && process.env['AUTH_PASSWORD']
  );

  if (!authConfigured) {
    return NextResponse.json({ authenticated: true, authConfigured: false });
  }

  const cookieStore = await cookies();
  const authCookie = cookieStore.get('gsd-auth');

  if (authCookie?.value) {
    return NextResponse.json({ authenticated: true, authConfigured: true });
  }

  return NextResponse.json(
    { authenticated: false, authConfigured: true },
    { status: 401 }
  );
}
