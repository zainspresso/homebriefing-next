import { NextRequest, NextResponse } from 'next/server';
import { homebriefingClient, sessionStore } from '@/lib/homebriefing';
import { cookies as getCookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, username, password, captcha } = await request.json();

    if (!sessionId || !username || !password || !captcha) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const pending = sessionStore.getPendingLogin(sessionId);
    if (!pending) {
      return NextResponse.json(
        { error: 'Invalid or expired session. Please refresh and try again.' },
        { status: 401 }
      );
    }

    // Submit login to Homebriefing
    const result = await homebriefingClient.submitLogin(
      pending.cookies,
      pending.token,
      username,
      password,
      captcha
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Login failed' },
        { status: 401 }
      );
    }

    // Activate the session with full credentials
    sessionStore.activateSession(
      sessionId,
      result.cookies!,
      result.token!,
      result.userSession!
    );

    // Set our session cookie
    const cookieStore = await getCookies();
    cookieStore.set('hb-session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60, // 30 minutes
      path: '/',
    });

    return NextResponse.json({
      success: true,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
