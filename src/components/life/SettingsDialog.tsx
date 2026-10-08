import { Suspense, lazy, useMemo, useState } from "react";
import { CalendarIcon, SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatMinuteOfDay } from "@/lib/format";
import {
  birthAnchorToIso,
  createBirthAnchor,
  formatOffset,
  msToOffsetWall,
  wallToOffsetMs,
} from "@/lib/time";
import {
  MAX_LIFESPAN_YEARS,
  MIN_LIFESPAN_YEARS,
  timeZoneOptions,
  type Settings,
} from "@/lib/storage";
import { cn } from "cn";

interface SettingsDialogProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

/**
 * `react-day-picker` and `date-fns` are a sizeable chunk for a control that
 * only exists behind the date picker, so the calendar is fetched on demand.
 */
const Calendar = lazy(() =>
  import("@/components/ui/calendar").then((m) => ({ default: m.Calendar })),
);

function toDraft(settings: Settings) {
  // The birth is edited in the zone it was born in, which is retained
  // separately from the display zone.
  const anchor = createBirthAnchor(settings.birthIso);
  return {
    birthWall: msToOffsetWall(anchor.ms, anchor.offsetMinutes),
    birthOffset: anchor.offsetMinutes,
    tz: settings.tz,
    lifespanYears: String(settings.lifespanYears),
    clock12h: settings.clock12h,
  };
}

/**
 * Birth instant, display zone and target lifespan.
 *
 * The birth keeps its own UTC offset for its whole life, so changing the
 * display zone regroups calendar days without ever moving the birth instant.
 */
export function SettingsDialog({ settings, onSave }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(settings));

  // Re-seed from saved settings each time the dialog opens, so a cancelled edit
  // never leaks into the next visit.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(toDraft(settings));
    setOpen(next);
  }

  const zones = useMemo(() => timeZoneOptions(), []);

  const birthMs = wallToOffsetMs(draft.birthWall, draft.birthOffset);
  const birthInvalid = Number.isNaN(birthMs);
  const birthIso = birthInvalid
    ? null
    : birthAnchorToIso({ ms: birthMs, offsetMinutes: draft.birthOffset });

  // Split "YYYY-MM-DDTHH:mm" so the calendar drives the day and the input the time.
  const [birthDate = "", birthTime = ""] = draft.birthWall.split("T");
  const [timeHour = "00", timeMinute = "00"] = birthTime.split(":");

  const years = Number(draft.lifespanYears);
  const yearsInvalid =
    draft.lifespanYears.trim() === "" ||
    !Number.isFinite(years) ||
    years < MIN_LIFESPAN_YEARS ||
    years > MAX_LIFESPAN_YEARS;

  function setBirthDate(nextDate: Date | undefined) {
    if (!nextDate) return;
    const y = nextDate.getFullYear();
    const m = String(nextDate.getMonth() + 1).padStart(2, "0");
    const d = String(nextDate.getDate()).padStart(2, "0");
    setDraft((prev) => ({ ...prev, birthWall: `${y}-${m}-${d}T${prev.birthWall.split("T")[1] ?? "00:00"}` }));
  }

  function setBirthTime(value: string) {
    const [h = "00", mm = "00"] = value.split(":");
    setDraft((prev) => ({
      ...prev,
      birthWall: `${prev.birthWall.split("T")[0]}T${h.padStart(2, "0")}:${mm.padStart(2, "0")}`,
    }));
  }

  function handleSave() {
    if (!birthIso || yearsInvalid) return;
    onSave({
      birthIso,
      lifespanYears: Math.round(Number(draft.lifespanYears)),
      clock12h: draft.clock12h,
      tz: draft.tz,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Settings">
          <SettingsIcon />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          {/* Kept for screen readers, hidden visually to keep the dialog quiet. */}
          <DialogDescription className="sr-only">
            The lifetime runs from your exact birth moment to the end of your target lifespan.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field data-invalid={birthInvalid || undefined}>
            <FieldLabel>Date and time of birth</FieldLabel>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-empty={!birthDate}
                    className={cn(
                      "w-[9.5rem] justify-start text-left font-normal",
                      !birthDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon />
                    {birthDate ? formatDateParts(birthDate) : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Suspense fallback={<div className="h-72 w-72" />}>
                    <Calendar
                      mode="single"
                      selected={birthDate ? parseLocalDate(birthDate) : undefined}
                      onSelect={setBirthDate}
                      captionLayout="dropdown"
                      startMonth={FIRST_POSSIBLE_BIRTH}
                      endMonth={LAST_POSSIBLE_BIRTH}
                      disabled={{ after: TODAY }}
                    />
                  </Suspense>
                </PopoverContent>
              </Popover>

              <Input
                type="time"
                step={60}
                aria-label="Time of birth"
                className="w-[7.5rem]"
                value={`${timeHour}:${timeMinute}`}
                onChange={(e) => setBirthTime(e.target.value)}
                aria-invalid={birthInvalid || undefined}
              />
            </div>
            {birthIso ? (
              <FieldDescription className="tabular-nums">
                {formatMinuteOfDay(Number(timeHour) * 60 + Number(timeMinute), true)} in{" "}
                {formatOffset(draft.birthOffset)}. This moment never moves.
              </FieldDescription>
            ) : (
              <FieldDescription>Enter a valid date and time.</FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="tz">Display time zone</FieldLabel>
            <Select
              value={draft.tz}
              onValueChange={(v) => setDraft((d) => ({ ...d, tz: v }))}
            >
              <SelectTrigger id="tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field data-invalid={yearsInvalid || undefined}>
            <FieldLabel htmlFor="lifespan">Target lifespan (years)</FieldLabel>
            <Input
              id="lifespan"
              type="number"
              inputMode="numeric"
              min={MIN_LIFESPAN_YEARS}
              max={MAX_LIFESPAN_YEARS}
              value={draft.lifespanYears}
              onChange={(e) => setDraft((d) => ({ ...d, lifespanYears: e.target.value }))}
              aria-invalid={yearsInvalid || undefined}
            />
          </Field>

          <Field>
            <FieldLabel>Clock</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={draft.clock12h ? "12" : "24"}
              onValueChange={(v) => v && setDraft((d) => ({ ...d, clock12h: v === "12" }))}
            >
              <ToggleGroupItem value="24">24-hour</ToggleGroupItem>
              <ToggleGroupItem value="12">12-hour</ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!birthIso || yearsInvalid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** `YYYY-MM-DD` as a local Date, avoiding any UTC shift. */
function parseLocalDate(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Calendar bounds, hoisted so render stays pure. */
const FIRST_POSSIBLE_BIRTH = new Date(1900, 0, 1);
const LAST_POSSIBLE_BIRTH = new Date(new Date().getFullYear(), 11, 31);
/** Nobody is born tomorrow; blocks the nonsense "negative age" state. */
const TODAY = new Date();

/**
 * Formats the `YYYY-MM-DD` wall-clock part directly.
 *
 * Going through epoch milliseconds would shift the day whenever the retained
 * birth offset does not line up with UTC.
 */
function formatDateParts(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
