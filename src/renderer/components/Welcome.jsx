import React, { useState } from 'react';

function sourceLabel(source) {
  switch (source) {
    case 'none':
      return 'your Claude subscription';
    case 'ANTHROPIC_API_KEY':
      return 'your ANTHROPIC_API_KEY (API billing)';
    case '/login managed key':
      return 'a Claude-managed key';
    case 'apiKeyHelper':
      return 'your configured API key helper';
    default:
      return source || 'Claude';
  }
}

export default function Welcome({ onDone }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null); // { ok, source, error }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const r = await window.api.ai.check();
      setResult(r);
    } catch (e) {
      setResult({ ok: false, error: e.message || 'Test failed.' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-base-900 p-6 overflow-y-auto">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl brand-grad flex items-center justify-center text-base font-bold tracking-tight shadow-lg shadow-accent/30">
            CD
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CodeDrill</h1>
            <p className="text-sm text-base-500">SQL &amp; Python interview practice, with an AI tutor.</p>
          </div>
        </div>

        <div className="bg-base-800 border border-base-600 rounded-xl p-6">
          <h2 className="text-base font-semibold mb-1">Runs on your Claude subscription</h2>
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">
            CodeDrill talks to Claude through the{' '}
            <span className="text-gray-200 font-medium">Claude Agent SDK</span>, using a{' '}
            <span className="text-gray-200 font-medium">Claude Code CLI login</span> on this machine —
            so it draws on your Claude subscription instead of pay-as-you-go API credits. Hit{' '}
            <span className="text-gray-200 font-medium">Test connection</span> below to make sure
            you're signed in.
          </p>

          <ul className="text-sm text-gray-400 space-y-1.5 mb-5">
            <li className="flex gap-2.5 items-baseline">
              <span className="w-1 h-1 rounded-full bg-accent shrink-0 translate-y-[-2px]" />
              Generates fresh interview problems on demand
            </li>
            <li className="flex gap-2.5 items-baseline">
              <span className="w-1 h-1 rounded-full bg-accent shrink-0 translate-y-[-2px]" />
              Grades your code and explains mistakes
            </li>
            <li className="flex gap-2.5 items-baseline">
              <span className="w-1 h-1 rounded-full bg-accent shrink-0 translate-y-[-2px]" />
              Tracks your progress locally over time
            </li>
          </ul>

          <div className="rounded-lg bg-base-900 border border-base-600 p-3 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-300">Check the connection to Claude</div>
              <button
                onClick={test}
                disabled={testing}
                className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Testing…
                  </>
                ) : (
                  'Test connection'
                )}
              </button>
            </div>

            {result && result.ok && (
              <p className="text-good text-sm mt-3">
                Connected via {sourceLabel(result.source)}.
              </p>
            )}
            {result && !result.ok && (
              <div className="text-bad text-sm mt-3 whitespace-pre-wrap leading-relaxed">
                {result.error}
              </div>
            )}
            {testing && (
              <p className="text-base-500 text-xs mt-3">
                First run can take a few seconds while the tutor process starts…
              </p>
            )}
          </div>

          <button
            onClick={onDone}
            className="w-full py-2.5 rounded-lg btn-grad font-semibold text-sm transition-all"
          >
            Start practicing
          </button>

          <p className="text-xs text-base-500 mt-4 leading-relaxed">
            Not logged in? Open a terminal, run <code className="px-1 py-0.5 bg-base-900 rounded border border-base-600">claude</code>{' '}
            once to sign in with your Anthropic account, then come back. You can also set{' '}
            <code className="px-1 py-0.5 bg-base-900 rounded border border-base-600">ANTHROPIC_API_KEY</code>{' '}
            to use API billing instead.
          </p>
        </div>
      </div>
    </div>
  );
}
