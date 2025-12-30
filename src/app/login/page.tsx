'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Initialize login session
  const initSession = async () => {
    setInitializing(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/init', { method: 'POST' });
      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        setCaptchaKey((k) => k + 1);
      } else {
        setError('Failed to initialize session');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    // Check if already logged in
    fetch('/api/auth/check')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          router.push('/dashboard');
        } else {
          initSession();
        }
      })
      .catch(() => initSession());
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, username, password, captcha }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Login failed');
        // Refresh captcha on error
        await initSession();
        setCaptcha('');
      }
    } catch {
      setError('Login failed');
      await initSession();
      setCaptcha('');
    } finally {
      setLoading(false);
    }
  };

  const refreshCaptcha = async () => {
    await initSession();
    setCaptcha('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="flex w-full max-w-5xl mx-auto">
      {/* Left Panel - Info */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-8 py-8">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold text-white mb-3">
            Home Briefing Next
          </h1>
          <p className="text-lg text-slate-300 mb-6">
            A modern, mobile-friendly wrapper around the official LVNL Homebriefing portal.
          </p>

          {/* Features */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Wrapper</h3>
                <p className="text-slate-400 text-sm">All actions are performed directly on the official Homebriefing system.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">File Flight Plans</h3>
                <p className="text-slate-400 text-sm">Full Field 18/19 support with real-time validation.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Delay & Cancel</h3>
                <p className="text-slate-400 text-sm">Send DLA and CNL messages with one tap.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Mobile Friendly</h3>
                <p className="text-slate-400 text-sm">Works seamlessly on phone, tablet and desktop.</p>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-sm mb-3">
              Uses your existing Homebriefing account. Need to register or reset your password?
            </p>
            <a
              href="https://hbs.ixosystem.eu/ixo/login.php"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Visit official Homebriefing portal
            </a>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Mobile header - only show on smaller screens */}
            <div className="text-center mb-8 lg:hidden">
              <h1 className="text-3xl font-bold text-slate-800">Home Briefing Next</h1>
              <p className="text-slate-500 mt-2">Modern Flight Plan Management</p>
            </div>

            {/* Desktop header */}
            <div className="hidden lg:block text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Sign In</h2>
              <p className="text-slate-500 mt-1">With your Homebriefing account</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {initializing ? (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500">Connecting to Homebriefing...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Captcha
                  </label>
                  <div className="flex gap-3 mb-2">
                    {sessionId && (
                      <img
                        key={captchaKey}
                        src={`/api/auth/captcha?sessionId=${sessionId}`}
                        alt="Captcha"
                        className="h-12 rounded border border-slate-300 bg-white"
                      />
                    )}
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                      disabled={loading}
                    >
                      Refresh
                    </button>
                  </div>
                  <input
                    type="text"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                    placeholder="Enter captcha"
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !sessionId}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            )}

            {/* Mobile account links */}
            <div className="mt-6 pt-6 border-t border-slate-200 lg:hidden">
              <p className="text-sm text-slate-600 text-center mb-3">Need an account?</p>
              <a
                href="https://hbs.ixosystem.eu/ixo/login.php"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                Visit original portal
              </a>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-200">Your privacy is protected</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  We do not store your credentials. Your email and password are sent directly to
                  Homebriefing for authentication. Session data is automatically cleared after
                  30 minutes of inactivity.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center mt-4 text-slate-500 text-xs">
            Open source on{' '}
            <a href="https://github.com/zainspresso/homebriefing-next" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
              GitHub
            </a>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
