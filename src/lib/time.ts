/**
 * Lifetime arithmetic.
 *
 * Two different notions of time coexist, exactly as the spec requires:
 *
 *  - **Absolute time** (lifetime blocks, weeks, progress) is computed on epoch
 *    milliseconds and anchored to the birth instant. Weeks are continuous
 *    7x24h periods from birth and never reset at a block boundary.
 *
 *  - **Calendar time** (days, displayed dates) snaps to local midnight in the
 *    selected IANA time zone, so daily activity tracking stays intuitive.
 *
 * The birth wall-clock is anchored to a *fixed* UTC offset rather than the
 * host machine's zone. That keeps `7 Oct 2007 14:32 -> 7 Oct 2087 14:32` true
 * regardless of where the app runs or which zone the dates are displayed in,
 * and avoids a decade of accumulating DST drift.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface ZonedParts extends WallClock {
  weekday: number; // 0 = Sunday
}

/** A birth instant plus the UTC offset its wall-clock is expressed in. */
export interface BirthAnchor {
  /** Absolute epoch milliseconds of the birth instant. */
  ms: number;
  /** UTC offset in minutes retained from the birth timestamp. */
  offsetMinutes: number;
}

export interface Interval {
  index: number;
  startMs: number;
  endMs: number;
}

export type SegmentStatus = "past" | "present" | "future";

/** Guards against pathological input producing unbounded loops. */
const MAX_BLOCKS = 4000;

function pad(n: number, width = 2): string {
  return String(Math.abs(n)).padStart(width, "0");
}

/** Days in a 1-based month, DST- and year-0-safe. */
export function daysInMonth(year: number, month: number): number {
  const d = new Date(0);
  d.setUTCHours(0, 0, 0, 0);
  // `month` is 1-based, so it is already the 0-based index of the *next*
  // month; day 0 of that month is the last day of `month`.
  d.setUTCFullYear(year, month, 0);
  return d.getUTCDate();
}

/** `Date.UTC` that does not remap years 0-99 onto 1900-1999. */
function utcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms = 0,
): number {
  const d = new Date(0);
  d.setUTCHours(hour, minute, second, ms);
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime();
}

/* ------------------------------------------------------------------ *
 * Fixed-offset wall clock (the birth anchor's own time zone)
 * ------------------------------------------------------------------ */

