import { useMemo } from "react";

import { Legend, SegmentButton } from "@/components/life/SegmentCell";
import { segmentTextClass } from "@/components/life/segmentText";
import { formatDate, formatTimeOfDay, formatWeekday } from "@/lib/format";
import { cn } from "cn";
import {
  dayKeyInZone,
  getWeekInterval,
  getWeekCalendarDays,
  statusOf,
  zonedParts,
} from "@/lib/time";

interface WeekViewProps {
  birthMs: number;
  weekIndex: number;
  /** Display number within the enclosing block, so blocks read "Week 1…27". */
  displayNumber: number;
  nowMs: number;
  tz: string;
  clock12h: boolean;
  /** Day keys that already have entries, so logged days are recognisable. */
  loggedDays: Set<string>;
  onSelectDay: (dayKey: string, origin: DOMRect) => void;
}

/**
 * One week as seven local calendar days.
 *
 * Unlike weeks themselves, these are true calendar days: 00:00 to 23:59:59.999
 * in the display zone. That keeps daily logging intuitive even though a week
 * is exactly 168 absolute hours. Today fills to the share of the day gone.
 */
export function WeekView({
  birthMs,
  weekIndex,
  displayNumber,
  nowMs,
  tz,
  clock12h,
  loggedDays,
  onSelectDay,
}: WeekViewProps) {
  const week = getWeekInterval(birthMs, weekIndex);
  const days = useMemo(() => getWeekCalendarDays(week.startMs, tz), [week.startMs, tz]);
  const todayKey = dayKeyInZone(nowMs, tz);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <h2 className="font-stats text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          Week {displayNumber}
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatDate(week.startMs, tz)} → {formatDate(week.endMs - 1, tz)}
        </p>
      </div>

      <div
        role="list"
        aria-label={`Days in week ${displayNumber}`}
        className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7"
        style={{ "--stagger-step": "26ms" } as React.CSSProperties}
      >
        {days.map((day) => {
          const status = statusOf(day.startMs, day.endMs, nowMs);
          const isToday = day.key === todayKey;
          const logged = loggedDays.has(day.key);
          const elapsed =
            day.endMs > day.startMs ? (nowMs - day.startMs) / (day.endMs - day.startMs) : 0;

          return (
            <SegmentButton
              key={day.key}
              role="listitem"
              status={status}
              now={isToday}
              progress={isToday ? elapsed : undefined}
              className="stagger flex aspect-[3/4] flex-col items-center justify-center gap-1 px-1.5 py-2"
              style={{ "--stagger-i": day.index } as React.CSSProperties}
              title={`${formatWeekday(day.startMs, tz)} ${formatDate(day.startMs, tz)} · 00:00 → 23:59`}
              aria-label={`${formatWeekday(day.startMs, tz)} ${formatDate(day.startMs, tz)}${isToday ? ", today" : ""}${logged ? ", has entries" : ""}`}
              onClick={(event) => onSelectDay(day.key, event.currentTarget.getBoundingClientRect())}
            >
              <span
                className={cn(
                  "text-[0.625rem] uppercase leading-none tracking-wide",
                  segmentTextClass(status, "medium"),
                )}
              >
                {formatWeekday(day.startMs, tz)}
              </span>
              <span
                className={cn(
                  "font-display text-lg leading-none tabular-nums",
                  segmentTextClass(status, "strong"),
                )}
              >
                {zonedParts(day.startMs, tz).day}
              </span>
              <span
                className={cn(
                  "text-[0.5625rem] leading-none",
                  segmentTextClass(status, "strong"),
                )}
              >
                {logged ? "logged" : isToday ? formatTimeOfDay(day.startMs, tz, clock12h) : null}
              </span>
            </SegmentButton>
          );
        })}
      </div>

      <Legend />
    </div>
  );
}
