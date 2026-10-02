import { useState } from "react";
import { ArrowUpRight, MapPin, Clock, Save } from "lucide-react";
import { category, type Session } from "../data/academic";
import { db, saveAttendance, timestamp } from "../lib/db";
import { useApp } from "../lib/context";
import {
  at,
  dateFrom,
  formatDate,
  formatTime,
  lateness,
  localDate,
  localTime,
  recordId,
  sessionStatus,
} from "../lib/scheduling";
import type { Attendance } from "../lib/schema";
import { CourseTag, Modal, Status } from "./ui";
export function AttendanceDialog({
  session,
  date,
  onClose,
  initialMode = "auto",
}: {
  session: Session;
  date: string;
  onClose: () => void;
  initialMode?: "auto" | Attendance["status"];
}) {
  const { courseById } = useApp();
  const { settings, attendance, now, act, navigate } = useApp();
  const old = attendance.find((r) => r.id === recordId(session.id, date));
  const course = courseById(session.courseId);
  const [recordDate] = useState(date),
    [arrival, setArrival] = useState(
      old?.arrival ??
        (date === localDate(now) ? localTime(now) : session.start),
    ),
    [mode, setMode] = useState<"auto" | Attendance["status"]>(
      old?.override ? old.status : initialMode,
    ),
    [note, setNote] = useState(old?.note ?? ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const plannedStart =
      recordDate === date
        ? (old?.plannedStart ?? session.start)
        : session.start,
    plannedEnd =
      recordDate === date ? (old?.plannedEnd ?? session.end) : session.end;
  const computed = lateness(plannedStart, arrival, settings.graceMinutes);
  const result = mode === "auto" ? computed.status : mode;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dateFrom(recordDate).getDay() !== session.day) {
      setError("Choose the scheduled weekday for this session.");
      return;
    }
    if (
      recordDate > localDate(now) ||
      (result !== "excused" &&
        result !== "missed" &&
        at(recordDate, arrival) > now)
    ) {
      setError("Check-in time cannot be in the future.");
      return;
    }
    if (result === "late" && computed.lateMinutes === 0) {
      setError("A late arrival must be after the class start.");
      return;
    }
    setBusy(true);
    const ok = await act(
      saveAttendance({
        id: recordId(session.id, recordDate),
        sessionId: session.id,
        date: recordDate,
        status: result,
        arrival: ["excused", "missed"].includes(result) ? null : arrival,
        plannedStart,
        plannedEnd,
        lateMinutes: ["excused", "missed"].includes(result)
          ? 0
          : computed.lateMinutes,
        override: mode !== "auto",
        note,
        updatedAt: timestamp(),
      }),
      `Attendance saved · ${course.shortName}`,
    );
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={course.shortName}
      description={`${formatDate(date, { weekday: "long", month: "short", day: "numeric" })} · ${category(session.type)}`}
    >
      <div className="session-hud">
        <CourseTag id={course.id} />
        <Status
          status={sessionStatus(session, date, now, settings, old)}
          minutes={old?.lateMinutes}
        />
        <div className="hud-facts">
          <span>
            <Clock size={16} />
            {formatTime(plannedStart)} – {formatTime(plannedEnd)}
          </span>
          <span>
            <MapPin size={16} />
            {session.room || "Room not supplied"}
          </span>
        </div>
        {!session.timeConfirmed && (
          <p className="assumption">
            Time is an editable assumption. Confirm it in Settings.
          </p>
        )}
        <button
          className="text-link"
          onClick={() => {
            navigate(`courses/${course.id}`);
            onClose();
          }}
        >
          Open course workspace
          <ArrowUpRight size={15} />
        </button>
      </div>
      <form onSubmit={save} className="form-stack">
        <label>
          Date
          <input type="date" required value={recordDate} readOnly />
        </label>
        <div className="form-grid">
          <label>
            Actual arrival time
            <input
              type="time"
              required
              disabled={mode === "missed" || mode === "excused"}
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
          </label>
          <label>
            Attendance status
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="auto">From arrival time</option>
              <option value="attended">Attended (override)</option>
              <option value="on-time">On time (override)</option>
              <option value="late">Late (override)</option>
              <option value="missed">Missed</option>
              <option value="excused">Excused</option>
            </select>
          </label>
        </div>
        <div className="arrival-result">
          <Status status={result} minutes={computed.lateMinutes} />
          <span>
            {!["missed", "excused"].includes(result)
              ? `${computed.lateMinutes} minutes after configured start`
              : result === "excused"
                ? "Excluded from attendance percentage"
                : "Counts in attendance percentage"}
          </span>
        </div>
        <label>
          Session notes
          <textarea
            maxLength={5000}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you covered, or a reason for a correction…"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="fine-print">
          Check-ins are manual and stored on this device. Attendance records
          keep the scheduled times used when saved.
        </p>
        <div className="dialog-actions">
          {old && (
            <button
              type="button"
              className="button danger secondary"
              onClick={async () => {
                if (await act(db.attendance.delete(old.id), "Record cleared"))
                  onClose();
              }}
            >
              Clear record
            </button>
          )}
          <button className="button" disabled={busy}>
            <Save size={16} />
            {busy ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
