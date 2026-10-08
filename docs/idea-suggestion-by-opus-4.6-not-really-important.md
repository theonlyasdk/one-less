# Idea Suggestions for One Less

> Read of the full codebase on 8 Oct 2026 by Claude Opus 4.6.
> Take or leave any of these — they're just sparks, not a roadmap.

---

## 1. Navigation & Wayfinding

### 1a. Lateral (sibling) navigation

Right now every drill-down is strictly vertical — you zoom in, then zoom back
out to pick an adjacent block/week/day. Adding **← / →** arrows (or swipe on
touch) at the Week and Day levels would let users scrub through time without
the round-trip. The `parentRoute` helper already carries full ancestor context,
so building a `siblingRoute(route, delta)` in `nav.ts` is straightforward.

### 1b. URL / history sync

Routes live entirely in React state (`useState<Route>`). A reload drops you
back to the Life view. Syncing `routeKey` into `location.hash` (or
`history.pushState`) would make:

- browser Back/Forward work as expected,
- deep-linkable URLs (share "look at my Week 847"),
- PWA-style "resume where I left off".

### 1c. Keyboard-first quick nav

Escape and Backspace already zoom out. Extending this to arrow keys for
sibling nav, Enter/Space for drill-in, and Home for the Life view would make
the app fully keyboard-navigable without a mouse — nice for accessibility and
power users.

---

## 2. Data & Storage

### 2a. Export / import / backup

All data lives in two `localStorage` keys with no escape hatch. A simple
"Download JSON" / "Upload JSON" pair in the Settings dialog would cover:

- moving between browsers or devices,
- peace-of-mind backups,
- sharing setups (e.g. couples comparing life graphs).

CSV export for activities would also be easy and useful for people who want to
analyze their time in a spreadsheet.

### 2b. Activity editing

`ActivityForm` is creation-only. Tapping an activity card in `ActivityList`
could open the same form pre-filled, with a Save that patches the entry
in-place. The plumbing (`setByDay`) already supports replacement — it just
needs a UI path.

### 2c. Sharded / paginated storage

Today `saveActivities` writes the entire `Record<string, Activity[]>` on every
add or delete. Over years of daily logging, that blob grows. Sharding by
year or block (e.g. `oneless.activities.2025-H1`) would keep each write small
and push the quota ceiling much further out. Could also open the door to
lazy-loading only the blocks the user has drilled into.

### 2d. Custom activity categories & colors

The 8 hardcoded types in `ACTIVITY_TYPES` cover the basics, but people's lives
are idiosyncratic. Letting users define custom categories (with a name, emoji,
and color) would make the activity log feel personal. The `ToggleGroup` in
`ActivityForm` already handles arbitrary items — it just needs a dynamic source.

---

## 3. Visualization & Delight

### 3a. Activity heatmap overlay on the Life grid

The Life view is beautiful but inert for past blocks — they're all the same
"lived" color. Overlaying an opacity or saturation shift based on logged
activity density would turn the grid into a GitHub-contribution-style heatmap
of how "full" each 6-month period was. Blocks you actively tracked glow; empty
ones stay dim. Instant motivation to keep logging.

### 3b. Day timeline / schedule strip

`DayView` shows a flat card list. A thin 24-hour vertical strip alongside it —
colored blocks for each activity — would give an at-a-glance sense of how the
day was allocated: sleep, gaps, overlaps, productive clusters. No interaction
needed, just a passive visualization.

### 3c. Weekly summary stats

`WeekView` shows 7 day tiles but no aggregate. A small summary row — total
hours logged, top category, streak count — would reward consistent tracking
and let users spot patterns without opening every day.

### 3d. Block-level summary stats

Same idea at the Block level: "You logged 312 hours across 147 days this
period. Top: Work (41%), Study (28%)." Turns the 6-month block from a
container into a retrospective.

### 3e. Richer "logged" indicator on day tiles

`WeekView` currently shows a binary "logged" badge. Replacing it with a tiny
pie or stacked bar of the day's category mix (rendered as a few colored dots or
a micro-bar) would add information without clutter.

### 3f. Alternative block resolutions

The 6-month block is great for the default view, but some users might prefer
1-year blocks (fewer tiles, faster scanning) or even decade rows. Since
`getSixMonthBlocks` is the only block generator, adding an `addNMonths(n)`
variant with a settings toggle would be a clean extension.

