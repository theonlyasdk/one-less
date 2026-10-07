export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface SixMonthBlock {
  index: number; // 0-based
  startMs: number;
  endMs: number;
}

export interface WeekInterval {
  index: number; // 0-based, Week number = index + 1
  startMs: number;
  endMs: number;
}

export function cloneDate(ms: number): Date {
  return new Date(ms);
}

/** Add calendar years, preserving local wall-clock time (like shadcn date math). */
export function addYears(ms: number, years: number): number {
  const d = new Date(ms);
  d.setFullYear(d.getFullYear() + years);
  return d.getTime();
}

/** Add calendar months, preserving local wall-clock time. */
export function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Target end = birth + lifespan calendar years. */
export function getTargetEndMs(birthMs: number, lifespanYears: number): number {
  return addYears(birthMs, lifespanYears);
}

/** Consecutive 6-calendar-month periods from exact birth timestamp. Final may be shorter. */
export function getSixMonthBlocks(birthMs: number, targetMs: number): SixMonthBlock[] {
  const blocks: SixMonthBlock[] = [];
  let cur = birthMs;
  let index = 0;
  // Guard against infinite loops on bad input
  while (cur < targetMs && index < 5000) {
    let next = addMonths(cur, 6);
    // If addMonths overflows past target or doesn't advance (edge), clamp
    if (next <= cur) next = Math.min(cur + 1, targetMs);
    if (next > targetMs) next = targetMs;
    blocks.push({ index, startMs: cur, endMs: next });
    cur = next;
    index++;
  }
  return blocks;
}

/** All continuous 7-day weeks from birth overlapping a given block. */
export function getWeeksForBlock(birthMs: number, block: SixMonthBlock): WeekInterval[] {
  const startIdx = Math.floor((block.startMs - birthMs) / WEEK_MS);
  const endIdx = Math.ceil((block.endMs - birthMs) / WEEK_MS) - 1;
  const out: WeekInterval[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    if (i < 0) continue;
    out.push({
      index: i,
      startMs: birthMs + i * WEEK_MS,
      endMs: birthMs + (i + 1) * WEEK_MS,
    });
  }
  return out;
}

export function getWeekInterval(birthMs: number, weekIndex: number): WeekInterval {
  return {
    index: weekIndex,
    startMs: birthMs + weekIndex * WEEK_MS,
    endMs: birthMs + (weekIndex + 1) * WEEK_MS,
  };
}

/**
 * 7 calendar days for a week view.
 * Day i = midnight-based calendar date starting from the local date containing weekStart.
 * Days use 00:00 -> 23:59:59 boundaries for intuitive tracking.
 */
export function getWeekCalendarDays(weekStartMs: number): { startMs: number; endMs: number; key: string }[] {
  const baseMidnight = startOfDayMs(weekStartMs);
  const days: { startMs: number; endMs: number; key: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const startMs = addDays(baseMidnight, i);
    const endMs = addDays(baseMidnight, i + 1) - 1;
    days.push({ startMs, endMs, key: dayKey(startMs) });
  }
  return days;
}

/** Local YYYY-MM-DD key for activity storage. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export type BlockStatus = "past" | "present" | "future";

export function statusOf(intervalStart: number, intervalEnd: number, now: number): BlockStatus {
  if (intervalEnd <= now) return "past";
  if (intervalStart <= now && now < intervalEnd) return "present";
  return "future";
}

/** Fraction 0..1 of interval elapsed at `now` (clamped). */
export function fillFraction(startMs: number, endMs: number, now: number): number {
  if (endMs <= startMs) return now >= endMs ? 1 : 0;
  if (now <= startMs) return 0;
  if (now >= endMs) return 1;
  return (now - startMs) / (endMs - startMs);
}

// ---------- formatting (local / selected time zone = device local) ----------

const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const shortYearFmt = new Intl.DateTimeFormat(undefined, { year: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayNumFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export function fmtDate(ms: number): string {
  return dateFmt.format(new Date(ms));
}

export function fmtDateTime(ms: number): string {
  return dateTimeFmt.format(new Date(ms));
}

export function fmtYear(ms: number): string {
  return shortYearFmt.format(new Date(ms));
}

export function fmtWeekday(ms: number): string {
  return weekdayFmt.format(new Date(ms));
}

export function fmtDayNum(ms: number): string {
  return dayNumFmt.format(new Date(ms));
}

/** "2008–2009" style label for a 6-month block. */
export function blockYearLabel(block: SixMonthBlock): string {
  const a = fmtYear(block.startMs);
  const b = fmtYear(block.endMs - 1);
  return a === b ? a : `${a}–${b}`;
}

export function blockRangeLabel(block: SixMonthBlock): string {
  return `${fmtDate(block.startMs)} → ${fmtDate(block.endMs)}`;
}

/** Capture local GMT offset label for the birth moment, e.g. "UTC+05:30". */
export function tzLabelAt(ms: number): string {
  const offMin = -new Date(ms).getTimezoneOffset(); // minutes east of UTC
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

/** Convert a datetime-local input value to absolute ms (interpreted in device local tz). */
export function fromDateTimeLocal(v: string): number | null {
  if (!v) return null;
  const d = new Date(v);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/** Convert absolute ms to a datetime-local input value (device local tz). */
export function toDateTimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
