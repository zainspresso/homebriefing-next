import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/homebriefing';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('hb-session')?.value;

    if (sessionId) {
      sessionStore.deleteSession(sessionId);
    }

    cookieStore.delete('hb-session');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
