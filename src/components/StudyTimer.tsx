import { useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Check,
  Timer as TimerIcon,
} from "lucide-react";

import { db, saveTimer, timestamp, uid } from "../lib/db";
import { useApp } from "../lib/context";
import { localDate } from "../lib/scheduling";
import { studySchema } from "../lib/schema";
import { Modal } from "./ui";
export function StudyTimer() {
  const { courses } = useApp();
  const { timer, now, act, toast, settings } = useApp();
  const [courseId, setCourse] = useState(courses[0]?.id ?? ""),
    [confirm, setConfirm] = useState(false);
  const elapsed = timer
    ? Math.min(
        86400,
        Math.floor(
          timer.accumulated +
            (timer.startedAt
              ? Math.max(0, (+now - timer.startedAt) / 1000)
              : 0),
        ),
      )
    : 0;
  const label = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const start = () =>
    act(
      saveTimer({
        id: "active",
        courseId: timer?.courseId ?? courseId,
        startedAt: +new Date(),
        accumulated: elapsed,
        note: timer?.note ?? "",
      }),
    );
  const pause = () =>
    timer &&
    act(saveTimer({ ...timer, startedAt: null, accumulated: elapsed }));
  const finish = async () => {
    if (!timer || !elapsed) {
      toast("Start a study session first.");
      return;
    }
    await act(
      db.transaction("rw", [db.study, db.timer], async () => {
        const active = await db.timer.get("active");
        if (!active)
          throw new Error("This timer has already been saved or cleared.");
        const seconds = Math.min(
          86400,
          Math.floor(
            active.accumulated +
              (active.startedAt
                ? Math.max(0, (Date.now() - active.startedAt) / 1000)
                : 0),
          ),
        );
        await db.study.add(
          studySchema.parse({
            id: uid(),
            courseId: active.courseId,
            date: localDate(),
            seconds,
            note: active.note,
            updatedAt: timestamp(),
          }),
        );
        await db.timer.delete("active");
      }),
      "Study session saved",
    );
  };
  return (
    <section className="panel study-panel" data-running={!!timer?.startedAt}>
      <div className="widget-label">
        <TimerIcon size={16} />
        <span>FOCUS SESSION</span>
        <span className={`tiny-dot ${timer?.startedAt ? "live" : ""}`} />
      </div>
      <select
        aria-label="Study course"
        value={timer?.courseId ?? courseId}
        disabled={!!timer}
        onChange={(e) => setCourse(e.target.value)}
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.shortName}
          </option>
        ))}
      </select>
      <div className="timer-display" aria-label={`Study duration ${label}`}>
        {label}
      </div>
      <p>
        {timer?.startedAt
          ? "Your timer keeps running when you leave."
          : timer
            ? "Paused. Pick up where you left off."
            : "One thing at a time. Give it your attention."}
      </p>
      <div className="timer-actions">
        <button className="button" disabled={!courses.length} onClick={timer?.startedAt ? pause : start}>
          {timer?.startedAt ? <Pause size={15} /> : <Play size={15} />}{" "}
          {timer?.startedAt ? "Pause" : timer ? "Resume" : "Start focus"}
        </button>
        {timer && (
          <>
            <button
              className="icon-button bordered"
              aria-label="Save study session"
              onClick={finish}
            >
              <Check size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Discard timer"
              onClick={() => setConfirm(true)}
            >
              <RotateCcw size={16} />
            </button>
          </>
        )}
      </div>
      {timer && <label className="sr-only" aria-label="Study note" />}
      {settings.theme === "focus" && (
        <p className="fine-print">
          Focus mode keeps ambient motion and decorative layers quiet.
        </p>
      )}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Discard this focus session?"
        description="This timer will be cleared without adding it to your study history."
      >
        <div className="dialog-actions">
          <button
            className="button secondary"
            onClick={() => setConfirm(false)}
          >
            Keep timer
          </button>
          <button
            className="button danger"
            onClick={async () => {
              if (await act(db.timer.delete("active"), "Timer cleared"))
                setConfirm(false);
            }}
          >
            Discard
          </button>
        </div>
      </Modal>
    </section>
  );
}
