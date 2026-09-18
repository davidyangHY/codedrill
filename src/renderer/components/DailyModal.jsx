import React, { useEffect, useState } from 'react';

function clock(ms) {
  const s = Math.floor((ms || 0) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
);

function Bar({ label, value, target, unit, done }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-xs tabular-nums text-base-500">
          {value}
          {target > 0 ? ` / ${target}` : ''} {unit}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-base-700 overflow-hidden">
        <div className={`h-full rounded-full ${done ? 'bg-good' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DailyModal({ onClose, dayMs, dayRunning, onToggleDay, daily, onChanged }) {
  const goal = (daily && daily.goal) || { minutes: 20, problems: 3 };
  const problems = (daily && daily.today && daily.today.problems) || 0;
  const streak = (daily && daily.streak) || 0;
  const minutes = Math.floor((dayMs || 0) / 60000);
  const met =
    (goal.minutes > 0 && dayMs >= goal.minutes * 60000) || (goal.problems > 0 && problems >= goal.problems);

  const [gMin, setGMin] = useState(goal.minutes);
  const [gProb, setGProb] = useState(goal.problems);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setGMin(goal.minutes);
    setGProb(goal.problems);
  }, [goal.minutes, goal.problems]);

  const dirty = gMin !== goal.minutes || gProb !== goal.problems;

  async function saveGoal() {
    setSaving(true);
    try {
      await window.api.daily.setGoal({ minutes: Number(gMin) || 0, problems: Number(gProb) || 0 });
      if (onChanged) await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-base-850 border border-base-600 rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-600 sticky top-0 bg-base-850 z-10">
          <h2 className="text-lg font-bold">Today's Practice</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-base-700 flex items-center justify-center text-lg leading-none text-gray-400 hover:text-gray-200 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Timer + streak */}
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleDay}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                dayRunning ? 'bg-accent text-white' : 'bg-base-700 text-gray-200 hover:bg-base-600'
              }`}
              title={dayRunning ? 'Pause' : 'Start'}
            >
              {dayRunning ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="flex-1">
              <div className="text-3xl font-bold tabular-nums leading-none">{clock(dayMs)}</div>
              <div className="text-xs text-base-500 mt-1">
                {dayRunning ? 'practicing…' : 'paused'} · pause anytime you step away
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold tabular-nums">{streak}</div>
              <div className="text-xs text-base-500">day streak</div>
            </div>
          </div>

          {/* Goal progress */}
          {met ? (
            <div className="rounded-xl bg-good/15 border border-good/40 px-4 py-3 text-sm text-good font-medium">
              Daily goal complete — nice work. Keep the streak alive tomorrow.
            </div>
          ) : (
            <div className="text-xs text-base-500">Reach <b className="text-gray-300">either</b> target to finish today.</div>
          )}
          <div className="space-y-3">
            <Bar label="Practice time" value={minutes} target={goal.minutes} unit="min" done={goal.minutes > 0 && minutes >= goal.minutes} />
            <Bar label="Problems" value={problems} target={goal.problems} unit="" done={goal.problems > 0 && problems >= goal.problems} />
          </div>

          <p className="text-[11px] text-base-500">
            Your practice calendar lives in <b className="text-gray-300">History</b>.
          </p>

          {/* Goal settings */}
          <div className="border-t border-base-600 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-2">Daily goal</div>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="text-sm text-gray-300">
                <div className="text-xs text-base-500 mb-1">Minutes</div>
                <input
                  type="number"
                  min="0"
                  value={gMin}
                  onChange={(e) => setGMin(e.target.value)}
                  className="w-20 px-2 py-1.5 rounded-lg bg-base-900 border border-base-600 text-sm outline-none focus:border-accent"
                />
              </label>
              <span className="text-base-500 pb-2 text-sm">or</span>
              <label className="text-sm text-gray-300">
                <div className="text-xs text-base-500 mb-1">Problems</div>
                <input
                  type="number"
                  min="0"
                  value={gProb}
                  onChange={(e) => setGProb(e.target.value)}
                  className="w-20 px-2 py-1.5 rounded-lg bg-base-900 border border-base-600 text-sm outline-none focus:border-accent"
                />
              </label>
              <button
                onClick={saveGoal}
                disabled={!dirty || saving}
                className="ml-auto px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold transition-colors"
              >
                {saving ? 'Saving…' : 'Save goal'}
              </button>
            </div>
            <p className="text-[11px] text-base-500 mt-2">
              A day counts toward your streak when you hit either target. Set one to 0 to ignore it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
