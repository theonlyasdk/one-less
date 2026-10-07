export type ActivityType = "work" | "health" | "learning" | "social" | "rest" | "other";

export interface Activity {
  id: string;
  title: string;
  time?: string; // "HH:MM"
  durationMin?: number;
  type: ActivityType;
  notes?: string;
  createdAt: number;
}

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "work", label: "Work" },
  { value: "health", label: "Health" },
  { value: "learning", label: "Learning" },
  { value: "social", label: "Social" },
  { value: "rest", label: "Rest" },
  { value: "other", label: "Other" },
];

const SETTINGS_KEY = "one-less:settings:v1";
const ACTIVITIES_KEY = "one-less:activities:v1";

export interface Settings {
  birthMs: number;
  /** Offset minutes east of UTC captured at birth moment (for display fidelity). */
  birthTzOffsetMin: number;
  lifespanYears: number;
}

export function defaultSettings(): Settings {
  // Spec example: 7 October 2007, 14:32 (interpreted in device local tz)
  const birth = new Date(2007, 9, 7, 14, 32, 0, 0).getTime();
  return {
    birthMs: birth,
    birthTzOffsetMin: -new Date(birth).getTimezoneOffset(),
    lifespanYears: 80,
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const p = JSON.parse(raw) as Partial<Settings>;
    if (typeof p.birthMs !== "number" || Number.isNaN(p.birthMs)) return defaultSettings();
    const lifespan = typeof p.lifespanYears === "number" ? p.lifespanYears : 80;
    return {
      birthMs: p.birthMs,
      birthTzOffsetMin:
        typeof p.birthTzOffsetMin === "number"
          ? p.birthTzOffsetMin
          : -new Date(p.birthMs).getTimezoneOffset(),
      lifespanYears: Math.min(150, Math.max(1, Math.floor(lifespan) || 80)),
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export type ActivityMap = Record<string, Activity[]>; // dayKey -> activities

export function loadActivities(): ActivityMap {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as ActivityMap;
    if (typeof p !== "object" || p === null) return {};
    return p;
  } catch {
    return {};
  }
}

export function saveActivities(m: ActivityMap): void {
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(m));
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
