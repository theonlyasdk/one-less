import { useMemo } from "react";

import { Legend, SegmentButton } from "@/components/life/SegmentCell";
import { segmentTextClass } from "@/components/life/segmentText";
import { formatAge, formatDate, formatPercent, formatSpanMs, formatYearRange } from "@/lib/format";
import {
  getProgress,
  getSixMonthBlocks,
  statusOf,
  zonedParts,
  type BirthAnchor,
  type Interval,
} from "@/lib/time";
import { cn } from "cn";

interface LifeViewProps {
  anchor: BirthAnchor;
  targetMs: number;
  nowMs: number;
  tz: string;
  onSelectBlock: (blockIndex: number, origin: DOMRect) => void;
}

/**
 * The whole lifespan as 6-month blocks.
 *
 * The accent block is not a solid tile: it fills to the exact share of the
 * current block that has elapsed, so the marker reads as a progress bar and the
 * rail above tracks the lifetime as a whole.
 */
export function LifeView({ anchor, targetMs, nowMs, tz, onSelectBlock }: LifeViewProps) {
  const blocks = useMemo(() => getSixMonthBlocks(anchor, targetMs), [anchor, targetMs]);

  const progress = getProgress(anchor.ms, targetMs, nowMs);
  const remainingMs = Math.max(0, targetMs - nowMs);

  // Blocks are full 6-month periods except possibly the last one, which is
  // short whenever the target end misses a boundary.
  const nominalMs = blocks.length > 1 ? blocks[1].endMs - blocks[1].startMs : Infinity;
  const yearOf = (ms: number) => zonedParts(ms, tz).year;
  const elapsedWithin = (segment: Interval) =>
    segment.endMs > segment.startMs
      ? (nowMs - segment.startMs) / (segment.endMs - segment.startMs)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
        <Stat label="Age" value={formatAge(anchor.ms, nowMs, tz)} />
        <Stat label="Lived" value={`${formatPercent(progress)}%`} />
        <Stat label="Remaining" value={formatSpanMs(remainingMs)} />
        <Stat label="Blocks" value={String(blocks.length)} />
      </dl>

      <ProgressRail progress={progress} />

      <div
        role="list"
        aria-label="Lifetime in six-month blocks"
        className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1"
        style={{ "--stagger-step": "3.5ms" } as React.CSSProperties}
      >
        {blocks.map((block) => {
          const status = statusOf(block.startMs, block.endMs, nowMs);
          // Exactly one block is "present" at any moment.
          const isNow = status === "present";
          const isShort = block.endMs - block.startMs < nominalMs * 0.95;
          // Label the first block of each calendar year so the grid can be read.
          const startsNewYear =
            block.index === 0 || yearOf(block.startMs) !== yearOf(blocks[block.index - 1].startMs);
          const range = formatYearRange(block.startMs, block.endMs, tz);
          const from = formatDate(block.startMs, tz);
          const to = formatDate(block.endMs, tz);

          return (
            <SegmentButton
              key={block.index}
              role="listitem"
              status={status}
              now={isNow}
              progress={isNow ? elapsedWithin(block) : undefined}              className={cn(
                "stagger flex aspect-square items-center justify-center",
                isShort && "opacity-70",
              )}
              style={{ "--stagger-i": block.index } as React.CSSProperties}
              title={`${range} · ${from} → ${to}${isShort ? " (partial)" : ""}`}
              aria-label={`${range}. ${from} to ${to}.${isShort ? " Partial period." : ""}`}
              onClick={(event) => onSelectBlock(block.index, event.currentTarget.getBoundingClientRect())}
            >
              {/* No year label on the current cell: the fill splits the tile and
                  any single colour would be unreadable on one half. */}
              {startsNewYear && !isNow ? (
                <span
                  className={cn(
                    "font-stats text-[0.5625rem] leading-none tabular-nums",
                    segmentTextClass(status, "medium"),
                  )}
                >
                  {yearOf(block.startMs)}
                </span>
              ) : null}
            </SegmentButton>
          );
        })}
      </div>

      <Legend />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-stats text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

/** Lifetime progress as one continuous bar. */
function ProgressRail({ progress }: { progress: number }) {
  const pct = `${Math.min(100, Math.max(0, progress))}%`;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100) / 100}
      aria-label="Lifetime lived"
      className="rail-track relative h-1.5 w-full overflow-hidden rounded-full bg-graph-future"
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-graph-present rail-fill"
        style={{ width: pct }}
      />
    </div>
  );
}
