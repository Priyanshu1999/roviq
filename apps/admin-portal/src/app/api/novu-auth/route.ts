import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { subscriberId } = body;

  if (!subscriberId || typeof subscriberId !== 'string') {
    return NextResponse.json({ error: 'subscriberId required' }, { status: 400 });
  }

  const secretKey = process.env.NOVU_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'NOVU_SECRET_KEY not configured' }, { status: 500 });
  }

  const hash = createHmac('sha256', secretKey).update(subscriberId).digest('hex');

  return NextResponse.json({ subscriberHash: hash });
}
