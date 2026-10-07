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
  They do not reset at 6-month boundaries.
- **Days:** calendar days `00:00 → 23:59:59` in your local time zone (intuitive tracking).
- Birth keeps its time-zone offset for display; lifetime math uses absolute timestamps.

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

Settings (birth date/time, target lifespan 1–150y) and activities persist in `localStorage`.

## Stack

React + TypeScript + Vite. Minimal shadcn/ui-inspired styling, no navbar —
the graph itself is the navigation.
