import React from 'react';

function Section({ label, children }) {
  if (!children || (typeof children === 'string' && !children.trim())) return null;
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-1.5">
        {label}
      </div>
      <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

function diffBadge(d) {
  const key = (d || '').toLowerCase();
  const map = {
    easy: 'bg-good/20 text-good border-good/40',
    medium: 'bg-warn/20 text-warn border-warn/40',
    hard: 'bg-bad/20 text-bad border-bad/40',
  };
  return map[key] || 'bg-base-700 text-gray-300 border-base-600';
}

export default function ProblemDisplay({ problem, generating, streamingText }) {
  if (generating && !problem) {
    return (
      <div className="p-5 text-sm text-gray-400">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-3.5 h-3.5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          Generating a fresh problem…
        </div>
        {streamingText && (
          <pre className="text-xs text-base-500 whitespace-pre-wrap font-mono opacity-60 max-h-40 overflow-hidden">
            {streamingText.slice(-600)}
          </pre>
        )}
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-base-500">
        <div className="w-12 h-12 mb-4 rounded-xl brand-grad flex items-center justify-center text-lg font-bold tracking-tight shadow-lg shadow-accent/20">
          CD
        </div>
        <p className="text-base font-medium text-gray-300 mb-1">No problem yet</p>
        <p className="text-sm max-w-xs">
          Pick a mode and difficulty above, then hit{' '}
          <span className="text-accent font-medium">New Problem</span> to get a fresh
          interview-style question.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold leading-tight">{problem.title}</h2>
        <div className="flex gap-1.5 shrink-0">
          {problem.difficulty && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${diffBadge(
                problem.difficulty
              )}`}
            >
              {problem.difficulty}
            </span>
          )}
          {problem.type && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-base-600 bg-base-700 text-gray-300">
              {problem.type}
            </span>
          )}
        </div>
      </div>

      <Section label="Description">{problem.description}</Section>
      {problem.tables && problem.tables.trim() ? (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-1.5">
            Table Schemas
          </div>
          <pre className="text-xs bg-base-900 border border-base-600 rounded-lg p-3 overflow-x-auto font-mono text-gray-300 whitespace-pre-wrap">
            {problem.tables}
          </pre>
        </div>
      ) : null}
      {problem.examples && problem.examples.trim() ? (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-base-500 mb-1.5">
            Examples
          </div>
          <pre className="text-xs bg-base-900 border border-base-600 rounded-lg p-3 overflow-x-auto font-mono text-gray-300 whitespace-pre-wrap">
            {problem.examples}
          </pre>
        </div>
      ) : null}

      {problem.hint && problem.hint.trim() ? (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm text-accent hover:text-accent-hover select-none list-none flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90 text-[10px]">›</span> Show hint
          </summary>
          <div className="mt-2 text-sm text-gray-300 bg-accent/5 border border-accent/20 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
            {problem.hint}
          </div>
        </details>
      ) : null}
    </div>
  );
}
