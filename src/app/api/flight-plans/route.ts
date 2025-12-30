import { NextRequest, NextResponse } from 'next/server';
import { homebriefingClient, sessionStore } from '@/lib/homebriefing';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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

    // Parse query parameters for filters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'current'; // 'current' or 'archive'

    const filters = {
      arcid: searchParams.get('arcid') || undefined,
      adep: searchParams.get('adep') || undefined,
      ades: searchParams.get('ades') || undefined,
      flRules: searchParams.get('flRules') || 'X',
      ownFlsOnly: searchParams.get('ownFlsOnly') === 'true',
      pageNumber: parseInt(searchParams.get('page') || '0'),
      pageItems: parseInt(searchParams.get('limit') || '25'),
      orderColumn: searchParams.get('orderColumn') || 'COL_EOBDT',
      orderType: (searchParams.get('orderType') as 'ASC' | 'DESC') || 'DESC',
      numHoursAfterETA: parseInt(searchParams.get('numHoursAfterETA') || '3'),
    };

    // Fetch current or archived flight plans based on type
    const result = type === 'archive'
      ? await homebriefingClient.getArchivedFlightPlans(
          session.cookies,
          session.token,
          session.userSession,
          filters
        )
      : await homebriefingClient.getCurrentFlightPlans(
          session.cookies,
          session.token,
          session.userSession,
          filters
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
        { error: 'Failed to fetch flight plans' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Flight plans error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flight plans' },
      { status: 500 }
    );
  }
}
