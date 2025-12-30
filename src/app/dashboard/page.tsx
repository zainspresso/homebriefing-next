'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FlightPlan, FlightMessage } from '@/lib/homebriefing/types';

type TabType = 'current' | 'archive';

// Status display logic based on Homebriefing status codes and flCanDo bitmask
function getStatusDisplay(statusCode: number, statusStr: string, flCanDo: number): { color: string; label: string } {
  // flCanDo bitmask indicates what actions are available:
  // 12 = full actions (CHG, DLA, CNL, DEP, ARR) - active flight
  // 4 = limited actions - cancelled/rejected state
  // 1 = minimal - completed flight

  // Check for cancelled: accepted status code (48, 53) but flCanDo = 4
  if ((statusCode === 48 || statusCode === 53) && flCanDo === 4) {
    return { color: 'bg-red-100 text-red-800', label: 'Cancelled' };
  }

  // Rejected states
  if (statusCode === 49 || statusCode === 490 || statusCode === 491) {
    return { color: 'bg-red-100 text-red-800', label: 'Rejected' };
  }

  // Accepted/Filed states (green) - with full actions available
  if ((statusCode === 48 || statusCode === 53) && flCanDo >= 8) {
    return { color: 'bg-green-100 text-green-800', label: statusStr };
  }

  // Completed flights (flCanDo = 1) - show as completed
  if (flCanDo === 1 && (statusCode === 48 || statusCode === 53)) {
    return { color: 'bg-purple-100 text-purple-800', label: 'Completed' };
  }

  // Received/Processing states
  if (statusCode === 11) {
    return { color: 'bg-blue-100 text-blue-800', label: statusStr };
  }

  // Cancelled/Closed status codes
  if (statusCode === 4 || statusCode === 7) {
    return { color: 'bg-red-100 text-red-800', label: 'Cancelled' };
  }

  // Default: use the API-provided status string
  return { color: 'bg-slate-100 text-slate-800', label: statusStr };
}

function formatDateTime(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
  };
}

