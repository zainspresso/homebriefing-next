import { NextRequest, NextResponse } from 'next/server';
import { homebriefingClient, sessionStore, FlightPlanFormData } from '@/lib/homebriefing';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
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

    const formData: FlightPlanFormData = await request.json();

    const result = await homebriefingClient.sendFlightPlan(
      session.cookies,
      session.token,
      session.userSession,
      formData
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
    console.error('Flight plan send error:', error);
    return NextResponse.json(
      { error: 'Failed to send flight plan' },
      { status: 500 }
    );
  }
}
