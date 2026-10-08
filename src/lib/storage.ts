/**
 * Persistence. Everything is local to the browser; there is no account and no
 * network call. Settings hold the birth timestamp as an ISO string *with its
 * offset*, so the original time zone survives a reload.
 */

import { anchorInZone, birthAnchorToIso, zonedWallToMs } from "@/lib/time";

const SETTINGS_KEY = "oneless.settings.v1";
const ACTIVITIES_KEY = "oneless.activities.v1";

export const ACTIVITY_TYPES = [
  "work",
  "study",
  "sleep",
  "exercise",
  "social",
  "chores",
  "rest",
  "other",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  work: "Work",
  study: "Study",
  sleep: "Sleep",
  exercise: "Exercise",
  social: "Social",
  chores: "Chores",
  rest: "Rest",
  other: "Other",
};

export interface Settings {
  /** ISO 8601 birth timestamp including its UTC offset. */
  birthIso: string;
  /** Target lifespan in calendar years, added to the birth instant. */
  lifespanYears: number;
  clock12h: boolean;
  /** IANA zone used for calendar days and displayed dates. */
  tz: string;
}

export interface Activity {
  id: string;
  /** `YYYY-MM-DD` in the display zone. */
  dayKey: string;
  title: string;
  type: ActivityType;
  /** Minutes from local midnight; null when the user gave no start time. */
  startMinute: number | null;
  /** Minutes; null when the user gave no duration. */
  durationMinute: number | null;
  notes: string;
}

export const MIN_LIFESPAN_YEARS = 1;
export const MAX_LIFESPAN_YEARS = 122;

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Zones where a 12-hour clock is the local convention.
 *
 * `Asia/Calcutta` is the legacy alias browsers still report for India. The
 * Windows-style spellings are included because some environments report those
 * from `resolvedOptions().timeZone` instead of an IANA name.
 */
const TWELVE_HOUR_ZONES = new Set([
  "Asia/Kolkata",
  "Asia/Calcutta",
  "Asia/Kolkata Standard Time",
  "India Standard Time",
]);

/** 12-hour by default in India, 24-hour everywhere else. */
export function defaultClock12h(tz: string): boolean {
  return TWELVE_HOUR_ZONES.has(tz);
}

export function defaultSettings(): Settings {
  const tz = localTimeZone();
  // A neutral placeholder so the graph renders on first run: 30 years ago at
  // 08:20 local, retaining the host zone's own offset. Editable in Settings.
  const birthMs = zonedWallToMs(`${new Date().getFullYear() - 30}-01-15T08:20`, tz);
  return {
    birthIso: birthAnchorToIso(anchorInZone(birthMs, tz)),
    lifespanYears: 80,
    clock12h: defaultClock12h(tz),
    tz,
  };
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private-mode failures are non-fatal; the session still works.
  }
}

export function loadSettings(): Settings {
  const fallback = defaultSettings();
  const raw = readJson(SETTINGS_KEY);
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<Settings>;

  const birthIso = isString(data.birthIso) ? data.birthIso : fallback.birthIso;
  if (Number.isNaN(Date.parse(birthIso))) return fallback;

  const years = Number(data.lifespanYears);
  return {
    birthIso,
    lifespanYears: Number.isFinite(years)
      ? Math.min(MAX_LIFESPAN_YEARS, Math.max(MIN_LIFESPAN_YEARS, Math.round(years)))
      : fallback.lifespanYears,
    clock12h: typeof data.clock12h === "boolean" ? data.clock12h : fallback.clock12h,
    tz: isString(data.tz) && isValidTimeZone(data.tz) ? data.tz : fallback.tz,
  };
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function timeZoneOptions(): string[] {
  const zones = new Set<string>();
  try {
    zones.add(localTimeZone());
    zones.add("UTC");
  } catch {
    zones.add("UTC");
  }
  // A representative spread of common zones, plus whatever the host reports.
  for (const tz of [
    "Pacific/Honolulu",
    "America/Anchorage",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "America/Halifax",
    "America/Sao_Paulo",
    "Atlantic/Reykjavik",
    "Europe/London",
    "Europe/Lisbon",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Athens",
    "Europe/Kyiv",
    "Europe/Istanbul",
    "Europe/Moscow",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "Africa/Nairobi",
    "Asia/Jerusalem",
    "Asia/Dubai",
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Dhaka",
    "Asia/Bangkok",
    "Asia/Jakarta",
    "Asia/Singapore",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Australia/Perth",
    "Australia/Adelaide",
    "Australia/Sydney",
    "Pacific/Auckland",
    "Pacific/Honolulu",
  ]) {
    if (isValidTimeZone(tz)) zones.add(tz);
  }
  return [...zones].sort();
}

function sanitizeActivity(value: unknown): Activity | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Partial<Activity>;
  if (!isString(a.id) || !isString(a.dayKey) || !isString(a.title)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dayKey)) return null;
  const type = ACTIVITY_TYPES.includes(a.type as ActivityType)
    ? (a.type as ActivityType)
    : "other";
  return {
    id: a.id,
    dayKey: a.dayKey,
    title: a.title,
    type,
    startMinute: clampMinute(a.startMinute),
    durationMinute: clampDuration(a.durationMinute),
    notes: isString(a.notes) ? a.notes : "",
  };
}

function clampMinute(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(24 * 60 - 1, Math.round(n));
}

function clampDuration(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(24 * 60, Math.round(n));
}

export function loadActivities(): Record<string, Activity[]> {
  const raw = readJson(ACTIVITIES_KEY);
  if (!raw || typeof raw !== "object") return {};

  const out: Record<string, Activity[]> = {};
  for (const [dayKey, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || !Array.isArray(list)) continue;
    const items = list.map(sanitizeActivity).filter((a): a is Activity => a !== null);
    if (items.length) out[dayKey] = items;
  }
  return out;
}

export function saveActivities(byDay: Record<string, Activity[]>): void {
  writeJson(ACTIVITIES_KEY, byDay);
}

export function newActivityId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Chronological: by start time, with untimed entries last. */
export function sortActivities(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    const aStart = a.startMinute ?? Number.POSITIVE_INFINITY;
    const bStart = b.startMinute ?? Number.POSITIVE_INFINITY;
    if (aStart !== bStart) return aStart - bStart;
    return a.id.localeCompare(b.id);
  });
}
