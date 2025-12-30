'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FlightPlan, FlightMessage } from '@/lib/homebriefing/types';

type TabType = 'current' | 'archive';

// Status display logic based on Homebriefing status codes and flCanDo bitmask
// flCanDo bitmask: 1=DEP, 3=ARR, 4=CNL, 7=DLA, 16=CHG (values can be combined)
// Active flight = statusCode 48/53 + EOBT in future or recent past
function getStatusDisplay(statusCode: number, statusStr: string, flCanDo: number, eobdt?: string): { color: string; label: string } {
  // Rejected states
  if (statusCode === 49 || statusCode === 490 || statusCode === 491) {
    return { color: 'bg-red-100 text-red-800', label: 'Rejected' };
  }

  // Cancelled status codes
  if (statusCode === 4 || statusCode === 7) {
    return { color: 'bg-red-100 text-red-800', label: 'Cancelled' };
  }

  // Received/Processing states
  if (statusCode === 11) {
    return { color: 'bg-blue-100 text-blue-800', label: 'Processing' };
  }

  // Accepted states (48, 53)
  if (statusCode === 48 || statusCode === 53) {
    // Check if flight is in the past (more than 3 hours after EOBT)
    if (eobdt) {
      const flightTime = new Date(eobdt).getTime();
      const now = Date.now();
      const threeHoursAgo = now - 3 * 60 * 60 * 1000;

      // Flight is in future or within 3 hours = Active
      if (flightTime > threeHoursAgo) {
        return { color: 'bg-green-100 text-green-800', label: 'Accepted' };
      }

      // Flight is in the past (>3 hours ago)
      // flCanDo = 0 or flCanDo = 4 (only CNL view) = historical
      if (flCanDo === 0) {
        return { color: 'bg-slate-100 text-slate-800', label: 'Completed' };
      }
      // Past flight with flCanDo = 4 could be cancelled
      return { color: 'bg-slate-100 text-slate-800', label: 'Completed' };
    }

    // No EOBT, fall back to flCanDo
    if (flCanDo > 0) {
      return { color: 'bg-green-100 text-green-800', label: 'Accepted' };
    }
    return { color: 'bg-slate-100 text-slate-800', label: 'Completed' };
  }

  // Default: use the API-provided status string
  return { color: 'bg-slate-100 text-slate-800', label: statusStr };
}

// Homebriefing button enable/disable logic based on flCanDo bitmask
// Priority order: 7 -> 4 -> 16 -> 3 -> 1
// flCanDo=7: all buttons DISABLED
// flCanDo=4: all buttons DISABLED
// flCanDo=16: DLA, CNL, CHG, DEP DISABLED (only ARR enabled)
// flCanDo=3: NO buttons disabled (DLA, CNL available)
// flCanDo=1: NO buttons disabled (DLA, CNL available)
// Also requires statusCode to be 48 or 53 (accepted)