function formatEet(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

function getMsgTypeColor(msgType: string): string {
  switch (msgType) {
    case 'FPL': return 'bg-blue-100 text-blue-800';
    case 'DEP': return 'bg-green-100 text-green-800';
    case 'ARR': return 'bg-purple-100 text-purple-800';
    case 'CHG': return 'bg-yellow-100 text-yellow-800';
    case 'CNL': return 'bg-red-100 text-red-800';
    case 'DLA': return 'bg-orange-100 text-orange-800';
    case 'ACK': return 'bg-emerald-100 text-emerald-800';
    case 'REJ': return 'bg-red-100 text-red-800';
    default: return 'bg-slate-100 text-slate-800';
  }
}

function FlightPlanDetailModal({
  fp,
  onClose,
  onSessionExpired,
}: {
  fp: FlightPlan;
  onClose: () => void;
  onSessionExpired: () => void;
}) {
  const [messages, setMessages] = useState<FlightMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { date, time } = formatDateTime(fp.eobdt);
  const status = getStatusDisplay(fp.flStatusCode, fp.flStatusStr, fp.flCanDo);

  // Use ref to avoid dependency on onSessionExpired causing re-renders
  const onSessionExpiredRef = useRef(onSessionExpired);
  onSessionExpiredRef.current = onSessionExpired;

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/flight-plans/${fp.flId}/messages`);
        if (res.status === 401) {
          onSessionExpiredRef.current();
          return;
        }
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          // Sort messages newest first
          const sorted = (data.messages || []).sort((a: FlightMessage, b: FlightMessage) =>
            new Date(b.msgTime).getTime() - new Date(a.msgTime).getTime()
          );
          setMessages(sorted);
        }
      } catch {
        setError('Failed to fetch messages');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [fp.flId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">{fp.arcid}</h2>
                <span className="text-sm text-slate-500">{fp.arcType}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-slate-600">
                <span className="font-semibold">{fp.adep}</span>
                <span>→</span>
                <span className="font-semibold">{fp.ades}</span>
                <span className="text-slate-400">|</span>
                <span>{date} {time}z</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Flight Details */}
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Rules</span>
              <div className="font-medium text-slate-800">
                {fp.flRules === 'V' ? 'VFR' : fp.flRules === 'I' ? 'IFR' : fp.flRules}
              </div>
            </div>
            <div>
              <span className="text-slate-500">Level</span>
              <div className="font-medium text-slate-800">{fp.flLevel}</div>
            </div>
            <div>
              <span className="text-slate-500">Speed</span>
              <div className="font-medium text-slate-800">{fp.flSpeed}</div>
            </div>
            <div>
              <span className="text-slate-500">EET</span>
              <div className="font-medium text-slate-800">{formatEet(fp.totalEet)}</div>
            </div>
            {fp.adAltn1 && (
              <div>
                <span className="text-slate-500">Alternate</span>
                <div className="font-medium text-slate-800">{fp.adAltn1}</div>
              </div>
            )}
            <div className="col-span-2 md:col-span-4">
              <span className="text-slate-500">Route</span>
              <div className="font-mono text-slate-800 bg-white px-3 py-2 rounded border border-slate-200 mt-1">
                {fp.flRoute || 'DCT'}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Messages</h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-slate-500 text-sm">Loading messages...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No messages found for this flight plan
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const msgDateTime = formatDateTime(msg.msgTime);
                return (
                  <div
                    key={msg.flMsgId}
                    className={`p-4 rounded-lg border ${
                      msg.isIncome
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getMsgTypeColor(msg.msgType)}`}>
                          {msg.msgType}
                        </span>
                        <span className="text-xs text-slate-500">
                          {msg.isIncome ? 'Received' : 'Sent'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {msgDateTime.date} {msgDateTime.time}
                      </span>
                    </div>
                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                      {msg.msgTxt}
                    </pre>
                    {msg.statusDesc && (
                      <div className="mt-2 text-xs text-slate-500">
                        Status: {msg.statusDesc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlightPlanCard({ fp, onClick }: { fp: FlightPlan; onClick: () => void }) {
  const { date, time: depTime } = formatDateTime(fp.eobdt);

  // Calculate arrival time
  const depDate = new Date(fp.eobdt);
  const arrDate = new Date(depDate.getTime() + fp.totalEet * 60 * 1000);
  const arrTime = arrDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-lg font-bold text-slate-800">{fp.arcid}</span>
          <span className="ml-2 text-sm text-slate-500">{fp.arcType}</span>
        </div>
        {(() => {
          const status = getStatusDisplay(fp.flStatusCode, fp.flStatusStr, fp.flCanDo);
          return (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.color}`}>
              {status.label}
            </span>
          );
        })()}
      </div>

      {/* Route */}
      <div className="flex items-center gap-3 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-slate-800">{fp.adep}</div>
          <div className="text-xs text-slate-500">{depTime}z</div>
        </div>
        <div className="flex-1 flex items-center">
          <div className="h-px bg-slate-300 flex-1"></div>
          <div className="px-2 text-xs text-slate-500">{formatEet(fp.totalEet)}</div>
          <div className="h-px bg-slate-300 flex-1"></div>
          <svg className="w-4 h-4 text-slate-400 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-slate-800">{fp.ades}</div>
          <div className="text-xs text-slate-500">{arrTime}z</div>
        </div>
      </div>

      {/* Route string */}
      <div className="text-sm text-slate-600 mb-4 font-mono bg-slate-50 px-3 py-2 rounded">
        {fp.flRoute || 'DCT'}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-500">Date</span>
          <div className="font-medium text-slate-800">{date}</div>
        </div>
        <div>
          <span className="text-slate-500">Rules</span>
          <div className="font-medium text-slate-800">
            {fp.flRules === 'V' ? 'VFR' : fp.flRules === 'I' ? 'IFR' : fp.flRules}
          </div>
        </div>
        <div>
          <span className="text-slate-500">Level</span>
          <div className="font-medium text-slate-800">{fp.flLevel}</div>
        </div>
        {fp.adAltn1 && (
          <div>
            <span className="text-slate-500">Alternate</span>
            <div className="font-medium text-slate-800">{fp.adAltn1}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedFlightPlan, setSelectedFlightPlan] = useState<FlightPlan | null>(null);
  const [utcTime, setUtcTime] = useState<string>('');

  // Update UTC time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().slice(11, 19));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchFlightPlans = useCallback(async (type: TabType) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/flight-plans?type=${type}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setFlightPlans(data.flightPlans || []);
        setTotalCount(data.fplsCount || 0);
      }
    } catch {
      setError('Failed to fetch flight plans');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchFlightPlans(activeTab);
  }, [activeTab, fetchFlightPlans]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">Homebriefing</h1>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                Next
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-mono text-slate-600">
                <span className="text-slate-400">UTC</span> {utcTime}
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3 py-2 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title and Tabs */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Flight Plans</h2>
            <Link
              href="/new-flight-plan"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Flight Plan
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange('current')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                activeTab === 'current'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Active
              </span>
            </button>
            <button
              onClick={() => handleTabChange('archive')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                activeTab === 'archive'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive
              </span>
            </button>
          </div>

          {/* Count */}
          <p className="text-slate-500 mt-4">
            {totalCount} {activeTab === 'current' ? 'active' : 'archived'} flight plan{totalCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button
              onClick={() => fetchFlightPlans(activeTab)}
              className="ml-4 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500">Loading flight plans...</p>
          </div>
        ) : (
          /* Flight Plans Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flightPlans.map((fp) => (
              <FlightPlanCard
                key={fp.flId}
                fp={fp}
                onClick={() => setSelectedFlightPlan(fp)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && flightPlans.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">
              {activeTab === 'current' ? '📋' : '📁'}
            </div>
            <h3 className="text-lg font-medium text-slate-800">
              {activeTab === 'current' ? 'No active flight plans' : 'No archived flight plans'}
            </h3>
            <p className="text-slate-500 mt-1">
              {activeTab === 'current'
                ? 'Flight plans for upcoming flights will appear here'
                : 'Your past flight plans will appear here'}
            </p>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedFlightPlan && (
        <FlightPlanDetailModal
          fp={selectedFlightPlan}
          onClose={() => setSelectedFlightPlan(null)}
          onSessionExpired={() => router.push('/login')}
        />
      )}
    </div>
  );
}
