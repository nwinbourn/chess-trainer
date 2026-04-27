# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

The app uses ES modules, so it must be served over HTTP — opening `Chess-Trainer.html` directly via `file://` will not work.

```bash
python -m http.server 8000
# then open http://localhost:8000/Chess-Trainer.html
```

There are no tests, linters, or package managers configured.

## File structure

```
Chess-Trainer.html   HTML shell — links css/styles.css + js/app.js (module entry)
css/styles.css       All CSS (dark blue theme, CSS Grid layout, component styles)
js/data.js           Constants, shared state object, localStorage helpers
js/calendar.js       renderCalendar()
js/graph.js          renderGraph(), buildMonthlyEditor()
js/workspace.js      renderWorkspace(), renderChecklist(), renderReviews()
js/app.js            All event listeners + init (ES module entry point)
```

**Layout:**
- 256px sidebar: calendar widget + navigation
- Main area (two panels): rating graph on top, tabbed workspace below (Checklist | Game Reviews)

**Module dependency order** (no circular deps):
`data.js` ← `calendar.js`, `graph.js`, `workspace.js` ← `app.js`

**State and persistence:**
- Ephemeral state lives in the `state` object exported from `js/data.js` (`selectedDate`, `activeTab`, `calMonth`, `calYear`); all modules import and mutate it directly
- All user data persists to `localStorage` under two keys:
  - `chess_tracker_v2`: per-day checklist completion, notes, and game reviews
  - `chess_monthly_ratings`: monthly average blitz ratings for the graph

**Key data structures:**
- Weekly tasks are hardcoded JS objects (keyed by day-of-week index) with `id`, `label`, and `note` fields
- Day data shape: `{ tasks: { task_id: bool }, notes: string, reviews: [{ pgn, result, accuracy, perf, notes }] }`
- Calendar cells show filled/dot/empty indicators based on task completion ratio

**SVG rating graph:** rendered inline as a bezier curve with gradient fill; redraws on window resize and when monthly ratings change.

**Auto-save:** notes use a 500ms debounce; task checkboxes and game review fields save immediately on change.
