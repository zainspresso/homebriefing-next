import { NextRequest, NextResponse } from 'next/server';
import { homebriefingClient, sessionStore } from '@/lib/homebriefing';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tplId: string }> }
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

    const { tplId } = await params;
    const tplIdNum = parseInt(tplId);

    if (isNaN(tplIdNum)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const result = await homebriefingClient.getTemplate(
      session.cookies,
      session.token,
      session.userSession,
      tplIdNum
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
        { error: 'Failed to fetch template' },
        { status: 500 }
      );
    }

    if (!result.found) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Template fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tplId: string }> }
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

    const { tplId } = await params;
    const tplIdNum = parseInt(tplId);

    if (isNaN(tplIdNum)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const result = await homebriefingClient.deleteTemplate(
      session.cookies,
      session.token,
      session.userSession,
      tplIdNum
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

    if (result.isError || !result.success) {
      return NextResponse.json(
        { error: result.errorMessage || 'Failed to delete template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedTplId: result.deletedTplId });
  } catch (error) {
    console.error('Template delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
