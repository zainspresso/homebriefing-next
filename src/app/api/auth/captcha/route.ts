import { NextRequest, NextResponse } from 'next/server';
import { homebriefingClient, sessionStore } from '@/lib/homebriefing';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  const pending = sessionStore.getPendingLogin(sessionId);
  if (!pending) {
    return NextResponse.json(
      { error: 'Invalid or expired session' },
      { status: 401 }
    );
  }

  try {
    const captchaBuffer = await homebriefingClient.getCaptcha(pending.cookies);

    return new Response(captchaBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Captcha fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch captcha' },
      { status: 500 }
    );
  }
}
