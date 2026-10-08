import type { SegmentStatus } from "@/lib/time";
import { cn } from "cn";

const STATUS_CLASS: Record<SegmentStatus, string> = {
  past: "bg-graph-past",
  present: "bg-graph-present",
  future: "bg-graph-future",
};

/** True when the current cell shows a partial fill rather than a solid one. */
function isPartial(progress: number | undefined): progress is number {
  return progress != null && progress > 0 && progress < 1;
}

function cellClass(
  status: SegmentStatus,
  now: boolean,
  partial: boolean,
): string {
  return cn(
    "relative rounded-md",
    // A partial cell is drawn as remaining + an accent overlay, so the marker
    // can double as a progress bar instead of a solid block of colour.
    partial ? "bg-graph-future" : STATUS_CLASS[status],
    now && "z-10",
  );
}

export interface SegmentCellProps {
  status: SegmentStatus;
  /**
   * Marks the one segment containing now — the current block, week or day.
   * Drawn as an outline plus a slow halo, at every level of the graph.
   */
  now?: boolean;
  /**
   * 0–1 elapsed share of this segment. When it is strictly between 0 and 1 the
   * cell fills only that much, turning the "now" marker into a progress bar.
   * Omit for a solid fill.
   */
  progress?: number;
  className?: string;
}

/**
 * Draws the accent over the elapsed share of the cell.
 *
 * A sized gradient rather than an absolutely positioned overlay, so cell labels
 * are never occluded and the width can still transition smoothly.
 */
function progressStyle(progress: number): React.CSSProperties {
  return {
    backgroundImage:
      "linear-gradient(to right, var(--graph-present) 0 100%, transparent 100% 100%)",
    backgroundSize: `${Math.min(100, Math.max(0, progress * 100))}% 100%`,
    backgroundRepeat: "no-repeat",
    transition: "background-size 500ms cubic-bezier(0.22, 1, 0.36, 1)",
  };
}

/** The bright arc that traces around the current segment. */
function NowMarker() {
  return <span aria-hidden className="now-trace" />;
}

/**
 * One rounded rectangle in the life graph.
 *
 * Every level of the drill-down reuses this so the zoom reads as the same
 * object at a different resolution rather than four unrelated widgets.
 */
export function SegmentCell({
  status,
  now,
  progress,
  className,
  style,
  children,
  ...rest
}: SegmentCellProps & React.ComponentProps<"div">) {
  const partial = isPartial(progress);
  return (
    <div
      data-slot="segment-cell"
      data-status={status}
      data-now={now || undefined}
      className={cn(cellClass(status, Boolean(now), partial), className)}
      style={partial ? { ...progressStyle(progress), ...style } : style}
      {...rest}
    >
      {children}
      {now ? <NowMarker /> : null}
    </div>
  );
}

export interface SegmentButtonProps extends SegmentCellProps {}

/** Same visual as {@link SegmentCell}, but keyboard-reachable. */
export function SegmentButton({
  status,
  now,
  progress,
  className,
  style,
  children,
  ...rest
}: SegmentButtonProps & React.ComponentProps<"button">) {
  const partial = isPartial(progress);
  return (
    <button
      type="button"
      data-slot="segment-cell"
      data-status={status}
      data-now={now || undefined}
      className={cn(
        cellClass(status, Boolean(now), partial),
        "pressable cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        // Press-in scale, kept out of `.pressable` so it composes with the
        // filter transition instead of overwriting it.
        "active:scale-[0.96]",
        className,
      )}
      style={partial ? { ...progressStyle(progress), ...style } : style}
      {...rest}
    >
      {children}
      {now ? <NowMarker /> : null}
    </button>
  );
}

/** Compact key explaining the three fills and the "now" outline. */
export function Legend() {
  const entries: { label: string; className: string }[] = [
    { label: "Lived", className: "bg-graph-past" },
    { label: "Now", className: "now-swatch" },
    { label: "Remaining", className: "bg-graph-future" },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-[3px]", entry.className)} />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
