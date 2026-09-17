import React, { useEffect, useMemo, useState } from 'react';
import { renderMarkdown } from '../lib/parse.js';

function fmtTime(ms) {
  if (!ms) return '0s';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function diffColor(d) {
  const k = (d || '').toLowerCase();
  return k === 'easy' ? 'text-good' : k === 'medium' ? 'text-warn' : k === 'hard' ? 'text-bad' : 'text-base-500';
}

function Detail({ item, onReopen, onSetCorrect }) {
  const p = item.problem;
  return (
    <div className="mt-2 border-t border-base-600 pt-3 space-y-3">
      {p ? (
        <>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-1">Problem</div>
            <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{p.description}</div>
          </div>
          {p.tables && p.tables.trim() && (
            <pre className="text-xs bg-base-900 border border-base-600 rounded-lg p-2.5 overflow-x-auto font-mono text-gray-300 whitespace-pre-wrap">{p.tables}</pre>
          )}
          {p.examples && p.examples.trim() && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-1">Examples</div>
              <pre className="text-xs bg-base-900 border border-base-600 rounded-lg p-2.5 overflow-x-auto font-mono text-gray-300 whitespace-pre-wrap">{p.examples}</pre>
            </div>
          )}
        </>
      ) : (
        <div className="text-xs text-base-500 italic">
          The full problem wasn't saved for this older attempt — only your code is available.
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-1">Your solution</div>
        <pre className="text-xs bg-base-900 border border-base-600 rounded-lg p-2.5 overflow-x-auto font-mono text-gray-200 whitespace-pre-wrap">
          {item.userCode || '(empty)'}
        </pre>
      </div>

      {item.feedback && item.feedback.trim() && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-1">Tutor feedback</div>
          <div
            className="prose-chat text-sm text-gray-300 bg-base-900 border border-base-600 rounded-lg p-3"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(item.feedback) }}
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        {p && (
          <button
            onClick={() => onReopen(item)}
            className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors"
          >
            Reopen &amp; retry
          </button>
        )}
        <button
          onClick={() => onSetCorrect(item.id, !item.wasCorrect)}
          title="Correct a mis-graded attempt"
          className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 text-gray-200 text-sm font-medium transition-colors"
        >
          {item.wasCorrect ? 'Mark as attempted' : 'Mark as solved'}
        </button>
      </div>
    </div>
  );
}

export default function HistoryModal({ onClose, onReopen }) {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('all'); // all | solved | unsolved
  const [openId, setOpenId] = useState(null);

  const setCorrect = async (id, wasCorrect) => {
    // Optimistic local update, then persist.
    setItems((prev) => (prev || []).map((r) => (r.id === id ? { ...r, wasCorrect } : r)));
    try {
      await window.api.db.setResultCorrectness(id, wasCorrect);
    } catch {
      /* leave optimistic state; a reopen will refetch */
    }
  };

  useEffect(() => {
    let alive = true;
    window.api.db.getHistory(300).then((rows) => {
      if (alive) setItems(rows || []);
    });
    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => {
    const all = items || [];
    return {
      all: all.length,
      solved: all.filter((r) => r.wasCorrect).length,
      unsolved: all.filter((r) => !r.wasCorrect).length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const all = items || [];
    if (filter === 'solved') return all.filter((r) => r.wasCorrect);
    if (filter === 'unsolved') return all.filter((r) => !r.wasCorrect);
    return all;
  }, [items, filter]);

  const tabs = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'solved', label: `Solved (${counts.solved})` },
    { key: 'unsolved', label: `Attempted (${counts.unsolved})` },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-base-850 border border-base-600 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-600">
          <h2 className="text-lg font-bold">History</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-base-700 flex items-center justify-center text-lg leading-none text-gray-400 hover:text-gray-200 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="flex gap-1 bg-base-900 border border-base-600 rounded-lg p-0.5 w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  filter === t.key ? 'bg-accent text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!items ? (
            <div className="text-center text-base-500 py-10">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-base-500 py-10 text-sm">
              {counts.all === 0
                ? 'No attempts yet. Solve a problem and it will show up here.'
                : 'Nothing in this filter.'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item) => {
                const open = openId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border transition-colors ${
                      open ? 'border-accent/40 bg-base-800' : 'border-base-600 bg-base-900 hover:bg-base-800'
                    }`}
                  >
                    <button
                      onClick={() => setOpenId(open ? null : item.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          item.wasCorrect ? 'bg-good' : 'border border-base-500'
                        }`}
                        title={item.wasCorrect ? 'Solved' : 'Attempted'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-200 truncate">{item.title}</div>
                        <div className="text-[11px] text-base-500">
                          {item.type}
                          {item.topic ? ` · ${item.topic}` : ''} ·{' '}
                          <span className={diffColor(item.difficulty)}>{item.difficulty}</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-base-500 text-right shrink-0">
                        <div>{fmtDate(item.timestamp)}</div>
                        <div className="tabular-nums">{fmtTime(item.timeSpentMs)}</div>
                      </div>
                      <span className={`text-base-500 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                    </button>
                    {open && (
                      <div className="px-3 pb-3">
                        <Detail item={item} onReopen={onReopen} onSetCorrect={setCorrect} />
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
