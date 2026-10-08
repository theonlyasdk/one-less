# One Less (one-less)

Your life as a progress bar — a GitHub-contribution-graph style visualization where
each rounded rectangle is **6 months** of your life.

## Model

- **Lifetime:** `birth timestamp → target end timestamp`
- **Target end:** birth + N calendar years (e.g. `7 Oct 2007, 14:32 → 7 Oct 2087, 14:32` for 80 years)
- **Blocks:** consecutive 6-calendar-month periods from the exact birth timestamp.
  The final block is clamped short if it would overshoot the target.
- **Progress:** `elapsed / total × 100` using exact timestamps.
- **Weeks:** continuous 7-day periods from the birth timestamp (`birth + k·7d`).
  They do not reset at 6-month boundaries, so a week can straddle two blocks.
  Blocks number their weeks `1…27` for readability; the absolute week of life is
  kept in each cell's accessible name.
- **Days:** calendar days `00:00 → 23:59:59` in the display time zone (intuitive tracking).
- The birth moment keeps its own UTC offset for life. Changing the display time zone
  regroups calendar days and dates without ever moving that instant.

## Navigation (drill-down zoom)

**Life → 6 Months → Weeks → Days → Activities**

- **Life view:** entire lifespan as 6-month blocks (past / now / remaining).
- **6-Month view:** every continuous week overlapping that block.
- **Week view:** 7 calendar days starting from the week-start date.
- **Day view:** chronological activity list (activity, time/duration, type, notes).

Each deeper view replaces the previous one with a `← Life / 2008–2009 / Week 14`-style
breadcrumb — zoom in, zoom back out.

## Run

```bash
npm install
npm run dev
npm run build
```

Settings (birth date/time, display time zone, 12/24-hour clock, target lifespan 1–122y),
activities, the light/dark choice and the current drill-down position all persist in
`localStorage`. There is no account and no network call.

## Interaction

- The accent "now" cell is not a solid tile: it fills to the exact share of the
  current period that has elapsed, so the marker doubles as a progress bar. A rail
  above the graph tracks the lifetime as a whole.
- Drilling in morphs the outgoing block's on-screen rect into the whole view
  (translate + scale, ease-in-out); going back plays it in reverse. Each cell
  also cascades in on a short per-index delay, so the grid resolves rather than
  appearing all at once. Breadcrumbs slide in per segment, and back out as the
  view collapses.
- The add-activity form grows a track to push the list down instead of jumping.
- Light/dark follows the system until you use the toggle, which is remembered.
- Toasts sit bottom-centre. Deleting an activity is undoable from the toast.
- Every clickable dims to 70% brightness while held. All motion respects
  `prefers-reduced-motion`.

## Stack

React 19 + TypeScript + Vite. shadcn/ui (`radix-nova`, neutral) components on Radix
primitives: button, dialog, field, input, label, select, textarea, toggle-group,
breadcrumb, card, badge, empty, separator, popover, calendar, sonner. Tailwind CSS v4,
Inter, Instrument Sans and DM Sans self-hosted via Fontsource, lucide-react for icons.
Minimalist by design, no navbar — the graph itself is the navigation.

`theonlyasdk (c) 2026`

The calendar is lazy-loaded, since `react-day-picker` and `date-fns` are only needed
once the date picker is opened.

## Layout

- `src/lib/time.ts` — lifetime arithmetic: anchors, offsets, blocks, weeks, days, progress
- `src/lib/format.ts` — display formatting in the selected zone
- `src/lib/nav.ts` — the drill-down route model
- `src/lib/storage.ts` — `localStorage` settings and activities
- `src/lib/theme.ts` — light/dark resolution and persistence
- `src/components/life/` — the four views, cell primitive, settings dialog, theme,
  morph hook
