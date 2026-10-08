import type { SegmentStatus } from "@/lib/time";

type Weight = "strong" | "medium";

/**
 * Label colours per cell fill.
 *
 * Each fill needs its own foreground: a past cell is a mid tone in both
 * schemes, the present cell is always the same saturated accent, and a
 * remaining cell inherits the page foreground. Reusing `--foreground` on the
 * accent cell would put near-black text on mid-tone blue in light mode.
 *
 * Only two weights exist because fading a label with opacity drops it under
 * 4.5:1 on these fills. Hierarchy comes from size and weight instead.
 */
const TEXT: Record<SegmentStatus, Record<Weight, string>> = {
  past: {
    strong: "text-background",
    medium: "text-background/95",
  },
  present: {
    strong: "text-graph-present-foreground",
    medium: "text-graph-present-foreground/95",
  },
  future: {
    strong: "text-foreground/95",
    medium: "text-foreground/90",
  },
};

export function segmentTextClass(status: SegmentStatus, weight: Weight): string {
  return TEXT[status][weight];
}
