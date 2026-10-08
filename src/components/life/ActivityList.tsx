import { TrashIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatMinutesLabel, formatMinuteOfDay } from "@/lib/format";
import { ACTIVITY_TYPE_LABEL, type Activity } from "@/lib/storage";

interface ActivityListProps {
  activities: Activity[];
  clock12h: boolean;
  onDelete: (id: string) => void;
}

/** Chronological entries for one day, with a running time total. */
export function ActivityList({ activities, clock12h, onDelete }: ActivityListProps) {
  const totalMinutes = activities.reduce(
    (sum, a) => sum + (a.durationMinute ?? 0),
    0,
  );

  if (activities.length === 0) {
    return (
      <Empty className="border border-dashed py-10">
        <EmptyHeader>
          <EmptyTitle>Nothing logged</EmptyTitle>
          <EmptyDescription>Add what you did today.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {activities.map((activity) => (
          <li key={activity.id}>
            <Card className="py-0">
              {/* `items-center` keeps the delete button and both text blocks
                  optically centred however many lines the entry has. */}
              <CardContent className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex w-20 shrink-0 flex-col gap-0.5 text-left">
                  <span className="font-display text-sm leading-tight tabular-nums">
                    {activity.startMinute == null
                      ? "—"
                      : formatMinuteOfDay(activity.startMinute, clock12h)}
                  </span>
                  {activity.durationMinute != null ? (
                    <span className="text-xs leading-tight text-muted-foreground tabular-nums">
                      {formatMinutesLabel(activity.durationMinute)}
                    </span>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium">{activity.title}</span>
                    <Badge variant="secondary">{ACTIVITY_TYPE_LABEL[activity.type]}</Badge>
                  </div>
                  {activity.notes ? (
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {activity.notes}
                    </p>
                  ) : null}
                </div>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${activity.title}`}
                  onClick={() => onDelete(activity.id)}
                >
                  <TrashIcon />
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      {totalMinutes > 0 ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatMinutesLabel(totalMinutes)} logged
        </p>
      ) : null}
    </div>
  );
}
