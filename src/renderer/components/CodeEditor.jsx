import React, { useRef } from 'react';
import * as monaco from 'monaco-editor';
import { loader, default as MonacoEditor } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

// Serve Monaco from the bundled package (no CDN) so it works offline & under CSP.
self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};
loader.config({ monaco });

let themeDefined = false;
function defineTheme(m) {
  if (themeDefined) return;
  themeDefined = true;
  m.editor.defineTheme('codedrill-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: '79c0ff' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: 'f0883e' },
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.lineHighlightBackground': '#161b2277',
      'editorLineNumber.foreground': '#484f58',
      'editorGutter.background': '#0d1117',
      'editor.selectionBackground': '#1f6feb44',
    },
  });
}

export default function CodeEditor({ mode, value, onChange }) {
  const editorRef = useRef(null);

  const language = mode === 'sql' ? 'sql' : 'python';

  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={value}
      theme="codedrill-dark"
      beforeMount={defineTheme}
      onMount={(editor) => {
        editorRef.current = editor;
      }}
      onChange={(val) => onChange(val ?? '')}
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'line',
        tabSize: mode === 'python' ? 4 : 2,
        lineNumbersMinChars: 3,
        cursorBlinking: 'smooth',
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      }}
    />
  );
}
