import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { BlockView } from "@/components/life/BlockView";
import { DayView } from "@/components/life/DayView";
import { LifeView } from "@/components/life/LifeView";
import { SettingsDialog } from "@/components/life/SettingsDialog";
import { ThemeProvider } from "@/components/life/ThemeProvider";
import { useTheme } from "@/components/life/themeContext";
import { ThemeToggle } from "@/components/life/ThemeToggle";
import { ViewHeader, type Crumb } from "@/components/life/ViewHeader";
import { useViewMorph } from "@/components/life/useViewMorph";
import { WeekView } from "@/components/life/WeekView";
import { Toaster } from "@/components/ui/sonner";
import { formatDate, formatWeekday, formatYearRange } from "@/lib/format";
import { LIFE_ROUTE, loadRoute, parentRoute, routeKey, saveRoute, type Route } from "@/lib/nav";
import {
  createBirthAnchor,
  getDayRange,
  getSixMonthBlocks,
  getTargetEndMs,
  weekNumberInBlock,
} from "@/lib/time";
import {
  loadActivities,
  loadSettings,
  saveActivities,
  saveSettings,
  type Activity,
  type Settings,
} from "@/lib/storage";

/** Ticks the "now" marker without re-rendering faster than the display needs. */
function useNow(stepMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}

export default function App() {
  return (
    <ThemeProvider>
      <LifeApp />
      <AppToaster />
    </ThemeProvider>
  );
}

/** Keeps toasts in step with the theme toggle rather than the OS setting. */
function AppToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-center" />;
}

