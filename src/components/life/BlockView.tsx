import { useMemo } from "react";
import { cn } from "cn";

import { Legend, SegmentButton } from "@/components/life/SegmentCell";
import { segmentTextClass } from "@/components/life/segmentText";
import { formatDate, formatWeekday, formatYearRange } from "@/lib/format";
import {
  getSixMonthBlocks,
  getWeeksOverlapping,
  statusOf,
  weekNumber,
  type BirthAnchor,
  type Interval,
} from "@/lib/time";

interface BlockViewProps {
  anchor: BirthAnchor;
  targetMs: number;
  blockIndex: number;
  nowMs: number;
  tz: string;
  onSelectWeek: (weekIndex: number, origin: DOMRect) => void;
}

/**
 * The weeks inside one 6-month block.
 *
 * Week numbering is absolute from birth and deliberately does *not* restart at
 * the block boundary, so a week can straddle two blocks. Those straddling weeks
 * are called out here rather than silently clipped, and the current week fills
 * to the share of it that has elapsed.
 */
export function BlockView({ anchor, targetMs, blockIndex, nowMs, tz, onSelectWeek }: BlockViewProps) {
  const blocks = useMemo(() => getSixMonthBlocks(anchor, targetMs), [anchor, targetMs]);
  const block = blocks[blockIndex];

  const weeks = useMemo(
    () => (block ? getWeeksOverlapping(anchor.ms, block.startMs, block.endMs) : []),
    [anchor.ms, block],
  );

  if (!block) {
    return <p className="text-sm text-muted-foreground">That period is outside the current lifetime.</p>;
  }

  const range = formatYearRange(block.startMs, block.endMs, tz);
  const from = formatDate(block.startMs, tz);
  const to = formatDate(block.endMs, tz);
  const firstWeek = weeks[0]?.index ?? 0;
  const elapsedWithin = (week: Interval) =>
    week.endMs > week.startMs ? (nowMs - week.startMs) / (week.endMs - week.startMs) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <h2 className="font-stats text-3xl font-semibold tracking-tight text-balance tabular-nums sm:text-4xl">
          {range}
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {from} → {to}
        </p>
      </div>

      <div
        role="list"
        aria-label={`Weeks in ${range}`}
        className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1"
        style={{ "--stagger-step": "9ms" } as React.CSSProperties}
      >
        {weeks.map((week, i) => {
          const status = statusOf(week.startMs, week.endMs, nowMs);
          // Exactly one week is "present" at any moment, so status identifies it
          // without confusing the array position for the absolute week number.
          const isNow = status === "present";
          const straddles = week.startMs < block.startMs || week.endMs > block.endMs;
          // Weeks are numbered within the block for readability; the absolute
          // week of life stays in the accessible name and tooltip because the
          // underlying 7-day periods never restart at a block boundary.
          const withinBlock = i + 1;

          return (
            <SegmentButton
              key={week.index}
              role="listitem"
              status={status}
              now={isNow}
              progress={isNow ? elapsedWithin(week) : undefined}
              className="stagger flex aspect-[4/3] flex-col items-center justify-center gap-0.5 px-1"
              style={{ "--stagger-i": i } as React.CSSProperties}
              title={`Week ${withinBlock} · week ${weekNumber(week.index)} of life · ${formatDate(week.startMs, tz)} → ${formatDate(week.endMs, tz)}${straddles ? " (spans this period)" : ""}`}
              aria-label={`Week ${withinBlock} of this period, week ${weekNumber(week.index)} of life, ${formatWeekday(week.startMs, tz)} ${formatDate(week.startMs, tz)} to ${formatDate(week.endMs, tz)}.`}
              onClick={(event) =>
                onSelectWeek(week.index, event.currentTarget.getBoundingClientRect())
              }
            >
              {isNow ? null : (
                <span
                  className={cn(
                    "font-display text-xs leading-none tabular-nums",
                    segmentTextClass(status, "strong"),
                  )}
                >
                  {withinBlock}
                </span>
              )}
              <span
                className={cn("text-[0.5625rem] leading-none", segmentTextClass(status, "medium"))}
              >
                {isNow
                  ? `${Math.round(elapsedWithin(week) * 100)}%`
                  : straddles
                    ? "spans"
                    : formatDate(week.startMs, tz).replace(/ \d{4}$/, "")}
              </span>
            </SegmentButton>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        Weeks {weekNumber(firstWeek)}–{weekNumber(weeks.at(-1)?.index ?? firstWeek)} of life
      </p>

      <Legend />
    </div>
  );
}
