import { useEffect, useState, type CSSProperties } from "react";
import { useSystemReducedMotion } from "../lib/motion";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  CheckCircle2,
  BookOpen,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { category } from "../data/academic";
import { useApp } from "../lib/context";
import {
  addDays,
  at,
  attendanceStats,
  countdown,
  effectiveRecords,
  formatDate,
  formatTime,
  localDate,
  sessionWindow,
  present,
  recordId,
  sessionsOn,
  sessionStatus,
  weekStart,
  roomLabel,
} from "../lib/scheduling";
import { AttendanceDialog } from "../components/AttendanceDialog";
import { WorkflowGuide } from "../components/WorkflowGuide";
import { StudyTimer } from "../components/StudyTimer";
import {
  CourseTag,
  Empty,
  ProgressBar,
  SectionHead,
  Status,
  TextLink,
} from "../components/ui";
import { PlannerDialog } from "../components/PlannerDialog";
import type { Session } from "../data/academic";
import { academicLabel, creditLabel } from "../lib/academic";
export function PrismArt() {
  return (
    <svg className="prism-art" viewBox="0 0 540 300" aria-hidden="true">
      <defs>
        <linearGradient id="prism-face" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#a9b9e8" stopOpacity=".12" />
          <stop offset="1" stopColor="#222a43" stopOpacity=".05" />
        </linearGradient>
        <linearGradient id="beam">
          <stop stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#f3f2ff" stopOpacity=".7" />
        </linearGradient>
        <filter id="soft">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <path d="M12 156 242 149" stroke="url(#beam)" strokeWidth="2" />
      <path
        d="m270 38 104 203H163Z"
        fill="url(#prism-face)"
        stroke="#b4bfdc"
        strokeOpacity=".55"
      />
      <path
        d="m270 38 13 173 91 30M163 241l120-30"
        stroke="#a4b5db"
        strokeOpacity=".25"
        fill="none"
      />
      {["#9b94ef", "#839dfa", "#91c9ef", "#98d6c2", "#e3c6a3", "#db9bae"].map(
        (c, i) => (
          <g key={c}>
            <path
              className="spectrum-ray"
              d={`M242 149 535 ${82 + i * 27}`}
              stroke={c}
              strokeOpacity=".13"
              strokeWidth="12"
              filter="url(#soft)"
            />
            <path
              d={`M242 149 535 ${82 + i * 27}`}
              stroke={c}
              strokeOpacity=".45"
              strokeWidth="1"
            />
          </g>
        ),
      )}
      <circle cx="270" cy="38" r="2" fill="#dfe5f5" />
      <circle cx="163" cy="241" r="2" fill="#dfe5f5" />
      <circle cx="374" cy="241" r="2" fill="#dfe5f5" />
    </svg>
  );
}
export function Today() {
  const { courses, courseById, sourceSessions } = useApp();
  const { settings, attendance, now, navigate, items, topics } = useApp();
  const reducedMotion = useSystemReducedMotion();
  const today = localDate(now);
  const [selected, setSelected] = useState<string | null>(null),
    [offset, setOffset] = useState(0),
    [active, setActive] = useState<{ session: Session; date: string } | null>(
      null,
    ),
    [adding, setAdding] = useState(false);
  const date = selected ?? today,
    base = addDays(weekStart(today), offset * 7);
  const sessions = sessionsOn(date, settings);
  const { current, currents, next } = sessionWindow(now, settings);
  const hasClassesToday = sessionsOn(today, settings).length > 0;
  const academicActivity = current ? "in-session" : hasClassesToday ? "campus" : "open-day";
  const approaching = !!next && +at(next.date, next.session.start) - +now <= 30 * 60000;
  useEffect(() => {
    document.documentElement.dataset.academicActivity = academicActivity;
    return () => { delete document.documentElement.dataset.academicActivity; };
  }, [academicActivity]);
  const ended=sessions.filter(s=>at(date,s.end)<=now).length;
  const elapsed=current?Math.max(0,Math.floor((+now-+at(current.date,current.session.start))/60000)):0;
  const currentRecord=current?attendance.find(r=>r.id===recordId(current.session.id,current.date)):undefined;
  const dateRecords = effectiveRecords(attendance, settings, now).filter(
    (r) => r.date === date,
  );
  const attended = dateRecords.filter(present).length,
    resolved = dateRecords.length,
    stats = attendanceStats(dateRecords);
  const plannedMinutes = sessions.reduce(
    (n, s) => n + (+at(date, s.end) - +at(date, s.start)) / 60000,
    0,
  );
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const upcoming = items
    .filter((x) => !x.done)
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .slice(0, 3);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR SPACE / TODAY</div>
          <h1>
            {greeting}{settings.name ? `, ${settings.name}` : ""}
            <span className="accent-punctuation">.</span>
          </h1>
          <p>
            {formatDate(today, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            <span className="separator">/</span> {academicLabel(settings)}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => navigate("schedule")}
        >
          <CalendarDays size={16} />
          Weekly schedule
        </button>
      </div>
      <WorkflowGuide compact />
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="day-hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="tiny-dot live" />
                {current
                  ? "IN SESSION"
                  : sessionsOn(today, settings).length
                    ? "CAMPUS DAY"
                    : "OPEN DAY"}
              </div>
              <h2>
                {current
                  ? courseById(current.session.courseId).shortName
                  : sessionsOn(today, settings).length
                    ? "Your day, in motion."
                    : "A day to make your own."}
              </h2>
              <p>
                {current
                  ? `${courseById(current.session.courseId).code} · ${category(current.session.type)} · ${roomLabel(current.session.room)}. Started ${elapsed} min ago. Ends in ${countdown(at(current.date, current.session.end), now)}.`
                  : sessionsOn(today, settings).length
                    ? "Your classes, your pace. One session at a time."
                    : "No scheduled classes today. A little focus goes a long way."}
              </p>
              {current&&<p className="current-checkin">{currentRecord?`${present(currentRecord)?"Arrival recorded":"Attendance recorded"} · ${currentRecord.lateMinutes} late minutes`:"Arrival not recorded. Check in to record your actual arrival."}{currents.length>1?` ${currents.length} classes overlap now; all are listed below.`:""}</p>}
              <button
                className="hero-button"
                onClick={() =>
                  current
                    ? setActive(current)
                    : document.getElementById("day-agenda")?.scrollIntoView({
                        behavior:
                          settings.reduceMotion ||
                          reducedMotion ||
                          settings.theme === "focus"
                            ? "instant"
                            : "smooth",
                      })
                }
              >
                {current ? "Check in" : "Open your day"}
                <ArrowUpRight size={18} />
              </button>
            </div>
            <PrismArt />
            <span className="hero-index">01 — SEMESTER OS</span>
          </section>
          <div className="metric-strip">
            <div>
              <span>CLASSES {date === today ? "TODAY" : "SELECTED DAY"}</span>
              <strong>
                {sessions.length.toString().padStart(2, "0")}
                <small>
                  {plannedMinutes
                    ? `${(plannedMinutes / 60).toFixed(1).replace(".0", "")} scheduled hours`
                    : "No classes scheduled"}
                </small>
              </strong>
            </div>
            <div>
              <span>CHECKED IN</span>
              <strong>
                {attended.toString().padStart(2, "0")}
                <small>
                  {sessions.length
                    ? `${Math.max(0, sessions.length - resolved)} awaiting a record`
                    : "Enjoy the open space"}
                </small>
              </strong>
            </div>
            <div>
              <span>ATTENDANCE</span>
              <strong>
                {stats.percentage === null ? "—" : `${stats.percentage}%`}
                <small>
                  {stats.total
                    ? "From recorded sessions"
                    : "No records for this day"}
                </small>
              </strong>
            </div>
          </div>
          {sessions.length>0&&<div className="day-completion"><span>{ended} ended · {sessions.length-ended} remaining</span><ProgressBar value={ended/sessions.length*100} label="Scheduled classes ended"/><small>Time elapsed · attendance is recorded separately</small></div>}
          <section className="panel agenda-panel" id="day-agenda">
            <SectionHead
              title="Your day"
              action={
                <div className="week-controls">
                  <button
                    className="icon-button"
                    aria-label="Previous week"
                    onClick={() => setOffset((n) => n - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>
                    {formatDate(base)} – {formatDate(addDays(base, 6))}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Next week"
                    onClick={() => setOffset((n) => n + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              }
            />
            <div className="week-strip">
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(base, i);
                return (
                  <button
                    key={d}
                    className={`day-pill ${d === date ? "selected" : ""} ${d === today ? "is-today" : ""}`}
                    onClick={() => setSelected(d)}
                    aria-pressed={d === date}
                  >
                    <span>{formatDate(d, { weekday: "short" })}</span>
                    <strong>{Number(d.slice(8))}</strong>
                    <i
                      className={
                        sessionsOn(d, settings).length ? "has-class" : ""
                      }
                    />
                  </button>
                );
              })}
            </div>
            <div className="agenda-date">
              <span>
                {formatDate(date, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {date !== today && (
                <button
                  className="text-link"
                  onClick={() => {
                    setSelected(null);
                    setOffset(0);
                  }}
                >
                  Back to today
                </button>
              )}
              <span>
                {attended} of {sessions.length} attended
              </span>
            </div>
            {sessions.length ? (
              <div className="agenda-list">
                {sessions.map((s) => {
                  const c = courseById(s.courseId),
                    r = attendance.find((r) => r.id === recordId(s.id, date)),
                    status = sessionStatus(s, date, now, settings, r);
                  return (
                    <button
                      key={s.id}
                      className={`agenda-item ${status === "in-progress" ? "current" : ""}`}
                      data-session-state={status === "in-progress" ? "current" : next?.session.id === s.id && next.date === date ? "next" : undefined}
                      aria-haspopup="dialog"
                      aria-expanded={active?.session.id === s.id && active.date === date}
                      style={{ "--course": c.color } as CSSProperties}
                      onClick={() => setActive({ session: s, date })}
                    >
                      <div className="agenda-time">
                        <strong>{formatTime(s.start)}</strong>
                        <span>{formatTime(s.end)}</span>
                      </div>
                      <i className="course-line" />
                      <div className="agenda-course">
                        <span className="mini-code">
                          {c.code} <span>· {category(s.type)}</span>
                        </span>
                        <h3>{c.shortName}</h3>
                        <span className="room-line">
                          <MapPin size={12} />
                          {roomLabel(s.room)}
                          {!s.timeConfirmed && <small>Time assumed</small>}
                        </span>
                      </div>
                      <div className="agenda-status">
                        <Status status={status} minutes={r?.lateMinutes} />
                        <ArrowUpRight size={16} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Empty
                icon={<Sparkles size={25} />}
                title="Space for something good"
              >
                {settings.excludedDates.includes(date)
                  ? "This date is excluded from your timetable."
                  : "No sessions are scheduled within your configured semester for this date."}
                {next && (
                  <span className="empty-next">
                    Next campus session ·{" "}
                    {formatDate(next.date, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </Empty>
            )}
            <div className="agenda-footer">
              <CheckCircle2 size={15} />
              <span>
                {resolved
                  ? `${resolved} session${resolved === 1 ? "" : "s"} recorded · ${stats.excused} excused · ${stats.missed} missed`
                  : "Your attendance story starts with a check-in."}
              </span>
              <ProgressBar
                value={sessions.length ? (resolved / sessions.length) * 100 : 0}
                label="Daily recorded sessions"
              />
            </div>
          </section>
          <section className="panel">
            <SectionHead
              title="On your horizon"
              action={
                <button className="text-link" onClick={() => setAdding(true)}>
                  Add a plan
                  <ArrowUpRight size={15} />
                </button>
              }
            />
            {upcoming.length ? (
              <div className="horizon-list">
                {upcoming.map((item) => (
                  <button key={item.id} onClick={() => navigate("planner")}>
                    <span className={`item-kind ${item.kind}`}>
                      {item.kind}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{courseById(item.courseId).shortName}</span>
                    </div>
                    <span>
                      {item.due ? formatDate(item.due) : "No due date"}
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="inline-empty">
                <BookOpen size={21} />
                <div>
                  <strong>A clear horizon</strong>
                  <p>Add assignments and exam dates as they’re announced.</p>
                </div>
              </div>
            )}
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="panel next-panel" data-approaching={approaching}>
            <div className="widget-label">
              <span className="tiny-dot live" />
              <span>UP NEXT</span>
              <Clock size={15} />
            </div>
            {next ? (
              <>
                <CourseTag id={next.session.courseId} />
                <h2>{courseById(next.session.courseId).shortName}</h2>
                <span className="subtle">{category(next.session.type)}</span>
                <div className="next-meta">
                  <span>
                    <CalendarDays size={15} />
                    {formatDate(next.date, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span>
                    <MapPin size={15} />
                    {roomLabel(next.session.room)}
                  </span>
                </div>
                <div className="countdown">
                  <span>Starts in</span>
                  <strong>
                    {countdown(at(next.date, next.session.start), now)}
                  </strong>
                  <span>
                    {formatTime(next.session.start)} –{" "}
                    {formatTime(next.session.end)}
                  </span>
                </div>
                <p className="assumption">
                  {next.session.timeConfirmed
                    ? "Time confirmed by you"
                    : "Timing assumed · confirm in Settings"}
                </p>
                <button
                  className="button secondary full"
                  onClick={() => {
                    setActive(next);
                  }}
                >
                  Open session
                  <ArrowRight size={15} />
                </button>
              </>
            ) : (
              <Empty title="No upcoming sessions">
                Your configured semester has ended or has no active dates.
              </Empty>
            )}
          </section>
          <StudyTimer />
          <section className="panel semester-panel">
            <div className="widget-label">
              <BookOpen size={15} />
              <span>THE SEMESTER</span>
            </div>
            <div className="semester-numbers">
              <div>
                <strong>{String(courses.length).padStart(2, "0")}</strong>
                <span>courses</span>
              </div>
              <div>
                <strong>{creditLabel(settings)}</strong>
                <span>credits</span>
              </div>
              <div>
                <strong>{String(new Set(sourceSessions.map(s => s.day)).size).padStart(2, "0")}</strong>
                <span>campus days</span>
              </div>
            </div>
            <div className="small-course-list">
              {courses.slice(0, 3).map(({id}) => (
                <button key={id} onClick={() => navigate(`courses/${id}`)}>
                  <CourseTag id={id} />
                  <span>
                    {topics.filter((t) => t.courseId === id && t.done).length}{" "}
                    topics done
                  </span>
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            <TextLink onClick={() => navigate("courses")}>
              All course workspaces
            </TextLink>
          </section>
          <div className="device-note">
            <span className="tiny-dot" />
            PERSONAL SPACE · STORED ON THIS DEVICE
          </div>
        </aside>
      </div>
      {active && (
        <AttendanceDialog
          key={`${active.session.id}:${active.date}`}
          session={active.session}
          date={active.date}
          onClose={() => setActive(null)}
        />
      )}{" "}
      {adding && <PlannerDialog onClose={() => setAdding(false)} />}
    </>
  );
}
