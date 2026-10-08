import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { ActivityForm } from "@/components/life/ActivityForm";
import { ActivityList } from "@/components/life/ActivityList";
import { Button } from "@/components/ui/button";
import { formatDayHeading, formatMinutesLabel } from "@/lib/format";
import { getDayRange } from "@/lib/time";
import { sortActivities, type Activity } from "@/lib/storage";

interface DayViewProps {
  dayKey: string;
  tz: string;
  clock12h: boolean;
  activities: Activity[];
  onAdd: (activity: Activity) => void;
  onDelete: (id: string) => void;
}

/** Activities and notes for one local calendar day. */
export function DayView({ dayKey, tz, clock12h, activities, onAdd, onDelete }: DayViewProps) {
  const [adding, setAdding] = useState(false);
  const range = getDayRange(dayKey, tz);
  const ordered = sortActivities(activities);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <p className="font-display text-lg font-medium">{formatDayHeading(range.startMs, tz)}</p>
          <p className="text-sm text-muted-foreground tabular-nums">00:00 → 23:59</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          <PlusIcon data-icon="inline-start" />
          {adding ? "Close" : "Add activity"}
        </Button>
      </div>

      {/* Always mounted so the form can push the list down and retract back.
          `inert` keeps the collapsed controls out of the tab order. */}
      <div className="push" data-open={adding} inert={!adding}>
        <ActivityForm
          dayKey={dayKey}
          clock12h={clock12h}
          onAdd={(activity) => {
            onAdd(activity);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      </div>

      <ActivityList activities={ordered} clock12h={clock12h} onDelete={onDelete} />

      {ordered.length > 1 ? (
        <p className="sr-only">
          {ordered.length} activities totalling{" "}
          {formatMinutesLabel(ordered.reduce((s, a) => s + (a.durationMinute ?? 0), 0))}.
        </p>
      ) : null}
    </div>
  );
}
