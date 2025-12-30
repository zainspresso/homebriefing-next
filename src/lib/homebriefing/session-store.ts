import { HomebriefingSession } from './types';
import { randomBytes } from 'crypto';

interface PendingLogin {
  cookies: string;
  token: string;
  createdAt: number;
}

// In-memory store for sessions
// For production, replace with Redis or database
class SessionStore {
  private sessions: Map<string, HomebriefingSession> = new Map();
  private pendingLogins: Map<string, PendingLogin> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Session timeout: 30 minutes (Homebriefing sessions typically last longer, but we refresh)
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000;
  // Pending login timeout: 5 minutes
  private readonly PENDING_TIMEOUT = 5 * 60 * 1000;

  constructor() {
    // Only start cleanup if not already running
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  // Store a pending login (before captcha is solved)
  createPendingLogin(cookies: string, token: string): string {
    const sessionId = this.generateSessionId();
    this.pendingLogins.set(sessionId, {
      cookies,
      token,
      createdAt: Date.now(),
    });
    return sessionId;
  }

  getPendingLogin(sessionId: string): PendingLogin | undefined {
    const pending = this.pendingLogins.get(sessionId);
    if (!pending) return undefined;

    // Check if expired
    if (Date.now() - pending.createdAt > this.PENDING_TIMEOUT) {
      this.pendingLogins.delete(sessionId);
      return undefined;
    }

    return pending;
  }

  // Convert pending login to full session after successful login
  activateSession(
    sessionId: string,
    cookies: string,
    token: string,
    userSession: string
  ): boolean {
    // Remove from pending
    this.pendingLogins.delete(sessionId);

    // Create full session
    this.sessions.set(sessionId, {
      cookies,
      token,
      userSession,
      expiresAt: Date.now() + this.SESSION_TIMEOUT,
    });

    return true;
  }

  getSession(sessionId: string): HomebriefingSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return undefined;
    }

    // Extend session on access
    session.expiresAt = Date.now() + this.SESSION_TIMEOUT;

    return session;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.pendingLogins.delete(sessionId);
  }

  private cleanup(): void {
    const now = Date.now();

    // Cleanup expired sessions
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
      }
    }

    // Cleanup expired pending logins
    for (const [id, pending] of this.pendingLogins) {
      if (now - pending.createdAt > this.PENDING_TIMEOUT) {
        this.pendingLogins.delete(id);
      }
    }
  }
}

// Use globalThis to persist session store across hot reloads in development
const globalForSessions = globalThis as unknown as {
  sessionStore: SessionStore | undefined;
};

export const sessionStore = globalForSessions.sessionStore ?? new SessionStore();

if (process.env.NODE_ENV !== 'production') {
  globalForSessions.sessionStore = sessionStore;
}
