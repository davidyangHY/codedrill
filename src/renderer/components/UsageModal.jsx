import React, { useEffect, useState } from 'react';

const WINDOW_LABELS = {
  five_hour: '5-hour limit',
  seven_day: 'Weekly limit (7-day)',
  seven_day_opus: 'Weekly limit — Opus',
  seven_day_sonnet: 'Weekly limit — Sonnet',
  seven_day_overage_included: 'Weekly limit (incl. overage)',
  overage: 'Overage',
};

function pct(u) {
  if (typeof u !== 'number') return null;
  // The SDK reports utilization as a 0-1 fraction.
  const v = u <= 1 ? u * 100 : u;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function resetText(resetsAt) {
  if (!resetsAt) return '';
  const ms = resetsAt * 1000 - Date.now();
  if (ms <= 0) return 'resets now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `resets in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `resets in ${hrs}h ${mins % 60}m`;
  const d = new Date(resetsAt * 1000);
  return 'resets ' + d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function agoText(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function barColor(p, status) {
  if (status === 'rejected' || p >= 100) return 'bg-bad';
  if (p >= 80 || status === 'allowed_warning') return 'bg-warn';
  return 'bg-good';
}

function Window({ id, data, status }) {
  const p = pct(data.utilization);
  if (p === null) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-gray-200">{WINDOW_LABELS[id] || id}</span>
        <span className="text-sm tabular-nums text-gray-300">{p}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-base-700 overflow-hidden">
        <div className={`h-full rounded-full ${barColor(p, status)}`} style={{ width: `${p}%` }} />
      </div>
      <div className="text-[11px] text-base-500 mt-1">{resetText(data.resetsAt)}</div>
    </div>
  );
}

const MODELS = [
  { id: 'haiku', label: 'Haiku', note: 'Lightest — best for these problems' },
  { id: 'sonnet', label: 'Sonnet', note: 'Smarter, uses more of your limits' },
  { id: 'opus', label: 'Opus', note: 'Heaviest — for hard problems only' },
];

export default function UsageModal({ onClose }) {
  const [state, setState] = useState(null); // { usage, sessionCostUsd }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [model, setModel] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setState(await window.api.ai.getUsage());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (window.api.config && window.api.config.status) {
      window.api.config.status().then((s) => setModel(s && s.model)).catch(() => {});
    }
  }, []);

  async function chooseModel(id) {
    setModel(id);
    try {
      const r = await window.api.config.setModel(id);
      if (r && r.model) setModel(r.model);
    } catch {
      /* ignore */
    }
  }

  // Normalize a stored full id (e.g. claude-haiku-4-5) to its alias for the toggle.
  const activeModel = (() => {
    const m = (model || '').toLowerCase();
    if (m.includes('haiku')) return 'haiku';
    if (m.includes('opus')) return 'opus';
    if (m.includes('sonnet')) return 'sonnet';
    return m;
  })();

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await window.api.ai.refreshUsage();
      setState(r);
    } finally {
      setRefreshing(false);
    }
  }

  const usage = state && state.usage;
  const windows = usage && usage.windows ? usage.windows : null;
  const order = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet', 'seven_day_overage_included', 'overage'];
  const keys = windows
    ? Object.keys(windows).sort((a, b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-base-850 border border-base-600 rounded-2xl w-full max-w-md animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-600">
          <h2 className="text-lg font-bold">Claude Usage</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-base-700 flex items-center justify-center text-lg leading-none text-gray-400 hover:text-gray-200 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Model picker */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-2">
              Model
            </div>
            <div className="flex rounded-lg bg-base-900 border border-base-600 p-0.5">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => chooseModel(m.id)}
                  className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeModel === m.id ? 'bg-accent text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-base-500 mt-1.5">
              {(MODELS.find((m) => m.id === activeModel) || {}).note ||
                'Lighter models use less of your plan limits.'}
            </div>
          </div>

          <div className="border-t border-base-600" />

          {loading ? (
            <div className="text-center text-base-500 py-8">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="text-sm text-gray-400 leading-relaxed">
              No usage data yet. Click <span className="text-accent font-medium">Refresh</span> below
              (it runs one tiny request), or just generate a problem — your plan usage updates
              automatically after any action.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {keys.map((k) => (
                  <Window key={k} id={k} data={windows[k]} status={usage.status} />
                ))}
              </div>
              {usage.status === 'allowed_warning' && (
                <div className="text-xs text-warn bg-warn/10 border border-warn/30 rounded-lg p-2.5">
                  You're getting close to a limit. When a window fills up, requests pause until it resets.
                </div>
              )}
              {usage.status === 'rejected' && (
                <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-lg p-2.5">
                  A limit is currently reached — new requests will fail until the window resets.
                </div>
              )}
            </>
          )}

          {state && typeof state.sessionCostUsd === 'number' && (
            <div className="flex items-baseline justify-between text-sm border-t border-base-600 pt-4">
              <span className="text-gray-400">This session (estimated)</span>
              <span className="tabular-nums text-gray-200">${state.sessionCostUsd.toFixed(3)}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-base-500">
              {usage && usage.updatedAt ? `Updated ${agoText(usage.updatedAt)}` : ''}
            </span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-2"
            >
              {refreshing && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <p className="text-[11px] text-base-500 leading-relaxed">
            Reflects your Claude subscription limits, read from the same usage signal the Claude apps
            use. Percentages and reset times are provided by Claude and are best-effort.
          </p>
        </div>
      </div>
    </div>
  );
}
