import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_TYPES,
  loadActivities,
  loadSettings,
  newId,
  saveActivities,
  saveSettings,
  type Activity,
  type ActivityMap,
  type Settings,
} from "./lib/storage";
import {
  blockRangeLabel,
  blockYearLabel,
  fillFraction,
  fmtDate,
  fmtDateTime,
  fmtDayNum,
  fmtWeekday,
  fromDateTimeLocal,
  getSixMonthBlocks,
  getTargetEndMs,
  getWeekCalendarDays,
  getWeekInterval,
  getWeeksForBlock,
  parseDayKey,
  endOfDayMs,
  statusOf,
  toDateTimeLocal,
  tzLabelAt,
  type SixMonthBlock,
} from "./lib/time";

type Route =
  | { name: "life" }
  | { name: "block"; blockIndex: number }
  | { name: "week"; weekIndex: number; fromBlock: number }
  | { name: "day"; key: string; weekIndex: number; fromBlock: number };

function useNow(stepMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [activities, setActivities] = useState(() => loadActivities());
  const [route, setRoute] = useState<Route>({ name: "life" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const now = useNow();

  const targetMs = useMemo(
    () => getTargetEndMs(settings.birthMs, settings.lifespanYears),
    [settings.birthMs, settings.lifespanYears]
  );

  const blocks = useMemo(
    () => getSixMonthBlocks(settings.birthMs, targetMs),
    [settings.birthMs, targetMs]
  );

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveActivities(activities), [activities]);

  // Clamp route when lifespan changes
  useEffect(() => {
    if (route.name === "block" && (route.blockIndex < 0 || route.blockIndex >= blocks.length)) {
      setRoute({ name: "life" });
    }
  }, [blocks.length, route]);

  const totalMs = Math.max(1, targetMs - settings.birthMs);
  const progress = Math.min(1, Math.max(0, (now - settings.birthMs) / totalMs));

  const doneBlocks = blocks.filter((b) => b.endMs <= now).length;

  function updateSettings(birthMs: number, lifespanYears: number) {
    setSettings({
      birthMs,
      birthTzOffsetMin: -new Date(birthMs).getTimezoneOffset(),
      lifespanYears,
    });
    setRoute({ name: "life" });
  }

  function upsertActivity(key: string, a: Activity) {
    setActivities((prev) => {
      const list = [...(prev[key] ?? [])];
      const i = list.findIndex((x) => x.id === a.id);
      if (i >= 0) list[i] = a;
      else list.push(a);
      return { ...prev, [key]: list };
    });
  }

  function deleteActivity(key: string, id: string) {
    setActivities((prev) => {
      const list = (prev[key] ?? []).filter((x) => x.id !== id);
      const next = { ...prev };
      if (list.length === 0) delete next[key];
      else next[key] = list;
      return next;
    });
  }

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1 className="brand">One Less</h1>
          <p className="sub">
            {fmtDateTime(settings.birthMs)} <span className="muted">({tzLabelAt(settings.birthMs)} at birth)</span>
            {" → "}
            {fmtDateTime(targetMs)}
          </p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-expanded={settingsOpen}
        >
          {settingsOpen ? "Close" : "Settings"}
        </button>
      </header>

      {settingsOpen && (
        <SettingsCard
          settings={settings}
          onSave={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <section className="progress-card card">
        <div className="progress-top">
          <span className="progress-pct">{(progress * 100).toFixed(4)}%</span>
          <span className="muted small">
            {doneBlocks} / {blocks.length} blocks
          </span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={Number((progress * 100).toFixed(2))} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="muted small">
          {settings.lifespanYears} year target · each square = 6 months · {blocks.length} squares total
        </p>
      </section>

      <main key={routeKey(route)} className="view">
        {route.name === "life" && (
          <LifeView
            blocks={blocks}
            now={now}
            onOpen={(i) => setRoute({ name: "block", blockIndex: i })}
          />
        )}
        {route.name === "block" && blocks[route.blockIndex] && (
          <BlockView
            block={blocks[route.blockIndex]}
            birthMs={settings.birthMs}
            now={now}
            onBack={() => setRoute({ name: "life" })}
            onOpenWeek={(w) => setRoute({ name: "week", weekIndex: w, fromBlock: route.blockIndex })}
          />
        )}
        {route.name === "week" && (
          <WeekView
            birthMs={settings.birthMs}
            weekIndex={route.weekIndex}
            fromBlock={route.fromBlock}
            blocks={blocks}
            now={now}
            activities={activities}
            onBack={() => setRoute({ name: "block", blockIndex: route.fromBlock })}
            onOpenDay={(key) =>
              setRoute({ name: "day", key, weekIndex: route.weekIndex, fromBlock: route.fromBlock })
            }
          />
        )}
        {route.name === "day" && (
          <DayView
            dayKeyStr={route.key}
            weekIndex={route.weekIndex}
            fromBlock={route.fromBlock}
            blocks={blocks}
            now={now}
            activities={activities[route.key] ?? []}
            onBack={() =>
              setRoute({ name: "week", weekIndex: route.weekIndex, fromBlock: route.fromBlock })
            }
            onUpsert={(a) => upsertActivity(route.key, a)}
            onDelete={(id) => deleteActivity(route.key, id)}
          />
        )}
      </main>

      <footer className="footer muted small">
        Lifetime math uses absolute timestamps. Days shown in your local time zone.
      </footer>
    </div>
  );
}

function routeKey(r: Route): string {
  switch (r.name) {
    case "life": return "life";
    case "block": return `block-${r.blockIndex}`;
    case "week": return `week-${r.weekIndex}`;
    case "day": return `day-${r.key}`;
  }
}

/* ---------------- Settings ---------------- */

function SettingsCard({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings;
  onSave: (birthMs: number, lifespanYears: number) => void;
  onClose: () => void;
}) {
  const [birthLocal, setBirthLocal] = useState(() => toDateTimeLocal(settings.birthMs));
  const [years, setYears] = useState(() => String(settings.lifespanYears));
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const ms = fromDateTimeLocal(birthLocal);
    const y = Math.floor(Number(years));
    if (ms === null) { setError("Enter a valid birth date and time."); return; }
    if (!Number.isFinite(y) || y < 1 || y > 150) { setError("Lifespan must be 1–150 years."); return; }
    setError(null);
    onSave(ms, y);
    onClose();
  }

  const previewTarget = (() => {
    const ms = fromDateTimeLocal(birthLocal);
    const y = Math.floor(Number(years));
    if (ms === null || !Number.isFinite(y)) return null;
    return getTargetEndMs(ms, Math.min(150, Math.max(1, y)));
  })();

  return (
    <section className="card settings">
      <div className="field-row">
        <label className="field">
          <span>Birth date &amp; time</span>
          <input
            type="datetime-local"
            value={birthLocal}
            onChange={(e) => setBirthLocal(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Target lifespan (years)</span>
          <input
            type="number"
            min={1}
            max={150}
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
        </label>
      </div>
      {previewTarget !== null && (
        <p className="muted small">Target end: {fmtDateTime(previewTarget)} (birth + {years} calendar years)</p>
      )}
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" onClick={handleSave}>Save</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </section>
  );
}

/* ---------------- Life view ---------------- */

function LifeView({
  blocks,
  now,
  onOpen,
}: {
  blocks: SixMonthBlock[];
  now: number;
  onOpen: (i: number) => void;
}) {
  return (
    <section aria-label="Lifetime view">
      <Crumb trail={["Life"]} />
      <h2 className="view-title">Life <span className="muted">· {blocks.length} × 6 months</span></h2>
      <div className="grid life-grid">
        {blocks.map((b) => {
          const st = statusOf(b.startMs, b.endMs, now);
          const fill = fillFraction(b.startMs, b.endMs, now);
          return (
            <button
              key={b.index}
              className={`cell cell-life is-${st}`}
              style={st === "present" ? { ["--fill" as string]: `${fill * 100}%` } : undefined}
              onClick={() => onOpen(b.index)}
              title={`${blockRangeLabel(b)}${st === "present" ? ` · ${(fill * 100).toFixed(1)}% through` : ""}`}
              aria-label={`6 months ${b.index + 1}: ${blockRangeLabel(b)}, ${st}`}
            >
              <span className="cell-fill" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <Legend />
    </section>
  );
}

/* ---------------- 6-month (block) view ---------------- */

function BlockView({
  block,
  birthMs,
  now,
  onBack,
  onOpenWeek,
}: {
  block: SixMonthBlock;
  birthMs: number;
  now: number;
  onBack: () => void;
  onOpenWeek: (weekIndex: number) => void;
}) {
  const weeks = useMemo(() => getWeeksForBlock(birthMs, block), [birthMs, block]);
  return (
    <section aria-label="Six month view">
      <Crumb trail={["Life", `${blockYearLabel(block)} · Block ${block.index + 1}`]} onBack={onBack} />
      <h2 className="view-title">6 months <span className="muted">· {blockRangeLabel(block)}</span></h2>
      <p className="muted small">
        {weeks.length} continuous weeks overlap this block. Weeks run 7 days from {fmtDateTime(birthMs)} and don’t reset here.
      </p>
      <div className="grid week-grid">
        {weeks.map((w) => {
          const st = statusOf(w.startMs, w.endMs, now);
          const fill = fillFraction(w.startMs, w.endMs, now);
          return (
            <button
              key={w.index}
              className={`cell cell-week is-${st}`}
              style={st === "present" ? { ["--fill" as string]: `${fill * 100}%` } : undefined}
              onClick={() => onOpenWeek(w.index)}
              title={`Week ${w.index + 1}: ${fmtDateTime(w.startMs)} → ${fmtDateTime(w.endMs)}`}
              aria-label={`Week ${w.index + 1}, ${st}`}
            >
              <span className="cell-fill" aria-hidden="true" />
              <span className="cell-label">W{w.index + 1}</span>
            </button>
          );
        })}
      </div>
      <Legend />
    </section>
  );
}

/* ---------------- Week view (7 calendar days) ---------------- */

function WeekView({
  birthMs,
  weekIndex,
  fromBlock,
  blocks,
  now,
  activities,
  onBack,
  onOpenDay,
}: {
  birthMs: number;
  weekIndex: number;
  fromBlock: number;
  blocks: SixMonthBlock[];
  now: number;
  activities: ActivityMap;
  onBack: () => void;
  onOpenDay: (key: string) => void;
}) {
  const week = getWeekInterval(birthMs, weekIndex);
  const days = useMemo(() => getWeekCalendarDays(week.startMs), [week.startMs]);
  const block = blocks[fromBlock];
  const crumbMid = block ? `${blockYearLabel(block)} · Block ${block.index + 1}` : `Block ${fromBlock + 1}`;

  return (
    <section aria-label="Week view">
      <Crumb trail={["Life", crumbMid, `Week ${weekIndex + 1}`]} onBack={onBack} />
      <h2 className="view-title">Week {weekIndex + 1} <span className="muted">· {fmtDateTime(week.startMs)} → {fmtDateTime(week.endMs)}</span></h2>
      <p className="muted small">Days use calendar boundaries (00:00 → 23:59) so tracking feels natural.</p>
      <div className="grid day-grid">
        {days.map((d) => {
          const st = statusOf(d.startMs, d.endMs, now);
          const count = activities[d.key]?.length ?? 0;
          const isToday = st === "present";
          return (
            <button
              key={d.key}
              className={`cell cell-day is-${st}`}
              onClick={() => onOpenDay(d.key)}
              title={`${fmtDate(d.startMs)}${count ? ` · ${count} activit${count === 1 ? "y" : "ies"}` : ""}`}
              aria-label={`${fmtDate(d.startMs)}, ${isToday ? "today" : st}${count ? `, ${count} activities` : ""}`}
            >
              <span className="day-name">{fmtWeekday(d.startMs)}</span>
              <span className="day-num">{fmtDayNum(d.startMs)}</span>
              {count > 0 && <span className="dot" aria-hidden="true">{count}</span>}
            </button>
          );
        })}
      </div>
      <Legend today />
    </section>
  );
}

/* ---------------- Day view ---------------- */

function DayView({
  dayKeyStr,
  weekIndex,
  fromBlock,
  blocks,
  now,
  activities,
  onBack,
  onUpsert,
  onDelete,
}: {
  dayKeyStr: string;
  weekIndex: number;
  fromBlock: number;
  blocks: SixMonthBlock[];
  now: number;
  activities: Activity[];
  onBack: () => void;
  onUpsert: (a: Activity) => void;
  onDelete: (id: string) => void;
}) {
  const dayStart = parseDayKey(dayKeyStr);
  const dayEnd = endOfDayMs(dayStart);
  const st = statusOf(dayStart, dayEnd, now);
  const block = blocks[fromBlock];
  const crumbMid = block ? `${blockYearLabel(block)} · Block ${block.index + 1}` : `Block ${fromBlock + 1}`;
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...activities].sort((a, b) => {
      if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : a.createdAt - b.createdAt;
      if (a.time) return -1;
      if (b.time) return 1;
      return a.createdAt - b.createdAt;
    });
  }, [activities]);

  return (
    <section aria-label="Day view">
      <Crumb trail={["Life", crumbMid, `Week ${weekIndex + 1}`, fmtDate(dayStart)]} onBack={onBack} />
      <h2 className="view-title">
        {fmtWeekday(dayStart)}, {fmtDate(dayStart)}{" "}
        <span className="muted">· {st === "present" ? "today" : st}</span>
      </h2>
      <p className="muted small">
        {fmtDateTime(dayStart)} → {fmtDateTime(dayEnd)} · day key <code>{dayKeyStr}</code>
      </p>

      <ActivityForm
        key={editingId ?? "new"}
        initial={editingId ? (activities.find((a) => a.id === editingId) ?? null) : null}
        onCancel={() => setEditingId(null)}
        onSave={(a) => { onUpsert(a); setEditingId(null); }}
      />

      <div className="activity-list">
        {sorted.length === 0 && <p className="muted">Nothing recorded yet. Log what you did — one less day, spent well.</p>}
        {sorted.map((a) => (
          <article key={a.id} className="card activity">
            <div className="activity-head">
              <strong>{a.title}</strong>
              <span className="badge">{ACTIVITY_TYPES.find((t) => t.value === a.type)?.label ?? a.type}</span>
            </div>
            <div className="muted small">
              {[a.time ? `at ${a.time}` : null, a.durationMin ? `${a.durationMin} min` : null].filter(Boolean).join(" · ") || "no time set"}
            </div>
            {a.notes && <p className="notes">{a.notes}</p>}
            <div className="row">
              <button className="btn btn-ghost" onClick={() => setEditingId(a.id)}>Edit</button>
              <button className="btn btn-ghost danger" onClick={() => onDelete(a.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Activity | null;
  onSave: (a: Activity) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [duration, setDuration] = useState(initial?.durationMin ? String(initial.durationMin) : "");
  const [type, setType] = useState<Activity["type"]>(initial?.type ?? "other");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) { setError("Give the activity a name."); return; }
    const dur = duration.trim() === "" ? undefined : Math.floor(Number(duration));
    if (duration.trim() !== "" && (!Number.isFinite(dur) || (dur as number) < 0)) {
      setError("Duration must be a positive number of minutes."); return;
    }
    setError(null);
    onSave({
      id: initial?.id ?? newId(),
      title: title.trim(),
      time: time || undefined,
      durationMin: dur,
      type,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    });
    if (!initial) { setTitle(""); setTime(""); setDuration(""); setNotes(""); setType("other"); }
  }

  return (
    <div className="card form">
      <h3>{initial ? "Edit activity" : "Add activity"}</h3>
      <label className="field">
        <span>Activity</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning run" maxLength={120} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Time (optional)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="field">
          <span>Duration min (optional)</span>
          <input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as Activity["type"])}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Notes (optional)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="How did it go?" maxLength={2000} />
      </label>
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" onClick={handleSave}>{initial ? "Save changes" : "Add"}</button>
        {initial && <button className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

/* ---------------- bits ---------------- */

function Crumb({ trail, onBack }: { trail: string[]; onBack?: () => void }) {
  return (
    <nav className="crumb muted small" aria-label="Breadcrumb">
      {onBack ? (
        <button className="btn btn-ghost back" onClick={onBack} aria-label="Go back">←</button>
      ) : (
        <span className="back back-disabled" aria-hidden="true">←</span>
      )}
      {trail.map((t, i) => (
        <span key={i}>
          {i > 0 && <span className="sep"> / </span>}
          <span className={i === trail.length - 1 ? "crumb-current" : undefined}>{t}</span>
        </span>
      ))}
    </nav>
  );
}

function Legend({ today = false }: { today?: boolean }) {
  return (
    <div className="legend muted small" aria-hidden="true">
      <span><i className="sw sw-past" /> past</span>
      <span><i className="sw sw-present" /> {today ? "today" : "now"}</span>
      <span><i className="sw sw-future" /> remaining</span>
    </div>
  );
}
