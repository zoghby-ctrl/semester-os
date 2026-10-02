import { useEffect, useRef, useState } from "react";
import {
  Download,
  ImagePlus,
  Monitor,
  Pause,
  Play,
  Save,
  Shield,
  Upload,
  X,
  Trash2,
} from "lucide-react";
import { days } from "../data/academic";
import { useApp } from "../lib/context";
import {
  db,
  exportBackup,
  importBackup,
  resetSemester,
  saveSettings,
  saveWallpaper,
  updateSettings,
  updatePrismSettings,
  validateBackup,
  restoreRecovery,
  deleteWorkspace,
} from "../lib/db";
import { settingsSchema, type Backup } from "../lib/schema";
import { dateSchema } from "../lib/schema";
import { localDate } from "../lib/scheduling";
import { Modal, SectionHead, Toggle } from "../components/ui";
import { AppearanceStudio } from "../components/themes/Appearance";
import { Slider } from "../components/Slider";
import { AboutLegal } from "./Legal";
import { MAX_BACKUP_BYTES, parseBackupJson, safeImportMessage, utf8Size } from "../lib/security";
import { useLiveQuery } from "dexie-react-hooks";
import { OfflineTools } from "../components/OfflineTools";

export function SettingsPage() {

  const { settings: s, wallpaper, act, toast, navigate, view } = useApp();
  const [tab, setTab] = useState(view.split("/")[1] ?? "appearance"),
    [pending, setPending] = useState<Backup | null>(null),
    [reset, setReset] = useState(false),
    [confirmText, setConfirm] = useState(""),
    [storage, setStorage] = useState<{
      used: number;
      quota: number;
      persisted: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const upload = useRef<HTMLInputElement>(null),
    importer = useRef<HTMLInputElement>(null);
  useEffect(() => {
    Promise.all([navigator.storage?.estimate(), navigator.storage?.persisted()])
      .then(([estimate, persisted]) =>
        setStorage({
          used: estimate?.usage ?? 0,
          quota: estimate?.quota ?? 0,
          persisted: !!persisted,
        }),
      )
      .catch(() => {});
  }, []);
  const backup = async () => {
    setBusy(true);
    try {
      const data = await exportBackup();
      const text = JSON.stringify(data);
      if (utf8Size(text, MAX_BACKUP_BYTES) > MAX_BACKUP_BYTES) throw new Error("This backup exceeds 100 MB. Remove an oversized wallpaper or old records before exporting.");
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `semester-os-${localDate(new Date(data.exportedAt))}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast("Backup downloaded, including your local wallpaper.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not export backup");
    } finally {
      setBusy(false);
    }
  };
  const prepareImport = async (file: File) => {
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Backup must be smaller than 100 MB");
      setPending(validateBackup(parseBackupJson(await file.text())));
    } catch (e) {
      toast(safeImportMessage(e));
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR SPACE / SETTINGS</div>
          <h1>
            Make it feel like you<span className="accent-punctuation">.</span>
          </h1>
          <p>Fine-tune your space, your schedule, and your data.</p>
        </div>
      </div>
      <div className="tabs settings-tabs">
        {[
          ["appearance", "Appearance"],
          ["schedule", "Timetable"],
          ["behavior", "Preferences"],
          ["data", "Data & backup"],
          ["legal", "About & legal"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            aria-pressed={tab === key}
            onClick={() => { setTab(key); navigate(`settings/${key}`); }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "appearance" && (
        <>
          <AppearanceStudio />
          {s.theme === "prism" && <PrismSettingsPanel />}
          <div className="settings-grid">
            <section className="panel">
              <SectionHead title="Your wallpaper" />
              <p className="subtle">
                Choose an image or a looping video from this device. Maximum 50
                MB.
              </p>
              <input
                ref={upload}
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg"
                aria-label="Choose wallpaper file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) act(saveWallpaper(f), "Wallpaper saved");
                  e.target.value = "";
                }}
              />
              <button
                className="button secondary"
                onClick={() => upload.current?.click()}
              >
                <ImagePlus size={17} />
                {wallpaper ? "Replace wallpaper" : "Choose a wallpaper"}
              </button>
              {wallpaper && (
                <>
                  <div className="wallpaper-file">
                    <Monitor size={17} />
                    <div>
                      <strong>{wallpaper.name}</strong>
                      <small>
                        {(wallpaper.blob.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                        {wallpaper.type.startsWith("video")
                          ? "Motion wallpaper"
                          : "Static wallpaper"}
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Remove wallpaper"
                      onClick={() =>
                        act(db.wallpaper.delete("main"), "Wallpaper removed")
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <Toggle
                    label="Show wallpaper"
                    checked={s.wallpaperEnabled}
                    onChange={(v) =>
                      act(updateSettings({ wallpaperEnabled: v }))
                    }
                  />
                  {wallpaper.type.startsWith("video") && (
                    <button
                      className="button small secondary"
                      onClick={() =>
                        act(
                          updateSettings({
                            wallpaperPaused: !s.wallpaperPaused,
                          }),
                        )
                      }
                    >
                      {s.wallpaperPaused ? (
                        <Play size={15} />
                      ) : (
                        <Pause size={15} />
                      )}{" "}
                      {s.wallpaperPaused ? "Play wallpaper" : "Pause wallpaper"}
                    </button>
                  )}
                </>
              )}
              <Slider
                label="Wallpaper blur"
                value={s.blur}
                max={30}
                unit="px"
                onChange={(v) => act(updateSettings({ blur: v }))}
              />
              <Slider
                label="Wallpaper dimming"
                value={s.dim}
                min={45}
                max={95}
                unit="%"
                onChange={(v) => act(updateSettings({ dim: v }))}
              />
              <p className="fine-print">
                Panels keep an opaque reading surface in every theme. Wallpaper
                files stay local and are included in backups.
              </p>
            </section>
            <section className="panel">
              <SectionHead title="Motion & texture" />
              <Toggle
                label="Reduce motion"
                description="Turn off ambient animation, transitions, and video playback."
                checked={s.reduceMotion}
                onChange={(v) => act(updateSettings({ reduceMotion: v }))}
              />
              {s.theme !== "prism" && (
                <Slider
                  label="Motion intensity"
                  value={s.motion}
                  max={100}
                  unit="%"
                  onChange={(v) => act(updateSettings({ motion: v }))}
                />
              )}
              <Slider
                label="Grain"
                value={s.grain}
                max={100}
                unit="%"
                onChange={(v) => act(updateSettings({ grain: v }))}
              />
              <Toggle
                label="Pause ambient motion"
                description="Pause animated backgrounds and wallpaper video."
                checked={s.wallpaperPaused}
                onChange={(v) => act(updateSettings({ wallpaperPaused: v }))}
              />
              <p className="fine-print">
                Your device’s Reduce Motion preference is always respected.
                Focus uses a quiet breathing light. Videos pause
                when the app is in the background.
              </p>
            </section>
          </div>
        </>
      )}
      {tab === "schedule" && <TimetableSettings />}
      {tab === "behavior" && <Preferences />}
      {tab === "legal" && <AboutLegal />}
      {tab === "data" && (
        <div className="settings-grid">
          <section className="panel">
            <SectionHead title="Your semester, safely saved" />
            <p className="subtle">
              Attendance, topic progress, notes, plans, settings, study history,
              and wallpaper are saved in this browser’s local database. Keep a
              backup you can restore on another device.
            </p>
            <div className="backup-actions">
              <button className="button" disabled={busy} onClick={backup}>
                <Download size={17} />
                {busy ? "Preparing…" : "Export backup"}
              </button>
              <button
                className="button secondary"
                onClick={() => importer.current?.click()}
              >
                <Upload size={17} />
                Import backup
              </button>
            </div>
            <input
              ref={importer}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              aria-label="Select backup"
              onChange={(e) => {
                if (e.target.files?.[0]) prepareImport(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <div className="storage-info">
              <Shield size={20} />
              <div>
                <strong>
                  {storage?.persisted
                    ? "Persistent storage enabled"
                    : "Local storage"}
                </strong>
                <span>
                  {storage
                    ? `${(storage.used / 1024 / 1024).toFixed(1)} MB used on this site`
                    : "Storage estimate is unavailable"}
                </span>
              </div>
            </div>
            <button
              className="button secondary small"
              onClick={async () => {
                const persisted = await navigator.storage
                  ?.persist?.()
                  .catch(() => false);
                setStorage((x) =>
                  x ? { ...x, persisted: !!persisted } : null,
                );
                toast(
                  persisted
                    ? "Browser granted persistent storage."
                    : "This browser did not grant persistent storage. Keep regular backups.",
                );
              }}
            >
              Request persistent storage
            </button>
            <p className="fine-print">
              Browser storage can be cleared. Backups include wallpaper, but an
              active study timer is not exported. Import replaces current data
              in one transaction.
            </p>
          </section>
          <section className="panel">
            <SectionHead title="Install your personal space" />
            <p className="subtle">
              Semester OS includes an offline shell and an app manifest. After
              the first visit to a production build, the interface works
              offline.
            </p>
            <ul className="installation-help">
              <li>
                Chrome / Edge: use the Install button in the sidebar when
                offered, or the browser’s install menu.
              </li>
              <li>
                iPhone / iPad: open in Safari, then Share → Add to Home Screen.
              </li>
              <li>
                Use HTTPS or localhost for installation and offline support.
              </li>
            </ul>
            <p className="fine-print">
              Browser installation support varies. The development preview does
              not cache an offline shell.
            </p>
            <OfflineTools />
          </section>
          <section className="panel danger-panel">
            <SectionHead title="Start fresh" />
            <p className="subtle">
              Clear attendance, notes, topics, plans, saved study sessions, and
              the active timer. Your theme, wallpaper, timetable, and
              preferences are kept.
            </p>
            <button
              className="button danger secondary"
              onClick={() => {
                setConfirm("");
                setReset(true);
              }}
            >
              <Trash2 size={16} />
              Reset semester records
            </button>
          </section>
          <RecoveryPoints />
          <DeleteLocalWorkspace />
        </div>
      )}
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Restore this backup?"
        description="This replaces the semester data and settings currently saved on this device."
      >
        {pending && (
          <div className="backup-summary">
            <p>Backup from {new Date(pending.exportedAt).toLocaleString()}</p>
            <p>
              {pending.attendance.length} attendance records ·{" "}
              {pending.notes.length} notes · {pending.items.length} plans ·{" "}
              {pending.topics.length} topics
            </p>
          </div>
        )}
        <div className="dialog-actions">
          <button className="button secondary" onClick={() => setPending(null)}>
            Cancel
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              if (!pending) return;
              setBusy(true);
              const ok = await act(importBackup(pending), "Backup restored");
              setBusy(false);
              if (ok) {
                setPending(null);
                navigate("today");
              }
            }}
          >
            Restore backup
          </button>
        </div>
      </Modal>
      <Modal
        open={reset}
        onClose={() => setReset(false)}
        title="Reset semester records?"
        description="This clears your local academic records. Export a backup first if you want to keep them."
      >
        <label className="form-stack">
          Type RESET to confirm
          <input
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button className="button secondary" onClick={() => setReset(false)}>
            Cancel
          </button>
          <button
            className="button danger"
            disabled={confirmText !== "RESET" || busy}
            onClick={async () => {
              setBusy(true);
              if (await act(resetSemester(), "Semester records cleared"))
                setReset(false);
              setBusy(false);
            }}
          >
            Reset records
          </button>
        </div>
      </Modal>
    </>
  );
}
function PrismSettingsPanel() {
  const { settings: s, act } = useApp();
  const p = s.prism;
  return (
    <section className="panel prism-settings-panel">
      <div className="prism-settings-heading">
        <div>
          <div className="eyebrow">PRISM / DEEP SPACE</div>
          <h2>Your window into the quiet.</h2>
          <p className="subtle">
            Layered stars, a slow meteor shower, and room to think.
          </p>
        </div>
        <span className="prism-scene-badge">
          <i /> PRISM OBSERVATORY
        </span>
      </div>
      <div className="prism-controls-grid">
        <div className="prism-control-group">
          <h3>Starlight</h3>
          <Toggle
            label="Starfield"
            description="Layered stars with real depth."
            checked={p.starfield}
            onChange={(v) => act(updatePrismSettings({ starfield: v }))}
          />
          <Slider
            label="Star density"
            value={p.density}
            max={100}
            unit="%"
            disabled={!p.starfield}
            onChange={(v) => act(updatePrismSettings({ density: v }))}
          />
          <Slider
            label="Star brightness"
            value={p.brightness}
            max={100}
            unit="%"
            onChange={(v) => act(updatePrismSettings({ brightness: v }))}
          />
          <Slider
            label="Twinkle intensity"
            value={p.twinkle}
            max={100}
            unit="%"
            disabled={!p.starfield}
            onChange={(v) => act(updatePrismSettings({ twinkle: v }))}
          />
          <label className="prism-choice">
            <span>Star Drift</span>
            <select
              aria-label="Star Drift"
              value={p.drift}
              disabled={!p.starfield}
              onChange={(event) =>
                act(
                  updatePrismSettings({
                    drift: event.target.value as typeof p.drift,
                  }),
                )
              }
            >
              <option value="off">Off</option>
              <option value="subtle">Subtle</option>
              <option value="normal">Normal</option>
            </select>
          </label>
        </div>
        <div className="prism-control-group">
          <h3>Passing light</h3>
          <label className="prism-choice">
            <span>Meteor Shower</span>
            <select
              aria-label="Meteor Shower"
              value={p.meteorShower}
              onChange={(event) =>
                act(
                  updatePrismSettings({
                    meteorShower: event.target.value as typeof p.meteorShower,
                  }),
                )
              }
            >
              <option value="off">Off</option>
              <option value="sparse">Sparse</option>
              <option value="shower">Shower</option>
              <option value="storm">Storm</option>
            </select>
          </label>
          <label className="prism-choice">
            <span>Meteor Speed</span>
            <select
              aria-label="Meteor Speed"
              value={p.meteorSpeed}
              disabled={p.meteorShower === "off"}
              onChange={(event) =>
                act(
                  updatePrismSettings({
                    meteorSpeed: event.target.value as typeof p.meteorSpeed,
                  }),
                )
              }
            >
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <p className="fine-print">
            Sparse keeps a few passing trails. Shower brings a steady flow.
            Storm fills more of the sky. Every trail continues beyond the
            screen.
          </p>
          <Slider
            label="Parallax intensity"
            value={p.parallax}
            max={100}
            unit="%"
            onChange={(v) => act(updatePrismSettings({ parallax: v }))}
          />
          <p className="fine-print">
            A gentle response to your cursor on desktop, and quiet sway on
            mobile.
          </p>
        </div>
        <div className="prism-control-group">
          <h3>Atmosphere</h3>
          <Slider
            label="Motion intensity"
            value={s.motion}
            max={100}
            unit="%"
            onChange={(v) => act(updateSettings({ motion: v }))}
          />
          <Slider
            label="Background dimming"
            value={p.dim}
            max={90}
            unit="%"
            onChange={(v) => act(updatePrismSettings({ dim: v }))}
          />
          <Slider
            label="Background blur"
            value={p.blur}
            max={8}
            unit="px"
            onChange={(v) => act(updatePrismSettings({ blur: v }))}
          />
          <p className="fine-print">
            Cards keep a protected reading surface at every setting. Wallpaper
            controls remain separate.
          </p>
        </div>
      </div>
      <div className="prism-motion-note">
        Reduce Motion keeps the stars still and turns off trails, parallax, and
        light sweeps. The scene rests when this page is in the background.
      </div>
    </section>
  );
}
function TimetableSettings() {
  const { courseById, sourceSessions } = useApp();
  const { settings, act } = useApp();
  const [draft, setDraft] = useState(sourceSessions.map(({id,start,end,timeConfirmed}) => ({id,start,end,timeConfirmed}))),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const parsed = settingsSchema.safeParse({ ...settings, schedule: draft });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    await act(saveSettings(parsed.data), "Timetable saved");
    setBusy(false);
  };
  return (
    <form className="panel form-stack" onSubmit={save}>
      <SectionHead title="Confirm your exact class times" />
      <p className="subtle">
        The visual timetable establishes order, rooms, and session types. The
        minute-level values below are assumptions until you confirm them. Session times remain editable. Existing attendance keeps its historical planned times.
      </p>
      {Array.from({length:7}, (_,i)=>i).map((day) => (
        <div className="schedule-edit-day" key={day}>
          <h3>{days[day]}</h3>
          {draft
            .filter(
              (s) => sourceSessions.find((x) => x.id === s.id)?.day === day,
            )
            .map((s) => {
              const original = sourceSessions.find((x) => x.id === s.id)!;
              return (
                <div className="schedule-edit-row" key={s.id}>
                  <div>
                    <strong>{courseById(original.courseId).shortName}</strong>
                    <small>
                      {courseById(original.courseId).code} · {original.type} · {original.room || "Room not supplied"}
                    </small>
                  </div>
                  <label>
                    Start
                    <input
                      type="time"
                      required
                      value={s.start}
                      onChange={(e) =>
                        setDraft((x) =>
                          x.map((v) =>
                            v.id === s.id
                              ? {
                                  ...v,
                                  start: e.target.value,
                                  timeConfirmed: false,
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="time"
                      required
                      value={s.end}
                      onChange={(e) =>
                        setDraft((x) =>
                          x.map((v) =>
                            v.id === s.id
                              ? {
                                  ...v,
                                  end: e.target.value,
                                  timeConfirmed: false,
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="confirmed-check">
                    <input
                      type="checkbox"
                      checked={s.timeConfirmed}
                      onChange={(e) =>
                        setDraft((x) =>
                          x.map((v) =>
                            v.id === s.id
                              ? { ...v, timeConfirmed: e.target.checked }
                              : v,
                          ),
                        )
                      }
                    />
                    Confirmed
                  </label>
                </div>
              );
            })}
        </div>
      ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => setDraft(sourceSessions.map(({id,start,end,timeConfirmed}) => ({id,start,end,timeConfirmed})))}
        >
          Discard edits
        </button>
        <button className="button" disabled={busy}>
          <Save size={16} />
          Save timetable
        </button>
      </div>
      <p className="fine-print">
        Existing attendance records retain their original planned time. New
        check-ins use the updated timetable.
      </p>
    </form>
  );
}
function Preferences() {
  const { settings: s, act } = useApp();
  const [name, setName] = useState(s.name),
    [grace, setGrace] = useState(s.graceMinutes),
    [auto, setAuto] = useState(s.autoMissed),
    [since, setSince] = useState(s.trackingSince ?? ""),
    [start, setStart] = useState(s.semesterStart ?? ""),
    [end, setEnd] = useState(s.semesterEnd ?? ""),
    [excluded, setExcluded] = useState(s.excludedDates),
    [date, setDate] = useState(""),
    [error, setError] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = settingsSchema.safeParse({
      ...s,
      name: name.trim(),
      graceMinutes: grace,
      autoMissed: auto,
      trackingSince: since || null,
      semesterStart: start || null,
      semesterEnd: end || null,
      excludedDates: excluded,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (since && since < "2000-01-01") {
      setError("Choose a tracking date after 1999.");
      return;
    }
    setError("");
    await act(saveSettings(parsed.data), "Preferences saved");
  };
  return (
    <form className="panel form-stack" onSubmit={save}>
      <SectionHead title="Your semester preferences" />
      <label>
        Your name
        <input
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Semester start (optional)
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Semester end (optional)
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <p className="fine-print">
        No official semester dates were supplied. Without dates, the schedule
        repeats weekly. Adding dates limits Today, Schedule, and Calendar to the
        semester.
      </p>
      <label>
        Lateness grace period (minutes)
        <input
          type="number"
          min={0}
          max={60}
          required
          value={grace}
          onChange={(e) => setGrace(Number(e.target.value))}
        />
      </label>
      <p className="fine-print">
        Arrival after the grace period is labelled Late. The actual number of
        minutes after class start is always retained.
      </p>
      <Toggle
        label="Classify unrecorded past sessions as missed"
        description="Applies only after your tracking start. You can correct any session later."
        checked={auto}
        onChange={setAuto}
      />
      <label>
        Attendance tracking start
        <input
          type="date"
          required={auto}
          min="2000-01-01"
          value={since}
          onChange={(e) => setSince(e.target.value)}
        />
      </label>
      <div className="excluded-editor">
        <strong>Excluded dates</strong>
        <p className="fine-print">
          Add holidays or cancelled campus days yourself.
        </p>
        <div className="inline-form">
          <input
            type="date"
            aria-label="Date to exclude"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              if (dateSchema.safeParse(date).success) {
                setExcluded((x) => Array.from(new Set([...x, date])).sort());
                setDate("");
              }
            }}
          >
            Add date
          </button>
        </div>
        <div className="date-chips">
          {excluded.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setExcluded((x) => x.filter((v) => v !== d))}
              aria-label={`Remove excluded date ${d}`}
            >
              {d}
              <X size={13} />
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="button">
          <Save size={16} />
          Save preferences
        </button>
      </div>
    </form>
  );
}

function RecoveryPoints() {
  const { act, navigate } = useApp();
  const points = useLiveQuery(async () => {
    const metadata: { id: number; kind: string; createdAt: string; records: number }[] = [];
    await db.recovery.orderBy("createdAt").reverse().limit(100).each(entry => {
      if (entry.snapshot && typeof entry.id === "number") metadata.push({ id: entry.id, kind: String(entry.kind).slice(0, 100), createdAt: entry.createdAt, records: Array.isArray(entry.snapshot.attendance) ? entry.snapshot.attendance.length : 0 });
    });
    return metadata;
  }, []);
  const [selected, setSelected] = useState<number | null>(null), [busy, setBusy] = useState(false);
  return <section className="panel recovery-panel"><SectionHead title="Local recovery points" /><p className="subtle">Before semester replacement, backup restoration, or a records reset, Semester OS keeps the previous workspace here, including its timer and wallpaper. These copies stay on this device. Delete a point when you no longer need its information.</p>
    {!points?.length && <p className="fine-print">No complete recovery points yet. Keep an exported backup for independent protection.</p>}
    {points?.map(p => <div className="recovery-point" key={p.id}><div><strong>{p.kind}</strong><small>{new Date(p.createdAt).toLocaleString()} · {p.records} attendance records</small></div><button className="button small secondary" onClick={() => setSelected(p.id)}>Restore</button><button className="icon-button" aria-label={`Delete recovery point ${p.id}`} onClick={() => act(db.recovery.delete(p.id), "Recovery point deleted")}><Trash2 size={16} /></button></div>)}
    <Modal open={selected !== null} onClose={() => setSelected(null)} title="Restore this recovery point?" description="This replaces the current workspace with the selected local snapshot. Your current workspace will become a new recovery point."><div className="dialog-actions"><button className="button secondary" onClick={() => setSelected(null)}>Cancel</button><button className="button" disabled={busy} onClick={async () => { if (selected === null) return; setBusy(true); if (await act(restoreRecovery(selected), "Workspace recovered")) { setSelected(null); navigate("today"); } setBusy(false); }}>Restore workspace</button></div></Modal>
  </section>;
}
function DeleteLocalWorkspace() {
  const { act, navigate } = useApp();
  const [open, setOpen] = useState(false), [confirmation, setConfirmation] = useState(""), [busy, setBusy] = useState(false);
  return <section className="panel danger-panel"><SectionHead title="Delete this local workspace" /><p className="subtle">Remove your semester, profile, preferences, records, wallpaper, timer, and all local recovery points from this browser. Backup files saved elsewhere remain under your control. Use your browser's site-data controls to clear offline caches as well.</p><button className="button secondary danger" onClick={() => { setConfirmation(""); setOpen(true); }}><Trash2 size={16} /> Delete local workspace</button><Modal open={open} onClose={() => setOpen(false)} title="Delete your local workspace?" description="This deletion also removes recovery points. Export a backup first if you want to keep any of this information."><label className="form-stack">Type DELETE to confirm<input autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><div className="dialog-actions"><button className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button danger" disabled={busy || confirmation !== "DELETE"} onClick={async () => { setBusy(true); if (await act(deleteWorkspace(), "Local workspace deleted")) { setOpen(false); navigate("setup"); } setBusy(false); }}>Delete workspace</button></div></Modal></section>;
}
