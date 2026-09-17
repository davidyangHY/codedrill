# CodeDrill

A desktop app for **SQL & Python interview practice** with a built-in AI tutor powered by Claude. Generate fresh, interview-style problems on demand, solve them in a real Monaco code editor, get your solution graded and explained, and track your progress over time.

![Electron](https://img.shields.io/badge/Electron-33-47848F) ![React](https://img.shields.io/badge/React-18-61DAFB)

## Features

- **Split-pane workspace** — problem + Monaco editor on the left, AI tutor chat on the right (both dividers are draggable).
- **Mode & difficulty** — toggle SQL / Python and Easy / Medium / Hard.
- **New Problem** — Claude generates a fresh problem (description, table schemas for SQL, examples, hint) that renders in the problem panel and the chat.
- **Run vs Submit** — **Run** does a quick check and replies with just ✓/✗ (no explanation); **Submit** returns the full grade with bugs, fixes, and a clean version. Whichever you press first records the attempt.
- **Free-form chat** — ask for hints, explanations, or "give me a harder version of this."
- **Timer** — starts automatically when you begin typing, stops on your first Run/Submit.
- **Progress tracking** (SQLite) — total solved, accuracy, average time, and day streak in the **Stats** view.
- **Weak-spots review** — each problem is tagged with its concept (window functions, sliding window, …). Stats shows the concepts you miss most, each with a **Practice** button that generates a fresh problem targeting it.
- **History** (File → History, Ctrl+H) — every attempt, filterable by **Solved / Attempted**. Expand any one to re-read the original problem, your solution, and the tutor's feedback, and **Reopen & retry** to load it back into the editor.
- **Desktop niceties** — remembers window size/position, dark theme, native menu bar (File / Mode / View).

## Setup

CodeDrill talks to Claude through the **Claude Agent SDK**, so by default it runs on your
**Claude subscription** (Pro/Max) — no API key or API credits required.

```bash
npm install
```

> **Native module note (Windows):** `better-sqlite3` ships a prebuilt binary for Electron, so no C++ build tools are required. If you ever hit a native-module error after changing Electron versions, run `npm run rebuild`.

### Authentication — one-time login

The Agent SDK authenticates using a **Claude Code CLI login stored on this machine**. The Claude
*desktop app* keeps its login private to itself, so a standalone app like CodeDrill needs its own
CLI login. Do this once:

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Inside `claude`, run `/login` and sign in with your Anthropic account (Pro/Max works). This writes
credentials to `~/.claude` that CodeDrill will pick up. On first launch, the welcome screen has a
**Test connection** button that tells you whether you're signed in.

**Prefer API billing instead?** Set an API key and CodeDrill will use it (pay-as-you-go):

```bash
# PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

or copy `.env.example` to `.env`. Auth precedence follows the Agent SDK: if `ANTHROPIC_API_KEY` is
set it's used; otherwise the CLI login (your subscription) is used.

## Run

```bash
npm start
```

This starts the Vite dev server and launches Electron once it's ready.

## Build the renderer

```bash
npm run build        # outputs to ./dist
npm run preview      # runs Electron against the production build
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Your Anthropic API key. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Override the model used for generation & grading. |

## Project structure

```
electron/
  main.js       Electron main process: window, menu, IPC, window-state persistence
  preload.js    contextBridge API exposed to the renderer as window.api
  config.js     API key + window state (env var wins over stored key)
  db.js         better-sqlite3: sessions + per-problem results, stats & streak
  ai.js         Anthropic streaming chat + the CodeDrill system prompt
src/renderer/
  App.jsx       App shell: split panes, timer, all AI flow logic
  components/    TopBar, ProblemDisplay, CodeEditor, Chat, StatsModal, Setup
  lib/          aiClient (IPC stream bridge), parse (JSON/verdict/markdown)
```

## Notes

- Problems are **not** stored — only your session history and per-problem results (for progress tracking), per the design.
- The tutor is asked to end each grade with a hidden `VERDICT: CORRECT/INCORRECT` line, which is parsed to record correctness and then stripped from the displayed reply.
