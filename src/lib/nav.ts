/**
 * Drill-down navigation: Life -> 6 months -> weeks -> days -> activities.
 *
 * A route is a plain value rather than a stack, so going deeper replaces the
 * current view instead of stacking overlays. Each level carries its ancestors
 * so the breadcrumb can zoom back out without a history stack.
 */

export type Route =
  | { view: "life" }
  | { view: "block"; blockIndex: number }
  | { view: "week"; blockIndex: number; weekIndex: number }
  | { view: "day"; blockIndex: number; weekIndex: number; dayKey: string };

export const LIFE_ROUTE: Route = { view: "life" };

export function routeKey(route: Route): string {
  switch (route.view) {
    case "life":
      return "life";
    case "block":
      return `block:${route.blockIndex}`;
    case "week":
      return `week:${route.weekIndex}`;
    case "day":
      return `day:${route.dayKey}`;
  }
}

/** The route one level up, or null at the root. */
export function parentRoute(route: Route): Route | null {
  switch (route.view) {
    case "life":
      return null;
    case "block":
      return LIFE_ROUTE;
    case "week":
      return { view: "block", blockIndex: route.blockIndex };
    case "day":
      return { view: "week", blockIndex: route.blockIndex, weekIndex: route.weekIndex };
  }
}

export function sameRoute(a: Route, b: Route): boolean {
  return routeKey(a) === routeKey(b);
}

/**
 * Remembers the drill-down position so a reload lands where you left off
 * instead of back at the whole-life view.
 *
 * Settings and activities have their own storage keys; this only holds the
 * current route, and a malformed or stale value is simply ignored.
 */
const ROUTE_KEY = "oneless.route.v1";

export function loadRoute(): Route | null {
  try {
    const raw = window.localStorage.getItem(ROUTE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Route> & { view?: string };

    switch (data.view) {
      case "life":
        return LIFE_ROUTE;
      case "block":
        return Number.isInteger(data.blockIndex) && data.blockIndex! >= 0
          ? { view: "block", blockIndex: data.blockIndex! }
          : null;
      case "week":
        return Number.isInteger(data.blockIndex) &&
          data.blockIndex! >= 0 &&
          Number.isInteger(data.weekIndex) &&
          data.weekIndex! >= 0
          ? { view: "week", blockIndex: data.blockIndex!, weekIndex: data.weekIndex! }
          : null;
      case "day":
        return Number.isInteger(data.blockIndex) &&
          data.blockIndex! >= 0 &&
          Number.isInteger(data.weekIndex) &&
          data.weekIndex! >= 0 &&
          typeof data.dayKey === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(data.dayKey)
          ? {
              view: "day",
              blockIndex: data.blockIndex!,
              weekIndex: data.weekIndex!,
              dayKey: data.dayKey!,
            }
          : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function saveRoute(route: Route): void {
  try {
    window.localStorage.setItem(ROUTE_KEY, JSON.stringify(route));
  } catch {
    // Private-mode or quota failures are non-fatal; navigation still works.
  }
}