---

## 4. Milestones & Meaning

### 4a. Life milestones / bookmarks

Let users pin a label to a specific block or day: "Graduated", "Moved to
Berlin", "Started One Less". These could render as small markers or icons on
the Life grid, turning the progress bar into a personal timeline — not just
quantity of time, but quality and narrative.

### 4b. Day-level journal / mood

Beyond activities (which are structured), a freeform text field per day and/or
a simple mood emoji (😊😐😔) would capture the qualitative texture of a day.
Could live alongside activities in `byDay` storage.

### 4c. Streaks & habits

Track consecutive days with at least one logged activity (or a specific
category). Show current streak in the header or Week view. Simple, no new data
model needed — just a derived count from `loggedDays`.

---

## 5. Polish & Accessibility

### 5a. "Follow system" theme option

Once the user toggles the theme, there's no way back to auto-following the OS.
Adding a three-way toggle (System / Light / Dark) in Settings — stored as
`"system" | "light" | "dark"` — would fix this. The `ThemeProvider` already
listens to `matchMedia` changes; it just needs to not short-circuit when a
preference is stored.

### 5b. Colorblind-safe palette

The life graph relies on green/red/neutral hue distinctions. An alternative
palette option (blue/orange, or pattern-based fills) would make the
visualization accessible to the ~8% of men with color vision deficiency.

### 5c. i18n / localization

All text is hardcoded English (`"Sun"`, `"Oct"`, `"y"`, `"m"`, `"d"`).
Switching to `Intl.DateTimeFormat` for weekday/month names and extracting UI
strings into a simple map would open the door to other languages with minimal
effort.

### 5d. Mobile breadcrumb truncation

At 4 levels deep (`Life / 2024–2025 / Week 12 / Sat 12 Oct 2024`) the
breadcrumb trail can overflow on small screens. Collapsing middle crumbs into
an ellipsis menu (shadcn's `BreadcrumbEllipsis`) on narrow viewports would
keep the header tidy.

---

## 6. Technical Improvements

### 6a. Stale morph rect on scroll / resize

`useViewMorph` caches the origin `DOMRect` when drilling in. If the user
scrolls or resizes before zooming back out, the collapse animation targets a
stale position. Re-measuring the origin cell (via a data attribute or ref map)
at the start of `goBack` would fix this.

### 6b. Formatter cache eviction

`time.ts` caches `Intl.DateTimeFormat` instances in an unbounded `Map`. In
practice this is fine (users don't switch timezones often), but an LRU cap of
~50 entries would be a trivial safety net.

### 6c. Service Worker / PWA

The app is fully client-side with no network calls — a perfect PWA candidate.
A Vite PWA plugin (`vite-plugin-pwa`) would add offline support, an install
prompt, and a home-screen icon with almost zero config.

### 6d. Timezone-aware activity re-keying

Activities are keyed by `dayKey` (YYYY-MM-DD in the display timezone).
Switching the display timezone in Settings silently orphans activities under
their old keys. Storing the epoch timestamp of the activity start alongside
the `dayKey` would allow correct re-bucketing when the timezone changes.

---

## 7. Whimsical / Stretch Ideas

### 7a. "Time capsule" messages

Let users write a note to their future self, locked to a specific block. When
that block becomes "past", the note is revealed. Pure delight, zero utility.

### 7b. Shareable life card

Generate a static image or OG card summarizing the user's life stats (age,
%, blocks lived) for sharing on social media. Could use `html-to-image` or
a canvas render of the Life grid.

### 7c. Sound design

A subtle tick or chime when drilling into a new level, and a soft sweep when
the progress rail updates. Gated behind a preference toggle so it's opt-in.

### 7d. Yearly wrapped / retrospective

At the end of each calendar year (or each 6-month block), auto-generate a
"wrapped"-style summary of the user's logged activities: total hours, top
categories, busiest week, longest streak. A nice reward for consistent use.

### 7e. Birthdays of famous people

"You're now the age Einstein published special relativity" or "Mozart composed
his first symphony at your current age." Small contextual facts shown on the
Life view that change as you age. Equal parts humbling and inspiring.

---

*That's the list. None of these are urgent — the app already does its core
thing beautifully. Pick whatever sounds fun.*
