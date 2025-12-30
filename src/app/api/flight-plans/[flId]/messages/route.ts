import { NextRequest, NextResponse } from 'next/server';
import { homebriefingClient, sessionStore } from '@/lib/homebriefing';
import { cookies } from 'next/headers';

export async function GET(
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

    const result = await homebriefingClient.getFlightPlanMessages(
      session.cookies,
      session.token,
      session.userSession,
      flightPlanId
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

    if (result.isError) {
      return NextResponse.json(
        { error: 'Failed to fetch flight plan messages' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Flight plan messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flight plan messages' },
      { status: 500 }
    );
  }
}
