import { useState } from "react";
import { Save } from "lucide-react";

import { db, saveItem, timestamp, uid } from "../lib/db";
import { useApp } from "../lib/context";
import type { PlannerItem } from "../lib/schema";
import { Modal } from "./ui";
export function PlannerDialog({
  item,
  courseId,
  onClose,
}: {
  item?: PlannerItem;
  courseId?: string;
  onClose: () => void;
}) {
  const { courses } = useApp();
  const { act } = useApp();
  const [title, setTitle] = useState(item?.title ?? ""),
    [course, setCourse] = useState(item?.courseId ?? courseId ?? courses[0]?.id ?? ""),
    [kind, setKind] = useState<PlannerItem["kind"]>(item?.kind ?? "assignment"),
    [due, setDue] = useState(item?.due ?? ""),
    [note, setNote] = useState(item?.note ?? ""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={item ? "Edit planner item" : "Make a plan"}
      description="Your assignments, exams, and tasks. Add dates when you know them."
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          setBusy(true);
          const ok = await act(
            saveItem({
              id: item?.id ?? uid(),
              title: title.trim(),
              courseId: course,
              kind,
              due: due || null,
              done: item?.done ?? false,
              note,
              updatedAt: timestamp(),
            }),
            "Plan saved",
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <label>
          Title
          <input
            required
            autoFocus
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What’s coming up?"
          />
        </label>
        {!courses.length && <p className="form-error">Add courses by setting up a semester before creating a plan.</p>}
        <label>
          Course
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.shortName}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Type
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PlannerItem["kind"])}
            >
              <option value="assignment">Assignment</option>
              <option value="exam">Exam</option>
              <option value="task">Task</option>
            </select>
          </label>
          <label>
            Due date (optional)
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
        </div>
        <label>
          Details
          <textarea
            rows={4}
            maxLength={5000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Instructions, links, or things to remember…"
          />
        </label>
        <div className="dialog-actions">
          {item && (
            <button
              type="button"
              className="button danger secondary"
              onClick={async () => {
                if (await act(db.items.delete(item.id), "Item removed"))
                  onClose();
              }}
            >
              Delete item
            </button>
          )}
          <button className="button" disabled={busy || !course}>
            <Save size={16} />
            Save plan
          </button>
        </div>
      </form>
    </Modal>
  );
}
