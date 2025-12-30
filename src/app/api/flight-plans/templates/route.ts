import { NextRequest, NextResponse } from 'next/server';
import { homebriefingClient, sessionStore } from '@/lib/homebriefing';
import { cookies } from 'next/headers';
import { SaveTemplateRequest } from '@/lib/homebriefing/types';

export async function GET() {
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

    const result = await homebriefingClient.getTemplateList(
      session.cookies,
      session.token,
      session.userSession
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
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Templates list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

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

    const body: SaveTemplateRequest = await request.json();

    if (!body.tplName || !body.formData) {
      return NextResponse.json(
        { error: 'Template name and form data are required' },
        { status: 400 }
      );
    }

    const result = await homebriefingClient.saveTemplate(
      session.cookies,
      session.token,
      session.userSession,
      body
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
        {
          error: result.errorMessage || 'Failed to save template',
          rawResponse: result.rawResponse,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save template error:', error);
    return NextResponse.json(
      { error: 'Failed to save template' },
      { status: 500 }
    );
  }
}
