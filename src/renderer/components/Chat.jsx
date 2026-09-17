import React, { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../lib/parse.js';

function VerdictBadge({ verdict }) {
  if (verdict === null || verdict === undefined) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-2 border ${
        verdict
          ? 'bg-good/20 text-good border-good/40'
          : 'bg-bad/20 text-bad border-bad/40'
      }`}
    >
      {verdict ? 'Correct' : 'Not quite'}
    </span>
  );
}

function Message({ m }) {
  if (m.role === 'note') {
    return (
      <div className="flex justify-center my-1">
        <span className="text-xs text-base-500 bg-base-800 border border-base-600 rounded-full px-3 py-1">
          {m.content}
        </span>
      </div>
    );
  }

  const isUser = m.role === 'user';

  if (m.kind === 'runcheck') {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="rounded-full bg-base-800 border border-base-600 px-3 py-1 text-xs text-gray-400">
          Ran a quick check
        </div>
      </div>
    );
  }

  if (m.kind === 'run') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="rounded-2xl rounded-tl-sm bg-base-800 border border-base-600 px-3.5 py-2 text-sm">
          {m.streaming ? (
            m.content ? (
              <span className="text-gray-400 font-mono text-xs">
                {m.content}
                <span className="inline-block w-1.5 h-3 ml-0.5 bg-current align-middle animate-blink rounded-sm" />
              </span>
            ) : (
              <span className="flex items-center gap-2 text-gray-400">
                <span className="w-3.5 h-3.5 border-2 border-base-500 border-t-accent rounded-full animate-spin" />
                Checking…
              </span>
            )
          ) : m.verdict === true ? (
            <span className="text-good font-semibold">Correct</span>
          ) : m.verdict === false ? (
            <span className="text-bad font-semibold">Not quite</span>
          ) : (
            <span className="text-warn font-semibold">Verdict unclear — try Submit</span>
          )}
          {!m.streaming && (
            <span className="text-base-500 font-normal ml-2">· Submit for the full explanation</span>
          )}
        </div>
      </div>
    );
  }

  if (m.kind === 'problem') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-base-800 border border-accent/30 px-3.5 py-2.5">
          <div className="text-xs uppercase tracking-wider text-accent font-semibold mb-1">
            New problem generated
          </div>
          <div className="text-sm font-semibold text-gray-100">{m.problem?.title}</div>
          <div className="text-xs text-base-500 mt-0.5">
            {m.problem?.difficulty} · {m.problem?.type}
            {m.problem?.topic ? ` · ${m.problem.topic}` : ''}
          </div>
          {m.problem?.coach ? (
            <div className="text-xs text-gray-300 mt-2 pl-2 border-l-2 border-accent/50 italic">
              {m.problem.coach}
            </div>
          ) : null}
          <div className="text-xs text-gray-400 mt-1.5">
            Loaded in the problem panel on the left.
          </div>
        </div>
      </div>
    );
  }

  if (m.kind === 'submission') {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[92%] rounded-2xl rounded-tr-sm bg-accent/15 border border-accent/30 px-3.5 py-2.5">
          <div className="text-xs uppercase tracking-wider text-accent font-semibold mb-1.5">
            Submitted solution
          </div>
          <pre className="text-xs font-mono text-gray-200 whitespace-pre-wrap max-h-52 overflow-y-auto">
            {m.code}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[92%] px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-2xl rounded-tr-sm bg-accent text-white'
            : 'rounded-2xl rounded-tl-sm bg-base-800 border border-base-600 text-gray-200'
        }`}
      >
        {!isUser && <VerdictBadge verdict={m.verdict} />}
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.content}</div>
        ) : (
          <div
            className="prose-chat"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
          />
        )}
        {m.streaming && (
          <span className="inline-block w-2 h-4 ml-0.5 bg-current align-middle animate-blink rounded-sm" />
        )}
      </div>
    </div>
  );
}

export default function Chat({ messages, onSend, busy, ready }) {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Size the textarea to its content on every change — including when it's
  // cleared — so it always collapses back to exactly one line.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [input]);

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    onSend(text);
    setInput('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col h-full bg-base-850">
      <div className="px-4 py-2.5 border-b border-base-600 flex items-center gap-2.5 bg-base-850">
        <span className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-[11px] font-bold tracking-tight text-accent">
          CD
        </span>
        <div>
          <div className="text-sm font-semibold leading-none">Tutor</div>
          <div className="text-[11px] text-base-500 mt-0.5">Grades, hints &amp; explanations</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-base-500 text-sm mt-10 px-4">
            <p className="mb-2 text-gray-300 font-medium">Your tutor is ready.</p>
            <p>
              Click <span className="text-accent font-medium">New Problem</span> to begin, then
              write your solution and hit <span className="text-accent font-medium">Submit</span>{' '}
              to get graded. You can ask anything here — hints, explanations, or “give me a harder
              version.”
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
      </div>

      <div className="border-t border-base-600 p-3 bg-base-850">
        <div className="flex items-end gap-2 bg-base-900 border border-base-600 rounded-xl px-3 py-2 focus-within:border-accent transition-colors">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!ready}
            placeholder={ready ? 'Ask a question, request a hint…' : 'Connect an API key to chat'}
            className="flex-1 block bg-transparent resize-none outline-none text-sm placeholder:text-base-500 max-h-[140px] leading-6 py-0.5"
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim() || !ready}
            className="shrink-0 w-8 h-8 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            title="Send (Enter)"
          >
            {busy ? (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
