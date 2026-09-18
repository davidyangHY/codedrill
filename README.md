# CodeDrill

A desktop app for **SQL & Python interview practice** with an **adaptive AI tutor** powered by Claude. It watches what you get wrong and deliberately serves problems that target your weak spots, adjusting difficulty and variety as you improve — like a real tutor. Solve problems in a real Monaco editor, get graded and explained, build a daily practice habit, and track everything over time.

![Electron](https://img.shields.io/badge/Electron-33-47848F) ![React](https://img.shields.io/badge/React-18-61DAFB)

## Features

- **Split-pane workspace** — problem + Monaco editor on the left, AI tutor chat on the right (both dividers are draggable).
- **Adaptive tutor** — with difficulty set to **Auto**, Claude picks your next problem from your history: it prioritizes concepts you miss or rarely practice, avoids repeating recent concepts, and steps difficulty up or down as you succeed or struggle. You can still force **Easy / Medium / Hard**, and toggle **SQL / Python**.
- **New Problem** — Claude generates a fresh, interview-style problem (description, table schemas for SQL, examples, hint) that renders in the problem panel. The concept being tested is hidden from the problem and chat (it's a giveaway) and only shown later in Stats/History.
- **No repeats** — every generated problem's title is saved to a durable table and fed back to the model, so it invents genuinely new problems instead of looping the same classics across restarts.
- **Run vs Submit** — **Run** does a quick check and replies with just a **CORRECT / INCORRECT** verdict (no explanation); **Submit** returns the full grade with bugs, fixes, and a clean version. Whichever you press first records the attempt.
- **Free-form chat** — ask for hints, explanations, or "give me a harder version of this." Requests for a new problem are answered adaptively too.
- **Session reload** — quit and reopen and you land back on the exact problem you had open, with your code and chat intact. The tutor's own conversation is resumed and your weak-spot history persists, so it picks up where you left off.
- **Daily practice** — set a goal of X minutes **or** X problems (whichever comes first). A pausable per-day timer (with seconds) tracks focused time, and a day counts toward your **streak** when you hit either target.
- **Contribution calendar** — a full-year GitHub-style heatmap of your practice (darker green = more active), at the top of the History page.
- **Progress tracking** (SQLite) — total solved, accuracy, average time, and day streak on the **Stats** page.
- **Weak-spots review** — Stats lists the concepts you miss most, each with a **Practice** button that generates a fresh problem targeting it.
- **History** — every attempt, filterable by **Solved / Attempted**. Expand any one to re-read the original problem, your solution, and the tutor's feedback, and **Reopen & retry** to load it back into the editor.
- **Plan usage** — a chip in the top bar shows your Claude 5-hour usage; the **Usage** panel breaks down the 5-hour / 7-day windows and lets you switch models.
- **Desktop niceties** — remembers window size/position, dark theme, native menu bar (File / Mode / View), keyboard shortcuts (Ctrl+N new session, Ctrl+S Stats, Ctrl+H History, Ctrl+U Usage, Ctrl+1/2 mode).

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

## Build

```bash
npm run build        # build the renderer to ./dist
npm run preview      # run Electron against the production build
npm run pack         # package an unpacked Windows app to ./release/win-unpacked
npm run dist         # build a Windows installer
npm run icon         # regenerate build/icon.ico from assets/icon.svg
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Your Anthropic API key (switches to pay-as-you-go API billing). |
| `ANTHROPIC_MODEL` | `haiku` | Model alias/id for generation & grading. Defaults to **Haiku** — lightest on the plan's limits, plenty for these problems. Changeable in-app from the Usage panel. |

## Project structure

```
electron/
  main.js       Electron main process: window, menu, IPC, window-state persistence
  preload.js    contextBridge API exposed to the renderer as window.api
  config.js     stored settings: model, daily goal, window state, saved workspace
                & tutor session id (env ANTHROPIC_API_KEY / ANTHROPIC_MODEL win)
  db.js         better-sqlite3: results (with problem snapshots), daily practice,
                seen-problems dedup, stats, streaks & adaptive summaries
  ai.js         Claude Agent SDK streaming, the adaptive system prompt, usage capture,
                and a persisted session id so the tutor resumes after a restart
src/renderer/
  App.jsx       App shell: split panes, timers, view routing, all AI flow logic
  components/    TopBar, ProblemDisplay, CodeEditor, Chat, StatsPage, HistoryPage,
                 ContributionCalendar, DailyModal, UsageModal, Welcome
  lib/          aiClient (IPC stream bridge), parse (JSON/verdict/markdown)
```

## Notes

- **What's stored:** your session history and per-attempt results — including a snapshot of each attempted problem so History can show it — plus the titles of generated problems (to avoid repeats), daily practice time, and your saved workspace/tutor-session for reload. It's all local SQLite + a small JSON config in Electron's userData; nothing is uploaded.
- The tutor is asked to end each grade with a hidden `VERDICT: CORRECT/INCORRECT` line, which is parsed to record correctness and then stripped from the displayed reply.
- The database is checkpointed on each attempt and flushed cleanly on quit, so recent progress is never stranded in the write-ahead log.
