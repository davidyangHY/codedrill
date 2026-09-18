# CodeDrill

A desktop app for **SQL & Python interview practice** with an **adaptive AI tutor** powered by Claude. Instead of a static problem list, CodeDrill generates the *next* problem you should be working on — aimed at your weak spots — and sits next to you as a tutor you can actually talk to.

![Electron](https://img.shields.io/badge/Electron-33-47848F) ![React](https://img.shields.io/badge/React-18-61DAFB)

## Why not just grind LeetCode?

A problem bank is a fixed list you navigate yourself. CodeDrill is the opposite: it decides what to give you next, and it teaches while you solve.

- **Problems adapt to *you*, not a catalog.** With difficulty on **Auto**, Claude reads your history and picks the next problem to prioritize the concepts you miss or rarely practice, avoids repeating recent topics, and moves difficulty up or down as you succeed or struggle. Every problem is freshly generated, so you're never memorizing a curated set — and it won't repeat problems you've already seen.
- **A tutor you can question, not just an answer key.** The right pane is a live conversation. Stuck? Ask for a nudge instead of the solution. Confused by the prompt? Ask it to clarify the schema or restate the question. Disagree with the grade? Push back. Want it harder, easier, or a variation on the same idea? Just ask — and it stays in character as a coach, not a spoiler.
- **It remembers you across sessions.** Your weak-spot history persists, and when you reopen the app the tutor resumes the same conversation and the exact problem you left open — so practice compounds instead of resetting every time.
- **Built for a daily habit, not a leaderboard.** A goal of X minutes or X problems, a pausable timer, a streak, and a year-long contribution calendar keep you consistent — the thing that actually moves interview readiness.

## Features

- **Split-pane workspace** — problem + Monaco editor on the left, AI tutor chat on the right (both dividers are draggable).
- **Adaptive problem generation** — difficulty **Auto** lets the tutor choose the concept and level from your history; or force **Easy / Medium / Hard** and toggle **SQL / Python** yourself. The concept being tested is hidden from the problem and chat (it's a giveaway) and only revealed later in Stats/History.
- **Ask anything, mid-problem** — request a hint, ask it to clarify the question or the table schema, challenge a grade, or say "give me a harder version of this." New-problem requests in chat are answered adaptively too.
- **Run vs Submit** — **Run** does a quick check and replies with just a **CORRECT / INCORRECT** verdict (no explanation); **Submit** returns the full grade with bugs, fixes, and a clean version. Whichever you press first records the attempt.
- **Session reload** — quit and reopen and you land back on the exact problem, code, and chat you had open, with the tutor's conversation resumed.
- **Daily practice** — a goal of X minutes **or** X problems (whichever comes first), a pausable per-day timer with seconds, and a **streak** for hitting either target.
- **Contribution calendar** — a full-year GitHub-style heatmap of your practice (darker green = more active), at the top of the History page.
- **Progress & weak spots** — the **Stats** page shows total solved, accuracy, average time, and streak, plus the concepts you miss most — each with a **Practice** button that generates a fresh problem targeting it.
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
