import React from 'react';

const DIFFICULTIES = ['Auto', 'Easy', 'Medium', 'Hard'];

function diffColor(d, active) {
  if (!active) return 'text-gray-400 hover:text-gray-200';
  switch (d) {
    case 'Auto':
      return 'bg-accent/20 text-accent border-accent/40';
    case 'Easy':
      return 'bg-good/20 text-good border-good/40';
    case 'Medium':
      return 'bg-warn/20 text-warn border-warn/40';
    case 'Hard':
      return 'bg-bad/20 text-bad border-bad/40';
    default:
      return '';
  }
}

function usageChip(usage) {
  const w = usage && usage.usage && usage.usage.windows;
  if (!w || !w.five_hour || typeof w.five_hour.utilization !== 'number') return null;
  const u = w.five_hour.utilization;
  const pct = Math.max(0, Math.min(100, Math.round((u <= 1 ? u * 100 : u))));
  const status = usage.usage.status;
  let cls = 'text-gray-400 border-base-600';
  if (status === 'rejected' || pct >= 100) cls = 'text-bad border-bad/40 bg-bad/10';
  else if (pct >= 80 || status === 'allowed_warning') cls = 'text-warn border-warn/40 bg-warn/10';
  else cls = 'text-good border-good/30 bg-good/5';
  return { pct, cls };
}

export default function TopBar({
  mode,
  setMode,
  difficulty,
  setDifficulty,
  onNewProblem,
  onShowStats,
  onShowHistory,
  onShowUsage,
  usage,
  loading,
  timerText,
  timerRunning,
}) {
  const chip = usageChip(usage);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-base-600 bg-base-850 flex-wrap">
      {/* Mode toggle */}
      <div className="flex rounded-lg bg-base-900 border border-base-600 p-0.5">
        {['sql', 'python'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === m ? 'bg-accent text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {m === 'sql' ? 'SQL' : 'Python'}
          </button>
        ))}
      </div>

      {/* Difficulty */}
      <div className="flex gap-1">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            title={d === 'Auto' ? 'Adaptive — the tutor picks the concept & difficulty from your history' : d}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              difficulty === d
                ? diffColor(d, true)
                : 'border-base-600 ' + diffColor(d, false)
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Progress views */}
      <div className="flex gap-1">
        <button
          onClick={onShowStats}
          className="px-2.5 py-1.5 text-sm font-medium rounded-lg text-gray-400 hover:text-gray-200 hover:bg-base-700 transition-colors"
          title="Progress stats (Ctrl+S)"
        >
          Stats
        </button>
        <button
          onClick={onShowHistory}
          className="px-2.5 py-1.5 text-sm font-medium rounded-lg text-gray-400 hover:text-gray-200 hover:bg-base-700 transition-colors"
          title="History (Ctrl+H)"
        >
          History
        </button>
        <button
          onClick={onShowUsage}
          title="Claude plan usage (Ctrl+U)"
          className={`px-2.5 py-1.5 text-sm font-medium rounded-lg border transition-colors hover:opacity-80 ${
            chip ? chip.cls : 'text-gray-400 border-base-600 hover:bg-base-700'
          }`}
        >
          {chip ? `5h ${chip.pct}%` : 'Usage'}
        </button>
      </div>

      {/* Timer */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-sm tabular-nums border ${
          timerRunning
            ? 'text-accent border-accent/40 bg-accent/10'
            : 'text-base-500 border-base-600'
        }`}
        title="Timer starts when you begin typing"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${timerRunning ? 'bg-accent animate-pulse' : 'bg-base-500'}`} />
        {timerText}
      </div>

      {/* New Problem */}
      <button
        onClick={onNewProblem}
        disabled={loading}
        className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Generating…
          </>
        ) : (
          <>New Problem</>
        )}
      </button>
    </div>
  );
}
