import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Zoom-style transitions between drill-down levels.
 *
 * Drilling in records the rect of the block that was clicked. The incoming view
 * is then animated from exactly that rect — translated and scaled — up to its
 * own natural size, so the block appears to grow into the whole view. Going back
 * plays the motion in reverse: the current view collapses back into the cell it
 * came from before the route changes.
 *
 * Uses the Web Animations API so no measurement happens during React's render
 * pass and no CSS class has to be re-triggered.
 */

const DURATION_MS = 380;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The transform that maps `container` onto `origin`, with the origin pinned to
 * its top-left corner.
 */
function transformFromRects(container: DOMRect, origin: DOMRect): string {
  const scaleX = origin.width / Math.max(container.width, 1);
  const scaleY = origin.height / Math.max(container.height, 1);
  const x = origin.left - container.left;
  const y = origin.top - container.top;
  return `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`;
}

export interface MorphApi {
  /** Drill in: `origin` is the clicked cell, `toKey` the destination route. */
  goForward: (origin: DOMRect, toKey: string, navigate: () => void) => void;
  /** Zoom back out into the cell this view was drilled in from. */
  goBack: (navigate: () => void) => void;
}

/** Marks the single element that morphs. There is only ever one view surface. */
const SURFACE_SELECTOR = "[data-morph-surface]";

function getSurface(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SURFACE_SELECTOR);
}

/**
 * @param routeKey Identifies the currently rendered route; the incoming
 *   animation replays whenever it changes.
 */
export function useViewMorph(routeKey: string): MorphApi {
  // Where each route was entered from, so the reverse motion has a target.
  const originsRef = useRef(new Map<string, DOMRect>());
  const pendingRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  // Read through a ref so `goBack` stays stable and always targets the route
  // currently on screen. Chained multi-level zoom-outs call it repeatedly
  // across renders, so closing over `routeKey` would go stale after the first
  // step and collapse the view into the wrong cell.
  const routeKeyRef = useRef(routeKey);
  useEffect(() => {
    routeKeyRef.current = routeKey;
  }, [routeKey]);

  // Runs on mount of each newly routed view.
  useLayoutEffect(() => {
    const el = getSurface();
    const pending = pendingRef.current;
    if (!el || !pending || pending !== routeKey) return;

    const origin = originsRef.current.get(routeKey);
    pendingRef.current = null;
    if (!origin || prefersReducedMotion()) return;

    const from = transformFromRects(el.getBoundingClientRect(), origin);
    const animation = el.animate(
      [
        { transform: from, opacity: 0.2 },
        { transform: "none", opacity: 1 },
      ],
      { duration: DURATION_MS, easing: EASING, fill: "both" },
    );

    return () => {
      animation.cancel();
    };
  }, [routeKey]);

  const goForward = useCallback((origin: DOMRect, toKey: string, navigate: () => void) => {
    originsRef.current.set(toKey, origin);
    pendingRef.current = toKey;
    navigate();
  }, []);

  const goBack = useCallback((navigate: () => void) => {
    const el = getSurface();
    const origin = originsRef.current.get(routeKeyRef.current);

    // The incoming animation must not also play when arriving from a deeper view.
    pendingRef.current = null;

    if (!el || !origin || busyRef.current || prefersReducedMotion()) {
      navigate();
      return;
    }

    busyRef.current = true;
    const to = transformFromRects(el.getBoundingClientRect(), origin);
    const animation = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: to, opacity: 0 },
      ],
      { duration: DURATION_MS * 0.85, easing: EASING, fill: "both" },
    );

    const finish = () => {
      busyRef.current = false;
      navigate();
    };
    animation.finished.then(finish, finish);
  }, []);

  return { goForward, goBack };
}
