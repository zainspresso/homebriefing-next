import { NextResponse } from 'next/server';
import { homebriefingClient, sessionStore } from '@/lib/homebriefing';

export async function POST() {
  try {
    // Initialize login with Homebriefing
    const { cookies, token } = await homebriefingClient.initLogin();

    // Create pending session
    const sessionId = sessionStore.createPendingLogin(cookies, token);

    return NextResponse.json({
      sessionId,
      message: 'Login initialized. Fetch captcha and submit credentials.',
    });
  } catch (error) {
    console.error('Init login error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize login' },
      { status: 500 }
    );
  }
}