export function wallClockAt(ms: number, offsetMinutes: number): WallClock {
  const d = new Date(ms + offsetMinutes * MINUTE_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export function msFromWallClock(w: WallClock, offsetMinutes: number, msRemainder = 0): number {
  const day = Math.min(w.day, daysInMonth(w.year, w.month));
  return utcMs(w.year, w.month, day, w.hour, w.minute, w.second, msRemainder) - offsetMinutes * MINUTE_MS;
}

function remainderOf(ms: number): number {
  return ((ms % 1000) + 1000) % 1000;
}

/** Offset in minutes declared by an ISO string; `0` for `Z` or no suffix. */
export function offsetFromIso(iso: string): number {
  const m = /([+-])(\d{2}):?(\d{2})$/.exec(iso.trim());
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** Build an anchor, retaining the offset the caller supplied. */
export function createBirthAnchor(iso: string): BirthAnchor {
  const trimmed = iso.trim();
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid birth timestamp: ${iso}`);
  }
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  return {
    ms,
    offsetMinutes: hasOffset ? offsetFromIso(trimmed) : -new Date(ms).getTimezoneOffset(),
  };
}

/**
 * A birth anchor for an instant, expressed in whatever UTC offset its zone was
 * actually observing then.
 *
 * Use this instead of `createBirthAnchor(new Date(ms).toISOString())`, which
 * would silently rewrite the offset to UTC and lose the birth time zone.
 */
export function anchorInZone(ms: number, tz: string): BirthAnchor {
  return { ms, offsetMinutes: Math.round(tzOffsetMs(ms, tz) / MINUTE_MS) };
}

/** Round-trip back to ISO with the original offset preserved. */
export function birthAnchorToIso(anchor: BirthAnchor): string {
  const w = wallClockAt(anchor.ms, anchor.offsetMinutes);
  const sign = anchor.offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(anchor.offsetMinutes);
  return (
    `${w.year}-${pad(w.month)}-${pad(w.day)}` +
    `T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/* ------------------------------------------------------------------ *
 * Calendar arithmetic in an IANA time zone
 * ------------------------------------------------------------------ */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

/** Numeric calendar parts of `ms` as seen in `tz`. */
export function zonedParts(ms: number, tz: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const part of zonedFormatter(tz).formatToParts(new Date(ms))) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    // Intl can emit hour 24 for midnight under hourCycle h23 in some engines.
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: weekdayIndex(out.weekday ?? "Sun"),
  };
}

function weekdayIndex(label: string): number {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

/** UTC offset in ms that `tz` was observing at instant `ms`. */
export function tzOffsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  const asUtc = utcMs(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return asUtc - (ms - remainderOf(ms));
}

/**
 * First instant of the calendar day containing `ms`, in `tz`.
 *
 * Zones that skip midnight on a DST jump resolve to the first instant that
 * does exist, which is the only sensible "start of day" for that date.
 */
export function startOfDayInZone(ms: number, tz: string): number {
  const offset = tzOffsetMs(ms, tz);
  const wallStart = Math.floor((ms + offset) / DAY_MS) * DAY_MS;
  const candidate = wallStart - offset;
  const resolved = tzOffsetMs(candidate, tz);
  return resolved === offset ? candidate : wallStart - resolved;
}

/** Local midnight `n` calendar days after `dayStartMs`, DST-safe. */
export function addCalendarDays(dayStartMs: number, n: number, tz: string): number {
  return startOfDayInZone(dayStartMs + n * DAY_MS, tz);
}

/** `YYYY-MM-DD` for `ms` in `tz`; the storage key for a day of activities. */
export function dayKeyInZone(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Resolve a `datetime-local` wall-clock string in `tz` to epoch milliseconds. */
export function zonedWallToMs(wall: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(wall.trim());
  if (!m) return Number.NaN;
  const [, y, mo, d, h = "0", mi = "0"] = m;
  const naive = utcMs(Number(y), Number(mo), Number(d), Number(h), Number(mi), 0);
  if (Number.isNaN(naive)) return Number.NaN;
  // Two passes settle the offset, including across a DST transition.
  const firstOffset = tzOffsetMs(naive, tz);
  const first = naive - firstOffset;
  const secondOffset = tzOffsetMs(first, tz);
  return secondOffset === firstOffset ? first : naive - secondOffset;
}

/** Inverse of {@link zonedWallToMs}, for populating a `datetime-local` input. */
export function msToZonedWall(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Interpret a wall clock in a *fixed* UTC offset rather than a live zone.
 *
 * The birth moment is edited in the zone it was born in, so editing it must not
 * depend on whichever display zone is currently selected.
 */
export function wallToOffsetMs(wall: string, offsetMinutes: number): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(wall.trim());
  if (!m) return Number.NaN;
  const [, y, mo, d, h = "0", mi = "0"] = m;
  const day = Math.min(Number(d), daysInMonth(Number(y), Number(mo)));
  const naive = utcMs(Number(y), Number(mo), day, Number(h), Number(mi), 0);
  if (Number.isNaN(naive)) return Number.NaN;
  return naive - offsetMinutes * MINUTE_MS;
}

/** Wall clock of `ms` at a fixed offset, for a `datetime-local` input. */
export function msToOffsetWall(ms: number, offsetMinutes: number): string {
  const w = wallClockAt(ms, offsetMinutes);
  return (
    `${w.year}-${pad(w.month)}-${pad(w.day)}` +
    `T${pad(w.hour)}:${pad(w.minute)}`
  );
}

/** Human label for a retained offset, e.g. `UTC+05:30`. */
export function formatOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/* ------------------------------------------------------------------ *
 * Lifetime: birth instant -> target end instant
 * ------------------------------------------------------------------ */

function msRemainderOf(anchor: BirthAnchor): number {
  return remainderOf(anchor.ms);
}

/**
 * Add calendar years to the birth wall-clock, preserving local time of day.
 * `7 Oct 2007 14:32` + 80 years = `7 Oct 2087 14:32`. 29 Feb clamps to 28 Feb.
 */
export function addYears(anchor: BirthAnchor, years: number): number {
  const w = wallClockAt(anchor.ms, anchor.offsetMinutes);
  return msFromWallClock({ ...w, year: w.year + years }, anchor.offsetMinutes, msRemainderOf(anchor));
}

/**
 * Add calendar months to the birth wall-clock, preserving local time of day.
 * Always measured from the birth anchor, so an odd birth day (31st) never
 * drifts across successive 6-month steps.
 */
export function addMonths(anchor: BirthAnchor, months: number): number {
  const w = wallClockAt(anchor.ms, anchor.offsetMinutes);
  const total = w.year * 12 + (w.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return msFromWallClock({ ...w, year, month }, anchor.offsetMinutes, msRemainderOf(anchor));
}

/** Target end = birth + lifespan calendar years. */
export function getTargetEndMs(anchor: BirthAnchor, lifespanYears: number): number {
  return addYears(anchor, lifespanYears);
}

/**
 * The lifetime split into consecutive 6-calendar-month periods starting at the
 * exact birth timestamp. The final period is short when the target end does not
 * land on a 6-month boundary.
 */
export function getSixMonthBlocks(anchor: BirthAnchor, targetMs: number): Interval[] {
  const blocks: Interval[] = [];
  if (!Number.isFinite(targetMs) || targetMs <= anchor.ms) return blocks;

  for (let i = 0; i < MAX_BLOCKS; i++) {
    const startMs = addMonths(anchor, i * 6);
    if (startMs >= targetMs) break;
    const endMs = Math.min(addMonths(anchor, (i + 1) * 6), targetMs);
    if (endMs <= startMs) break;
    blocks.push({ index: i, startMs, endMs });
    if (endMs >= targetMs) break;
  }
  return blocks;
}

/* ------------------------------------------------------------------ *
 * Weeks: continuous 7-day periods from birth
 * ------------------------------------------------------------------ */

/** Week 1 runs from the birth instant to exactly 7x24h later. */
export function getWeekInterval(birthMs: number, index: number): Interval {
  return {
    index,
    startMs: birthMs + index * WEEK_MS,
    endMs: birthMs + (index + 1) * WEEK_MS,
  };
}

/**
 * Every whole week overlapping `[startMs, endMs)`, keeping absolute week
 * numbering so weeks stay continuous across block boundaries.
 */
export function getWeeksOverlapping(birthMs: number, startMs: number, endMs: number): Interval[] {
  if (endMs <= startMs) return [];
  const first = Math.max(0, Math.floor((startMs - birthMs) / WEEK_MS));
  const last = Math.max(first, Math.floor((endMs - 1 - birthMs) / WEEK_MS));

  const out: Interval[] = [];
  for (let i = first; i <= last; i++) {
    const week = getWeekInterval(birthMs, i);
    if (week.endMs <= startMs || week.startMs >= endMs) continue;
    out.push(week);
  }
  return out;
}

/** 1-based absolute week number. */
export function weekNumber(index: number): number {
  return index + 1;
}

/**
 * 1-based position of a week within the block that contains it, for display.
 *
 * The underlying 7-day periods are still absolute from birth; this only
 * relabels them so a block reads "Week 1…27" instead of "Week 1592…1618".
 */
export function weekNumberInBlock(
  birthMs: number,
  blockStartMs: number,
  blockEndMs: number,
  weekIndex: number,
): number {
  const weeks = getWeeksOverlapping(birthMs, blockStartMs, blockEndMs);
  const position = weeks.findIndex((w) => w.index === weekIndex);
  return position >= 0 ? position + 1 : weekIndex + 1;
}

/** The calendar week containing `ms`, for locating "now". */
export function currentWeekIndex(birthMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - birthMs) / WEEK_MS));
}

/* ------------------------------------------------------------------ *
 * Days: local calendar days 00:00 -> 23:59:59.999
 * ------------------------------------------------------------------ */

export interface CalendarDay extends Interval {
  /** `YYYY-MM-DD` in the display zone. */
  key: string;
}

/** The seven local calendar days covering the week that starts at `weekStartMs`. */
export function getWeekCalendarDays(weekStartMs: number, tz: string): CalendarDay[] {
  const first = startOfDayInZone(weekStartMs, tz);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const startMs = addCalendarDays(first, i, tz);
    days.push({
      index: i,
      startMs,
      endMs: addCalendarDays(first, i + 1, tz) - 1,
      key: dayKeyInZone(startMs, tz),
    });
  }
  return days;
}

export interface CalendarDayRange {
  key: string;
  startMs: number;
  endMs: number;
}

/** Local midnight at the start of the day `dayKey` refers to. */
export function getDayRange(dayKey: string, tz: string): CalendarDayRange {
  const [y, m, d] = dayKey.split("-").map(Number);
  const startMs = startOfDayInZone(utcMs(y, m, d, 0, 0, 0), tz);
  return { key: dayKey, startMs, endMs: addCalendarDays(startMs, 1, tz) - 1 };
}

/* ------------------------------------------------------------------ *
 * Status and progress
 * ------------------------------------------------------------------ */

export function statusOf(startMs: number, endMs: number, nowMs: number): SegmentStatus {
  if (nowMs >= endMs) return "past";
  if (nowMs < startMs) return "future";
  return "present";
}

/** Elapsed lifetime / total lifetime, as a percentage. */
export function getProgress(birthMs: number, targetMs: number, nowMs: number): number {
  const total = targetMs - birthMs;
  if (total <= 0) return 0;
  const elapsed = Math.min(Math.max(nowMs - birthMs, 0), total);
  return (elapsed / total) * 100;
}
