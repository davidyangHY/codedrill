import React, { useEffect, useState } from 'react';

function fmtTime(ms) {
  if (!ms) return '0s';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}m ${r}s`;
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-base-900 border border-base-600 rounded-xl p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-base-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-base-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Breakdown({ title, rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-2">
        {title}
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const acc = r.attempted > 0 ? Math.round((r.correct / r.attempted) * 100) : 0;
          return (
            <div key={r.type || r.difficulty} className="flex items-center gap-3">
              <div className="w-20 text-sm capitalize text-gray-300 shrink-0">
                {r.type || r.difficulty}
              </div>
              <div className="flex-1 h-2 rounded-full bg-base-700 overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${acc}%` }} />
              </div>
              <div className="text-xs text-base-500 w-24 text-right tabular-nums">
                {r.correct}/{r.attempted} · {acc}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeakSpots({ rows, onPractice }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-2">
        Weak Spots — concepts to review
      </div>
      <div className="space-y-1.5">
        {rows.slice(0, 8).map((r) => {
          const acc = r.attempted > 0 ? Math.round((r.correct / r.attempted) * 100) : 0;
          return (
            <div
              key={r.topic}
              className="flex items-center gap-3 bg-base-900 border border-base-600 rounded-lg px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 capitalize truncate">{r.topic}</div>
                <div className="text-[11px] text-base-500">
                  {r.type} · missed {r.wrong} of {r.attempted} · {acc}% correct
                </div>
              </div>
              <div className="w-24 h-2 rounded-full bg-base-700 overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full ${acc < 50 ? 'bg-bad' : acc < 80 ? 'bg-warn' : 'bg-good'}`}
                  style={{ width: `${acc}%` }}
                />
              </div>
              {onPractice && (
                <button
                  onClick={() => onPractice(r)}
                  className="shrink-0 px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors"
                >
                  Practice
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StatsModal({ onClose, onPractice }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    window.api.db.getStats().then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-base-850 border border-base-600 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-600 sticky top-0 bg-base-850">
          <h2 className="text-lg font-bold">Your Progress</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-base-700 flex items-center justify-center text-lg leading-none text-gray-400 hover:text-gray-200 transition-colors"
          >
            ×
          </button>
        </div>

        {!stats ? (
          <div className="p-10 text-center text-base-500">Loading…</div>
        ) : stats.error ? (
          <div className="p-10 text-center text-bad text-sm">{stats.error}</div>
        ) : (
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Problems Solved" value={stats.totalSolved} sub={`of ${stats.totalAttempted} attempted`} />
              <Stat label="Accuracy" value={`${Math.round((stats.accuracy || 0) * 100)}%`} />
              <Stat label="Avg. Time" value={fmtTime(stats.avgTimeMs)} />
              <Stat label="Day Streak" value={stats.streak} sub={stats.streak === 1 ? 'day' : 'days'} />
            </div>

            <WeakSpots rows={stats.weakTopics} onPractice={onPractice} />

            <Breakdown title="By Type" rows={stats.byType} />
            <Breakdown title="By Difficulty" rows={stats.byDifficulty} />

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-2">
                Recent Attempts
              </div>
              {stats.recent && stats.recent.length > 0 ? (
                <div className="space-y-1">
                  {stats.recent.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-lg hover:bg-base-800"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${r.was_correct ? 'bg-good' : 'bg-bad'}`}
                        title={r.was_correct ? 'Solved' : 'Attempted'}
                      />
                      <span className="flex-1 truncate text-gray-300">{r.title}</span>
                      <span className="text-xs text-base-500 capitalize">{r.type}</span>
                      <span className="text-xs text-base-500 w-20 text-right">
                        {r.difficulty}
                      </span>
                      <span className="text-xs text-base-500 w-14 text-right tabular-nums">
                        {fmtTime(r.time_spent_ms)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-base-500">No attempts recorded yet. Solve a problem to start tracking!</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
