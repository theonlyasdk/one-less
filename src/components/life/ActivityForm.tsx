import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  newActivityId,
  type Activity,
  type ActivityType,
} from "@/lib/storage";

interface ActivityFormProps {
  dayKey: string;
  clock12h: boolean;
  onAdd: (activity: Activity) => void;
  onCancel: () => void;
}

function parseMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // `HH:MM` or plain minutes.
  const colon = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  const asNumber = Number(trimmed);
  if (!Number.isFinite(asNumber) || asNumber < 0) return null;
  return Math.min(24 * 60 - 1, Math.round(asNumber));
}

/** `90` or `1h 30m` or `1:30` -> minutes. */
function parseDuration(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hm = /^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(\d+)?\s*m?$/i.exec(trimmed);
  if (hm) {
    const hours = Number(hm[1]);
    const mins = hm[2] ? Number(hm[2]) : 0;
    return Math.round(hours * 60 + mins);
  }
  const colon = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return Math.round(asNumber);
  return null;
}

export function ActivityForm({ dayKey, clock12h, onAdd, onCancel }: ActivityFormProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>("work");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  const startMinute = parseMinutes(start);
  const durationMinute = parseDuration(duration);
  const startInvalid = start.trim() !== "" && startMinute == null;
  const durationInvalid = duration.trim() !== "" && durationMinute == null;
  const canSubmit = title.trim().length > 0 && !startInvalid && !durationInvalid;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onAdd({
      id: newActivityId(),
      dayKey,
      title: title.trim(),
      type,
      startMinute,
      durationMinute,
      notes: notes.trim(),
    });
    setTitle("");
    setStart("");
    setDuration("");
    setNotes("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="activity-title">Activity</FieldLabel>
          <Input
            id="activity-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Shipped the release"
            autoFocus
          />
        </Field>

        <Field>
          <FieldLabel>Type</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={type}
            onValueChange={(v) => v && setType(v as ActivityType)}
            className="flex-wrap"
          >
            {ACTIVITY_TYPES.map((t) => (
              <ToggleGroupItem key={t} value={t}>
                {ACTIVITY_TYPE_LABEL[t]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={startInvalid || undefined}>
            <FieldLabel htmlFor="activity-start">
              Start{clock12h ? " (e.g. 9:30 am)" : " (HH:MM)"}
            </FieldLabel>
            <Input
              id="activity-start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder={clock12h ? "9:30 am" : "09:30"}
              inputMode="numeric"
              aria-invalid={startInvalid || undefined}
            />
          </Field>

          <Field data-invalid={durationInvalid || undefined}>
            <FieldLabel htmlFor="activity-duration">Duration (minutes)</FieldLabel>
            <Input
              id="activity-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="90"
              inputMode="numeric"
              aria-invalid={durationInvalid || undefined}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="activity-notes">Notes</FieldLabel>
          <Textarea
            id="activity-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={3}
          />
        </Field>
      </FieldGroup>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          Add
        </Button>
      </div>
    </form>
  );
}
