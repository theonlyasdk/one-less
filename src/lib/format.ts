import { daysInMonth, zonedParts } from "@/lib/time";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function parts(ms: number, tz: string) {
  return zonedParts(ms, tz);
}

/** Calendar-accurate age in whole years / months / days, in the display zone. */
export function calendarAge(birthMs: number, nowMs: number, tz: string) {
  const b = parts(birthMs, tz);
  const n = parts(nowMs, tz);

  let years = n.year - b.year;
  let months = n.month - b.month;
  let days = n.day - b.day;

  if (days < 0) {
    const prevMonth = n.month === 1 ? 12 : n.month - 1;
    const prevYear = n.month === 1 ? n.year - 1 : n.year;
    days += daysInMonth(prevYear, prevMonth);
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  return { years, months, days };
}

/** `28y 4m 12d` */
export function formatAge(birthMs: number, nowMs: number, tz: string): string {
  const { years, months, days } = calendarAge(birthMs, nowMs, tz);
  return `${years}y ${months}m ${days}d`;
}

export function formatWeekday(ms: number, tz: string): string {
  return WEEKDAY_SHORT[parts(ms, tz).weekday];
}

/** `12 Oct 2007` */
export function formatDate(ms: number, tz: string): string {
  const p = parts(ms, tz);
  return `${p.day} ${MONTH_SHORT[p.month - 1]} ${p.year}`;
}

/** `12 Oct 2007, 14:32` */
export function formatDateTime(ms: number, tz: string, clock12h: boolean): string {
  return `${formatDate(ms, tz)}, ${formatTimeOfDay(ms, tz, clock12h)}`;
}

/** `Sat 12 Oct 2007` */
export function formatDayHeading(ms: number, tz: string): string {
  return `${formatWeekday(ms, tz)} ${formatDate(ms, tz)}`;
}

/** `2007` or `2007–2008` when a period spans a year boundary. */
export function formatYearRange(startMs: number, endMs: number, tz: string): string {
  const from = parts(startMs, tz).year;
  // endMs is exclusive, so look at the last instant actually inside it.
  const to = parts(endMs - 1, tz).year;
  return from === to ? `${from}` : `${from}–${to}`;
}

/** `14:32` or `2:32 pm`. */
export function formatTimeOfDay(ms: number, tz: string, clock12h: boolean): string {
  const p = parts(ms, tz);
  if (!clock12h) {
    return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  }
  const suffix = p.hour < 12 ? "am" : "pm";
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h12}:${String(p.minute).padStart(2, "0")} ${suffix}`;
}

/** Minutes-from-midnight -> `09:30` / `9:30 am`. */
export function formatMinuteOfDay(minute: number, clock12h: boolean): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  if (!clock12h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** `1h 30m`, `45m`, or `—` when unknown. */
export function formatMinutesLabel(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Compact human span for large durations: `63y 4m`. */
export function formatSpanMs(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const years = Math.floor(days / 365.2425);
  const months = Math.floor((days - years * 365.2425) / 30.436875);
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}

/** Percentage with a fixed number of significant-looking decimals. */
export function formatPercent(value: number): string {
  if (value > 0 && value < 0.01) return "<0.01";
  if (value < 100 && value > 99.99) return ">99.99";
  return value.toFixed(2);
}
