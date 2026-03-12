import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