function canPerformActions(statusCode: number, flCanDo: number): boolean {
  // Must be accepted status (48 or 53)
  if (statusCode !== 48 && statusCode !== 53) {
    return false;
  }

  // Check priority order - if higher priority matches, use that result
  // 7 and 4 disable everything
  if ((flCanDo & 7) === 7) return false;
  if ((flCanDo & 4) === 4) return false;

  // 16 disables DLA/CNL
  if ((flCanDo & 16) === 16) return false;

  // 3 and 1 enable everything
  if ((flCanDo & 3) === 3) return true;
  if ((flCanDo & 1) === 1) return true;

  return false;
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
  onRefresh,
  isArchive,
}: {
  fp: FlightPlan;
  onClose: () => void;
  onSessionExpired: () => void;
  onRefresh: () => void;
  isArchive: boolean;
}) {
  const [messages, setMessages] = useState<FlightMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayTime, setDelayTime] = useState('');
  const [delaying, setDelaying] = useState(false);
  const [delayError, setDelayError] = useState<string | null>(null);
  const [delaySuccess, setDelaySuccess] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const { date, time } = formatDateTime(fp.eobdt);
  const status = getStatusDisplay(fp.flStatusCode, fp.flStatusStr, fp.flCanDo, fp.eobdt);

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

  // Handle delay submission
  const handleDelay = async () => {
    if (!delayTime || !/^\d{4}$/.test(delayTime)) {
      setDelayError('Enter time in HHMM format (e.g., 1200)');
      return;
    }

    setDelaying(true);
    setDelayError(null);

    try {
      const res = await fetch(`/api/flight-plans/${fp.flId}/delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEobt: delayTime }),
      });

      if (res.status === 401) {
        onSessionExpiredRef.current();
        return;
      }

      const data = await res.json();

      if (data.success) {
        setDelaySuccess(true);
        // Refresh the flight plans list after successful delay
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 1500);
      } else {
        setDelayError(data.errorMessage || data.error || 'Failed to send delay');
      }
    } catch {
      setDelayError('Failed to send delay message');
    } finally {
      setDelaying(false);
    }
  };

  // Get current EOBT time in HHMM format
  const currentEobt = fp.eobdt ? new Date(fp.eobdt).toISOString().slice(11, 16).replace(':', '') : '';

  // Handle cancel submission
  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/flight-plans/${fp.flId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 401) {
        onSessionExpiredRef.current();
        return;
      }

      const data = await res.json();

      if (data.success) {
        setCancelSuccess(true);
        // Refresh the flight plans list after successful cancel
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 1500);
      } else {
        setCancelError(data.errorMessage || data.error || 'Failed to send cancel');
      }
    } catch {
      setCancelError('Failed to send cancel message');
    } finally {
      setCancelling(false);
    }
  };

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

          {/* Action buttons */}
          {!isArchive && canPerformActions(fp.flStatusCode, fp.flCanDo) && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setDelayTime(currentEobt);
                  setShowDelayModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Delay (DLA)
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel (CNL)
              </button>
            </div>
          )}
        </div>

        {/* Delay Modal */}
        {showDelayModal && (
          <div className="p-6 border-b border-slate-200 bg-orange-50">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Delay Flight Plan</h3>

            {delaySuccess ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                Delay message sent successfully!
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-4">
                  Enter the new EOBT (Estimated Off-Block Time) in UTC.
                  Current EOBT: <span className="font-mono font-medium">{time}z</span>
                </p>

                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      New EOBT (HHMM)
                    </label>
                    <input
                      type="text"
                      value={delayTime}
                      onChange={(e) => setDelayTime(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="1200"
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg font-mono text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      maxLength={4}
                    />
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={handleDelay}
                      disabled={delaying || !delayTime}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {delaying ? 'Sending...' : 'Send DLA'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDelayModal(false);
                        setDelayError(null);
                        setDelayTime('');
                      }}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {delayError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {delayError}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="p-6 border-b border-slate-200 bg-red-50">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Cancel Flight Plan</h3>

            {cancelSuccess ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                Cancel message sent successfully!
              </div>
            ) : (
              <>
                <div className="p-4 bg-red-100 border border-red-300 rounded-lg mb-4">
                  <p className="text-red-800 font-medium">
                    Are you sure you want to cancel this flight plan?
                  </p>
                  <p className="text-red-700 text-sm mt-1">
                    {fp.arcid}: {fp.adep} → {fp.ades} on {date} at {time}z
                  </p>
                  <p className="text-red-600 text-xs mt-2">
                    This action cannot be undone. A CNL message will be sent to ATC.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelling ? 'Sending...' : 'Confirm Cancel'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setCancelError(null);
                    }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Go Back
                  </button>
                </div>

                {cancelError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {cancelError}
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
          const status = getStatusDisplay(fp.flStatusCode, fp.flStatusStr, fp.flCanDo, fp.eobdt);
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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

  const fetchFlightPlans = useCallback(async (type: TabType, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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
        setLastRefresh(new Date());
      }
    } catch {
      setError('Failed to fetch flight plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  // Initial fetch and tab change
  useEffect(() => {
    fetchFlightPlans(activeTab);
  }, [activeTab, fetchFlightPlans]);

  // Auto-refresh every 30 seconds for current tab only
  useEffect(() => {
    if (activeTab !== 'current') return;

    const interval = setInterval(() => {
      fetchFlightPlans('current', true);
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, fetchFlightPlans]);

  const handleRefresh = () => {
    fetchFlightPlans(activeTab, true);
  };

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
              <h1 className="text-xl font-bold text-slate-800">Home Briefing</h1>
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
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-800">Flight Plans</h2>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                title={lastRefresh ? `Last updated: ${lastRefresh.toLocaleTimeString()}` : 'Refresh'}
              >
                <svg
                  className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {activeTab === 'current' && (
                <span className="text-xs text-slate-400">Auto-refresh: 30s</span>
              )}
            </div>
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
          onRefresh={() => fetchFlightPlans(activeTab, true)}
          isArchive={activeTab === 'archive'}
        />
      )}
    </div>
  );
}
