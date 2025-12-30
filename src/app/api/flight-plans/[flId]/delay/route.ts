import { NextRequest, NextResponse } from 'next/server';
import { homebriefingClient, sessionStore } from '@/lib/homebriefing';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ flId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('hb-session')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const session = sessionStore.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
    }

    const { flId } = await params;
    const flightPlanId = parseInt(flId);

    if (isNaN(flightPlanId)) {
      return NextResponse.json(
        { error: 'Invalid flight plan ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { newEobt } = body;

    // Validate EOBT format (HHMM)
    if (!newEobt || !/^\d{4}$/.test(newEobt)) {
      return NextResponse.json(
        { error: 'Invalid EOBT format. Expected HHMM (e.g., 1200)' },
        { status: 400 }
      );
    }

    const result = await homebriefingClient.sendDelay(
      session.cookies,
      session.token,
      session.userSession,
      flightPlanId,
      newEobt
    );

    // Check for session expiry at Homebriefing side
    if (result.sessionExpired) {
      sessionStore.deleteSession(sessionId);
      const response = NextResponse.json(
        { error: 'Homebriefing session expired', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
      response.cookies.delete('hb-session');
      return response;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Flight plan delay error:', error);
    return NextResponse.json(
      { error: 'Failed to send delay message' },
      { status: 500 }
    );
  }
}
