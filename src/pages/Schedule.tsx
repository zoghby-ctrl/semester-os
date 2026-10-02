import { useState, type CSSProperties } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { category, days, type Session } from "../data/academic";
import { useApp } from "../lib/context";
import {
  addDays,
  formatDate,
  formatTime,
  localDate,
  localTime,
  minutes,
  sessionsFor,
  sessionsOn,
  weekStart,
  timetableLanes,
  roomLabel,
  sessionStatus,
  recordId,
  sessionWindow,
} from "../lib/scheduling";
import { AttendanceDialog } from "../components/AttendanceDialog";
import { Empty, Status } from "../components/ui";
import { creditLabel } from "../lib/academic";
import { semesterConflicts } from "../lib/domain";
export function Schedule() {
  const { courseById } = useApp();
  const { settings, now, navigate, attendance } = useApp();
  const [offset, setOffset] = useState(0),
    [filter, setFilter] = useState("all"),
    [active, setActive] = useState<{ session: Session; date: string } | null>(
      null,
    ),
    [mobileDay, setMobileDay] = useState(now.getDay());
  const base = addDays(weekStart(localDate(now)), offset * 7);
  const sessions = sessionsFor(settings);
  const scheduledDays = [...new Set(sessions.map(s => s.day))].sort((a,b) => a-b);
  const displayDays = scheduledDays.length ? scheduledDays : [0,1,2,3,4,5,6];
  const selectedDay = displayDays.includes(mobileDay) ? mobileDay : displayDays[0];
  const filtered = sessions.filter(
    (s) =>
      filter === "all" ||
      (filter === "lecture" ? s.type === "lecture" : s.type !== "lecture"),
  );
  const min =
      Math.floor(Math.min(480, ...sessions.map((s) => minutes(s.start))) / 60) *
      60,
    max =
      Math.ceil(Math.max(1020, ...sessions.map((s) => minutes(s.end))) / 60) *
      60;
  const height = (max - min) * 1.12;
  const todayIndex = now.getDay(),
    todayInWeek = weekStart(localDate(now)) === base;
  const time = minutes(localTime(now));
  const lanes=timetableLanes(filtered),conflicts=semesterConflicts(sessions);
  const { currents, next } = sessionWindow(now, settings);
  const visualState = (session: Session, date: string) => currents.some(c => c.session.id === session.id && c.date === date) ? "current" : next?.session.id === session.id && next.date === date ? "next" : undefined;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR SPACE / SCHEDULE</div>
          <h1>
            A week with intention<span className="accent-punctuation">.</span>
          </h1>
          <p>{sessions.length} sessions · {scheduledDays.map(d => days[d].slice(0,3)).join(" / ") || "No campus days yet"} · {creditLabel(settings)} credit hours</p>
        </div>
        <button
          className="button secondary"
          onClick={() => navigate("settings/schedule")}
        >
          <SlidersHorizontal size={16} />
          Edit times
        </button>
      </div>
      <p className="fine-print">Select a class to record attendance. Use the week arrows for a past date, then reopen that class to correct its saved check-in.</p>
      <div className="schedule-toolbar">
        <div className="segmented" aria-label="Session filter">
          {[
            ["all", "All sessions"],
            ["lecture", "Lectures"],
            ["practical", "Labs / Tutorials"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="week-controls">
          <button
            className="icon-button"
            aria-label="Previous week"
            onClick={() => setOffset((n) => n - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <strong>
            {formatDate(base)} – {formatDate(addDays(base, 6))}
          </strong>
          <button
            className="icon-button"
            aria-label="Next week"
            onClick={() => setOffset((n) => n + 1)}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="button small secondary"
            onClick={() => setOffset(0)}
          >
            This week
          </button>
        </div>
      </div>
      <div className="schedule-notice">
        <CalendarDays size={16} />
        <span>
          {!sessions.length ? "Create your semester to bring your timetable here." : sessions.some((s) => !s.timeConfirmed)
            ? "Some session times need confirmation. Check them against your timetable in Settings."
            : "All session times have been confirmed by you."}
        </span>
      </div>
      {conflicts.length>0&&<div className="schedule-notice">{conflicts.length} timetable overlap{conflicts.length!==1?"s":""} · concurrent classes appear side by side. Check times with your university.</div>}
      <section className="panel timetable-desktop" style={{ "--day-columns": displayDays.length } as CSSProperties}>
        <div className="timetable-head">
          <div className="time-label">LOCAL TIME</div>
          {displayDays.map((day) => (
            <div
              className={
                todayInWeek && todayIndex === day ? "today-column" : ""
              }
              key={day}
            >
              <span>{days[day].toUpperCase()}</span>
              <strong>
                {formatDate(addDays(base, day), {
                  month: "short",
                  day: "numeric",
                })}
              </strong>
              <small>
                {sessionsOn(addDays(base, day), settings).length} sessions
              </small>
            </div>
          ))}
        </div>
        <div className="timetable-body" style={{ height }}>
          <div className="time-axis">
            {Array.from({ length: (max - min) / 60 + 1 }, (_, i) => (
              <span key={i} style={{ top: i * 60 * 1.12 }}>
                {formatTime(
                  `${String(Math.floor((min + i * 60) / 60)).padStart(2, "0")}:00`,
                )}
              </span>
            ))}
          </div>
          {displayDays.map((day) => {
            const date = addDays(base, day);
            const allowed = sessionsOn(date, settings);
            return (
              <div
                className={`timetable-column ${todayInWeek && todayIndex === day ? "today-column" : ""}`}
                key={day}
              >
                {Array.from({ length: (max - min) / 60 }, (_, i) => (
                  <div
                    className="hour-grid"
                    key={i}
                    style={{ top: i * 60 * 1.12, height: 60 * 1.12 }}
                  />
                ))}
                {filtered
                  .filter(
                    (s) => s.day === day && allowed.some((x) => x.id === s.id),
                  )
                  .map((s) => {
                    const c = courseById(s.courseId);
                    const lane=lanes.get(s.id)!;
                    return (
                      <button
                        key={s.id}
                        className={`schedule-block ${s.type !== "lecture" ? "practical" : ""}`}
                        data-session-state={visualState(s, date)}
                        aria-haspopup="dialog"
                        aria-expanded={active?.session.id === s.id && active.date === date}
                        style={
                          {
                            top: (minutes(s.start) - min) * 1.12 + 3,
                            left:`calc(${lane.column/lane.columns*100}% + 5px)`,
                            width:`calc(${100/lane.columns}% - 10px)`,right:"auto",
                            height:
                              Math.max(30,(minutes(s.end) - minutes(s.start)) * 1.12 - 6),
                            "--course": c.color,
                          } as CSSProperties
                        }
                        onClick={() => setActive({ session: s, date })}
                      >
                        <div>
                          <span>{c.code}</span>
                          <span className="block-time">
                            {formatTime(s.start)} – {formatTime(s.end)}
                          </span>
                        </div>
                        <h3>{c.shortName}</h3>
                        <span className="block-type">{category(s.type)} <Status status={sessionStatus(s,date,now,settings,attendance.find(r=>r.id===recordId(s.id,date)))} /></span>
                        <span className="block-room">
                          <MapPin size={13} />
                          {roomLabel(s.room)}
                          {!s.timeConfirmed && <i title="Assumed time">≈</i>}
                        </span>
                      </button>
                    );
                  })}
                {!allowed.length && (
                  <div className="excluded-day">No scheduled sessions</div>
                )}
                {todayInWeek &&
                  todayIndex === day &&
                  time >= min &&
                  time <= max && (
                    <div
                      className="now-line"
                      style={{ top: (time - min) * 1.12 }}
                    >
                      <span>{localTime(now)}</span>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="timetable-mobile">
        <div className="segmented day-select">
          {displayDays.map((d) => (
            <button
              key={d}
              className={selectedDay === d ? "active" : ""}
              aria-pressed={selectedDay === d}
              onClick={() => setMobileDay(d)}
            >
              {days[d].slice(0, 3)} {Number(addDays(base, d).slice(8))}
            </button>
          ))}
        </div>
        {filtered
          .filter(
            (s) =>
              s.day === selectedDay &&
              sessionsOn(addDays(base, selectedDay), settings).some(
                (x) => x.id === s.id,
              ),
          )
          .map((s) => (
            <button
              key={s.id}
              className="mobile-session panel"
              data-session-state={visualState(s, addDays(base, selectedDay))}
              aria-haspopup="dialog"
              aria-expanded={active?.session.id === s.id && active.date === addDays(base, selectedDay)}
              style={
                { "--course": courseById(s.courseId).color } as CSSProperties
              }
              onClick={() =>
                setActive({ session: s, date: addDays(base, selectedDay) })
              }
            >
              <span>
                {formatTime(s.start)} – {formatTime(s.end)}
              </span>
              <h3>{courseById(s.courseId).shortName}</h3>
              <div>
                <span>
                  {courseById(s.courseId).code} · {category(s.type)}
                </span>
                <span>
                  <MapPin size={12} />
                  {roomLabel(s.room)}
                </span>
              </div>
              {!s.timeConfirmed && <small>Assumed time</small>}
              <Status status={sessionStatus(s, addDays(base, selectedDay), now, settings, attendance.find(r => r.id === recordId(s.id, addDays(base, selectedDay))))} />
            </button>
          ))}
        {!filtered.some(
          (s) =>
            s.day === selectedDay &&
            sessionsOn(addDays(base, selectedDay), settings).some(
              (x) => x.id === s.id,
            ),
        ) && (
          <Empty title="No sessions in this view">
            Try another day or session filter.
          </Empty>
        )}
      </section>
      <div className="week-open-days">
        {days.map((d,i) => !scheduledDays.includes(i) && <span key={d}>{d.slice(0,3).toUpperCase()}</span>)}
        <p>Open days · no classes on the supplied timetable</p>
      </div>
      {active && (
        <AttendanceDialog
          key={`${active.session.id}:${active.date}`}
          {...active}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