function LifeApp() {
  const [settings, setSettings] = useState<Settings>(() => {
    // Persist immediately so the first-run placeholder cannot drift with the
    // calendar before the user ever opens Settings.
    const loaded = loadSettings();
    saveSettings(loaded);
    return loaded;
  });
  const [route, setRoute] = useState<Route>(() => loadRoute() ?? LIFE_ROUTE);
  const [byDay, setByDay] = useState<Record<string, Activity[]>>(loadActivities);
  const nowMs = useNow();

  const anchor = useMemo(() => createBirthAnchor(settings.birthIso), [settings.birthIso]);
  const targetMs = useMemo(
    () => getTargetEndMs(anchor, settings.lifespanYears),
    [anchor, settings.lifespanYears],
  );

  const handleSaveSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
    // Worth confirming: the birth or lifespan change redraws the whole graph.
    toast.success("Settings saved");
  }, []);

  // Changing the birth instant or lifespan can leave the current position
  // outside the graph, so fall back to the whole-life view by derivation
  // rather than rewriting state in an effect.
  const blockCount = useMemo(() => getSixMonthBlocks(anchor, targetMs).length, [anchor, targetMs]);
  const activeRoute: Route =
    route.view !== "life" && route.blockIndex >= blockCount ? LIFE_ROUTE : route;

  // Persist the drill-down position so a reload resumes where you left off.
  useEffect(() => {
    saveRoute(activeRoute);
  }, [activeRoute]);

  const morphRef = useViewMorph(routeKey(activeRoute));

  // Breadcrumbs slide out while the view collapses, then back in as the parent
  // renders. Forward navigation remounts them instead, which replays the slide-in.
  const [crumbsExiting, setCrumbsExiting] = useState(false);

  // Every way out of a deeper view goes through the same zoom-out.
  const goUp = useCallback(() => {
    const parent = parentRoute(activeRoute);
    if (!parent) return;
    setCrumbsExiting(true);
    morphRef.goBack(() => {
      setRoute(parent);
      setCrumbsExiting(false);
    });
  }, [activeRoute, morphRef]);

  /**
   * Zoom out to an ancestor crumb one level at a time.
   *
   * Clicking `Life` from the day view should feel like stepping back through
   * week, then period, then life — not teleporting — so the route chain is
   * walked with the collapse animation between each hop.
   */
  const goUpTo = useCallback(
    (target: Route) => {
      if (routeKey(target) === routeKey(activeRoute)) return;

      // parent(1), parent(2), ... target
      const chain: Route[] = [];
      let cursor: Route | null = activeRoute;
      while (cursor && routeKey(cursor) !== routeKey(target)) {
        const parent = parentRoute(cursor);
        if (!parent) return; // target is not an ancestor
        chain.push(parent);
        cursor = parent;
      }

      let step = 0;
      const advance = () => {
        if (step >= chain.length) {
          setCrumbsExiting(false);
          return;
        }
        const next = chain[step++];
        setCrumbsExiting(true);
        morphRef.goBack(() => {
          setRoute(next);
          advance();
        });
      };
      advance();
    },
    [activeRoute, morphRef],
  );

  // Escape and Backspace zoom back out, matching the back control.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!parentRoute(activeRoute)) return;
      event.preventDefault();
      goUp();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRoute, goUp]);

  const addActivity = useCallback((activity: Activity) => {
    setByDay((prev) => {
      const next = { ...prev, [activity.dayKey]: [...(prev[activity.dayKey] ?? []), activity] };
      saveActivities(next);
      return next;
    });
  }, []);

  /**
   * Deleting is the only destructive action in the app, so it is undoable from
   * the toast rather than asking for confirmation every time.
   */
  const deleteActivity = useCallback((dayKey: string, id: string) => {
    let removed: Activity | undefined;

    setByDay((prev) => {
      const list = prev[dayKey] ?? [];
      const target = list.find((a) => a.id === id);
      if (!target) return prev;

      removed = target;
      const next = { ...prev };
      const kept = list.filter((a) => a.id !== id);
      if (kept.length) next[dayKey] = kept;
      else delete next[dayKey];
      saveActivities(next);
      return next;
    });

    if (!removed) return;
    const activity = removed;

    toast("Activity deleted", {
      description: activity.title,
      action: {
        label: "Undo",
        onClick: () => {
          setByDay((prev) => {
            const next = {
              ...prev,
              [dayKey]: [...(prev[dayKey] ?? []), activity],
            };
            saveActivities(next);
            return next;
          });
        },
      },
    });
  }, []);

  const loggedDays = useMemo(() => new Set(Object.keys(byDay)), [byDay]);

  // Weeks are numbered within their block for display; the 7-day periods
  // themselves stay continuous from birth.
  const displayWeekNumber = useMemo(() => {
    if (activeRoute.view === "life" || activeRoute.view === "block") return null;
    const block = getSixMonthBlocks(anchor, targetMs)[activeRoute.blockIndex];
    if (!block) return activeRoute.weekIndex + 1;
    return weekNumberInBlock(anchor.ms, block.startMs, block.endMs, activeRoute.weekIndex);
  }, [anchor, targetMs, activeRoute]);

  const crumbs = useMemo<Crumb[]>(() => {
    if (activeRoute.view === "life") return [];

    const blocks = getSixMonthBlocks(anchor, targetMs);
    const block = blocks[activeRoute.blockIndex];
    if (!block) return [];

    const life: Crumb = { label: "Life", onClick: () => goUpTo(LIFE_ROUTE) };
    const blockRoute: Route = { view: "block", blockIndex: activeRoute.blockIndex };
    const blockCrumb: Crumb = {
      label: formatYearRange(block.startMs, block.endMs, settings.tz),
      onClick: () => goUpTo(blockRoute),
    };

    if (activeRoute.view === "block") return [life, blockCrumb];

    const weekRoute: Route = {
      view: "week",
      blockIndex: activeRoute.blockIndex,
      weekIndex: activeRoute.weekIndex,
    };
    const weekCrumb: Crumb = {
      label: `Week ${displayWeekNumber ?? activeRoute.weekIndex + 1}`,
      onClick: () => goUpTo(weekRoute),
    };

    if (activeRoute.view === "week") return [life, blockCrumb, weekCrumb];

    const day = getDayRange(activeRoute.dayKey, settings.tz);
    return [
      life,
      blockCrumb,
      weekCrumb,
      { label: `${formatWeekday(day.startMs, settings.tz)} ${formatDate(day.startMs, settings.tz)}` },
    ];
  }, [anchor, targetMs, activeRoute, settings.tz, displayWeekNumber, goUpTo]);

  const view = (() => {
    switch (activeRoute.view) {
      case "life":
        return (
          <LifeView
            anchor={anchor}
            targetMs={targetMs}
            nowMs={nowMs}
            tz={settings.tz}
            onSelectBlock={(blockIndex, origin) => {
              const next = { view: "block", blockIndex } as const;
              morphRef.goForward(origin, routeKey(next), () => setRoute(next));
            }}
          />
        );
      case "block":
        return (
          <BlockView
            anchor={anchor}
            targetMs={targetMs}
            blockIndex={activeRoute.blockIndex}
            nowMs={nowMs}
            tz={settings.tz}
            onSelectWeek={(weekIndex, origin) => {
              const next = {
                view: "week",
                blockIndex: activeRoute.blockIndex,
                weekIndex,
              } as const;
              morphRef.goForward(origin, routeKey(next), () => setRoute(next));
            }}
          />
        );
      case "week":
        return (
          <WeekView
            birthMs={anchor.ms}
            weekIndex={activeRoute.weekIndex}
            displayNumber={displayWeekNumber ?? activeRoute.weekIndex + 1}
            nowMs={nowMs}
            tz={settings.tz}
            clock12h={settings.clock12h}
            loggedDays={loggedDays}
            onSelectDay={(dayKey, origin) => {
              const next = {
                view: "day",
                blockIndex: activeRoute.blockIndex,
                weekIndex: activeRoute.weekIndex,
                dayKey,
              } as const;
              morphRef.goForward(origin, routeKey(next), () => setRoute(next));
            }}
          />
        );
      case "day":
        return (
          <DayView
            dayKey={activeRoute.dayKey}
            tz={settings.tz}
            clock12h={settings.clock12h}
            activities={byDay[activeRoute.dayKey] ?? []}
            onAdd={addActivity}
            onDelete={(id) => deleteActivity(activeRoute.dayKey, id)}
          />
        );
    }
  })();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      {/* The left slot keeps its height even at the root, so the settings
          control never shifts as the drill-down changes. */}
      <div className="flex min-h-7 items-start justify-between gap-4">
        <div>
          {crumbs.length > 0 ? (
            <ViewHeader crumbs={crumbs} exiting={crumbsExiting} />
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          <SettingsDialog settings={settings} onSave={handleSaveSettings} />
        </div>
      </div>

      <main
        key={routeKey(activeRoute)}
        data-morph-surface=""
        className="view-morph flex-1"
      >
        {view}
      </main>

      <footer className="pt-2">
        <a
          href="https://theonlyasdk.github.io/"
          target="_blank"
          rel="noreferrer noopener"
          className="pressable inline-block rounded-sm text-xs text-muted-foreground/70 underline-offset-4 transition-colors hover:text-muted-foreground hover:underline"
        >
          theonlyasdk (c) 2026
        </a>
      </footer>
    </div>
  );
}
