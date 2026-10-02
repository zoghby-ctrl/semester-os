import { useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import { days, type Session } from "../data/academic";
import { useApp } from "../lib/context";
import { saveItem, timestamp } from "../lib/db";
import {
  addDays,
  dateFrom,
  formatDate,
  formatTime,
  localDate,
  sessionsOn,
} from "../lib/scheduling";
import type { PlannerItem } from "../lib/schema";
import { AddButton, Empty, SectionHead } from "../components/ui";
import { PlannerDialog } from "../components/PlannerDialog";
import { AttendanceDialog } from "../components/AttendanceDialog";
export function Planner() {
  const { courses, courseById } = useApp();
  const { settings, now, items, act } = useApp();
  const today = localDate(now);
  const [month, setMonth] = useState(today.slice(0, 7) + "-01"),
    [selected, setSelected] = useState(today),
    [filter, setFilter] = useState("open"),
    [course, setCourse] = useState("all"),
    [editing, setEditing] = useState<PlannerItem | null | undefined>(undefined),
    [session, setSession] = useState<Session | null>(null);
  const start = addDays(month, -dateFrom(month).getDay());
  const visible = items
    .filter(
      (x) =>
        (filter === "all" || (filter === "done" ? x.done : !x.done)) &&
        (course === "all" || x.courseId === course),
    )
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const selectedItems = items.filter((x) => x.due === selected);
  const move = (n: number) => {
    const d = dateFrom(month);
    d.setMonth(d.getMonth() + n);
    setMonth(localDate(d));
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR SPACE / PLANNER</div>
          <h1>
            Make room for what matters
            <span className="accent-punctuation">.</span>
          </h1>
          <p>Assignments, exams, and the days in between.</p>
        </div>
        <AddButton onClick={() => setEditing(null)}>New plan</AddButton>
      </div>
      <div className="planner-layout">
        <section className="panel calendar-panel">
          <SectionHead
            title={formatDate(month, { month: "long", year: "numeric" })}
            action={
              <div className="week-controls">
                <button
                  className="icon-button"
                  aria-label="Previous month"
                  onClick={() => move(-1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="button small secondary"
                  onClick={() => {
                    setMonth(today.slice(0, 7) + "-01");
                    setSelected(today);
                  }}
                >
                  Today
                </button>
                <button
                  className="icon-button"
                  aria-label="Next month"
                  onClick={() => move(1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            }
          />
          <div className="calendar-weekdays">
            {days.map((d) => (
              <span key={d}>{d.slice(0, 3)}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: 42 }, (_, i) => {
              const date = addDays(start, i),
                campus = sessionsOn(date, settings),
                plans = items.filter((x) => x.due === date && !x.done);
              return (
                <button
                  key={date}
                  className={`${date.slice(0, 7) !== month.slice(0, 7) ? "other-month" : ""} ${date === selected ? "selected" : ""} ${date === today ? "is-today" : ""}`}
                  onClick={() => setSelected(date)}
                  aria-label={`${formatDate(date, { weekday: "long", month: "long", day: "numeric" })}, ${campus.length} classes, ${plans.length} open plans`}
                  aria-pressed={date === selected}
                >
                  <span>{Number(date.slice(8))}</span>
                  <div className="calendar-markers">
                    {campus.length > 0 && <i className="campus-marker" />}
                    {plans.length > 0 && <i className="plan-marker" />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="chart-legend">
            <span>
              <i className="campus-marker" />
              Campus sessions
            </span>
            <span>
              <i className="plan-marker" />
              Open plans
            </span>
          </div>
          <p className="fine-print">
            The timetable repeats weekly. Set semester dates and excluded days
            in Settings to limit recurrence.
          </p>
        </section>
        <section className="panel day-preview">
          <SectionHead
            title={formatDate(selected, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          />
          {sessionsOn(selected, settings).map((s) => (
            <button
              key={s.id}
              className="simple-list-item"
              onClick={() => setSession(s)}
            >
              <div>
                <strong>{courseById(s.courseId).shortName}</strong>
                <span>
                  {formatTime(s.start)} · <MapPin size={12} />
                  {s.room || "Room not supplied"}
                </span>
              </div>
              <ArrowUpRight size={15} />
            </button>
          ))}
          {selectedItems.map((x) => (
            <button
              key={x.id}
              className="simple-list-item"
              onClick={() => setEditing(x)}
            >
              <div>
                <span className={`item-kind ${x.kind}`}>{x.kind}</span>
                <strong className={x.done ? "completed-text" : ""}>
                  {x.title}
                </strong>
              </div>
              <ArrowUpRight size={15} />
            </button>
          ))}
          {!sessionsOn(selected, settings).length && !selectedItems.length && (
            <Empty icon={<CalendarDays size={24} />} title="An open day">
              Nothing scheduled for this date.
            </Empty>
          )}
        </section>
      </div>
      <section className="panel">
        <SectionHead
          title="Your plans"
          action={<AddButton onClick={() => setEditing(null)}>Add</AddButton>}
        />
        <div className="planner-filters">
          <div className="segmented">
            {[
              ["open", "Open"],
              ["done", "Completed"],
              ["all", "All"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter plans by course"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option value={c.id} key={c.id}>
                {c.shortName}
              </option>
            ))}
          </select>
        </div>
        {visible.length ? (
          visible.map((item) => (
            <div className="planner-row" key={item.id}>
              <button
                className={`check-button ${item.done ? "checked" : ""}`}
                aria-label={`${item.done ? "Reopen" : "Complete"} ${item.title}`}
                aria-pressed={item.done}
                onClick={() =>
                  act(
                    saveItem({
                      ...item,
                      done: !item.done,
                      updatedAt: timestamp(),
                    }),
                  )
                }
              >
                {item.done && <Check size={15} />}
              </button>
              <button
                className="planner-row-content"
                onClick={() => setEditing(item)}
              >
                <span className={`item-kind ${item.kind}`}>{item.kind}</span>
                <div>
                  <strong className={item.done ? "completed-text" : ""}>
                    {item.title}
                  </strong>
                  <small>{courseById(item.courseId).shortName}</small>
                </div>
                <span
                  className={
                    item.due && item.due < today && !item.done ? "overdue" : ""
                  }
                >
                  {item.due ? formatDate(item.due) : "No due date"}
                  {item.due && item.due < today && !item.done
                    ? " · overdue"
                    : ""}
                </span>
                <ArrowUpRight size={15} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            title={
              filter === "done"
                ? "Your wins will appear here"
                : "Your horizon is clear"
            }
          >
            Add real deadlines and tasks as they’re announced.
          </Empty>
        )}
      </section>
      {editing !== undefined && (
        <PlannerDialog
          item={editing ?? undefined}
          onClose={() => setEditing(undefined)}
        />
      )}{" "}
      {session && (
        <AttendanceDialog
          session={session}
          date={selected}
          onClose={() => setSession(null)}
        />
      )}
    </>
  );
}
