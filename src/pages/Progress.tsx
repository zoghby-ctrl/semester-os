import { useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";

import { useApp } from "../lib/context";
import {
  addDays,
  attendanceStats,
  effectiveRecords,
  formatDate,
  formatTime,
  localDate,
  present,
  sessionsFor,
  sessionsOn,
  weekStart,
  semesterElapsed,
} from "../lib/scheduling";
import { AttendanceDialog } from "../components/AttendanceDialog";
import {
  CourseTag,
  Empty,
  ProgressBar,
  SectionHead,
  Status,
} from "../components/ui";
import { db } from "../lib/db";
export function Progress() {
  const { courses, courseById, sourceSessions } = useApp();
  const { attendance, settings, now, topics, study, items, act } = useApp();
  const semesterTime=semesterElapsed(settings,now),assignments=items.filter(i=>i.kind==="assignment"),completedAssignments=assignments.filter(i=>i.done).length;
  const [course, setCourse] = useState("all"),
    [kind, setKind] = useState("all"),
    [limit, setLimit] = useState(25),
    [active, setActive] = useState<{
      session: ReturnType<typeof sessionsFor>[number];
      date: string;
    } | null>(null);
  const records = effectiveRecords(attendance, settings, now).filter(
    (r) => r.date <= localDate(now),
  );
  const stats = attendanceStats(records),
    today = localDate(now),
    base = weekStart(today);
  const thisWeek = records.filter((r) => r.date >= base && r.date <= today),
    todayRecords = records.filter((r) => r.date === today);
  const scheduledWeek = Array.from(
      { length: 7 },
      (_, i) => sessionsOn(addDays(base, i), settings).length,
    ).reduce((a, b) => a + b, 0),
    plannedToday = sessionsOn(today, settings).length;
  const history = records
    .filter(
      (r) =>
        (course === "all" ||
          sourceSessions.find((s) => s.id === r.sessionId)?.courseId ===
            course) &&
        (kind === "all" ||
          (kind === "late"
            ? r.lateMinutes > 0 && present(r)
            : r.status === kind)),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.plannedStart.localeCompare(a.plannedStart),
    );
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = addDays(base, (i - 5) * 7);
    return {
      start,
      ...attendanceStats(
        records.filter((r) => r.date >= start && r.date <= addDays(start, 6)),
      ),
    };
  });
  const max = Math.max(
    1,
    ...weeks.map((w) => w.attended + w.missed + w.excused),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR SPACE / PROGRESS</div>
          <h1>
            Small steps add up<span className="accent-punctuation">.</span>
          </h1>
          <p>A clear view of the work you’ve actually done.</p>
        </div>
      </div>
      <div className="progress-metrics">
        <Metric
          icon={<ShieldCheck size={19} />}
          label="Overall attendance"
          value={stats.percentage === null ? "—" : `${stats.percentage}%`}
          detail={`${stats.attended} attended / ${stats.attended + stats.missed} counted`}
        />
        <Metric
          icon={<CheckCircle2 size={19} />}
          label="This week"
          value={`${thisWeek.filter(present).length} / ${scheduledWeek}`}
          detail={`${todayRecords.filter(present).length} / ${plannedToday} attended today`}
        />
        <Metric
          icon={<Clock size={19} />}
          label="Late minutes"
          value={String(stats.lateMinutes)}
          detail={`${stats.late} late arrivals recorded`}
        />
        <Metric
          icon={<BarChart3 size={19} />}
          label="Study time"
          value={`${Math.round(study.reduce((n, s) => n + s.seconds, 0) / 60)} min`}
          detail={`${study.length} saved focus sessions`}
        />
      </div>
      <div className="progress-grid">
        <section className="panel"><SectionHead title="Your semester, in context"/><div className="semester-context-metrics"><div><span>Assignment completion</span><strong>{assignments.length?`${completedAssignments} / ${assignments.length}`:"—"}</strong><p>{assignments.length?"From assignments you added":"No assignments added yet"}</p></div><div><span>Calendar elapsed</span><strong>{semesterTime?`${semesterTime.percentage}%`:"—"}</strong><p>{semesterTime?`${semesterTime.elapsed} of ${semesterTime.total} days · unrelated to learning progress`:"Add semester dates in Settings to see calendar progress"}</p></div></div></section>
        <section className="panel">
          <SectionHead title="Attendance by course" />
          {courses.map((c) => {
            const s = attendanceStats(
              records.filter(
                (r) =>
                  sourceSessions.find((x) => x.id === r.sessionId)?.courseId ===
                  c.id,
              ),
            );
            return (
              <div className="attendance-course" key={c.id}>
                <div>
                  <CourseTag id={c.id} />
                  <span>
                    {s.percentage === null ? "No records" : s.percentage + "%"}
                  </span>
                </div>
                <div
                  className="attendance-bar"
                  role="img"
                  aria-label={`${c.name}: ${s.attended} attended, ${s.missed} missed, ${s.excused} excused`}
                >
                  <span
                    className="attended-segment"
                    style={{
                      width: s.total
                        ? `${(s.attended / s.total) * 100}%`
                        : "0%",
                    }}
                  />
                  <span
                    className="missed-segment"
                    style={{
                      width: s.total ? `${(s.missed / s.total) * 100}%` : "0%",
                    }}
                  />
                  <span
                    className="excused-segment"
                    style={{
                      width: s.total ? `${(s.excused / s.total) * 100}%` : "0%",
                    }}
                  />
                </div>
                <small>
                  {c.shortName} · {s.attended} attended · {s.missed} missed ·{" "}
                  {s.excused} excused
                </small>
              </div>
            );
          })}
          <div className="chart-legend">
            <span>
              <i className="attended-segment" />
              Attended
            </span>
            <span>
              <i className="missed-segment" />
              Missed
            </span>
            <span>
              <i className="excused-segment" />
              Excused
            </span>
          </div>
        </section>
        <section className="panel">
          <SectionHead title="The last six weeks" />
          <div
            className="weekly-chart"
            role="img"
            aria-label="Weekly recorded attendance. Each bar shows attended, missed and excused sessions."
          >
            {weeks.map((w) => (
              <div className="chart-week" key={w.start}>
                <span>{w.total || "—"}</span>
                <div className="chart-bar-space">
                  <div
                    className="stacked-bar"
                    style={{ height: `${(w.total / max) * 100}%` }}
                  >
                    <span
                      className="excused-segment"
                      style={{
                        height: w.total
                          ? `${(w.excused / w.total) * 100}%`
                          : "0%",
                      }}
                    />
                    <span
                      className="missed-segment"
                      style={{
                        height: w.total
                          ? `${(w.missed / w.total) * 100}%`
                          : "0%",
                      }}
                    />
                    <span
                      className="attended-segment"
                      style={{
                        height: w.total
                          ? `${(w.attended / w.total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
                <small>{formatDate(w.start)}</small>
                <span className="sr-only">
                  {w.attended} attended, {w.missed} missed, {w.excused} excused
                </span>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Counts of recorded sessions by week, beginning Sunday. Empty weeks
            have no records.
          </p>
          <div className="summary-chips">
            <span>{stats.attended} attended</span>
            <span>{stats.missed} missed</span>
            <span>{stats.excused} excused</span>
          </div>
        </section>
        <section className="panel">
          <SectionHead title="Learning, on your terms" />
          {courses.map((c) => {
            const ts = topics.filter((t) => t.courseId === c.id),
              done = ts.filter((t) => t.done).length;
            return (
              <div
                className="topic-progress-row"
                key={c.id}
                style={{ "--course": c.color } as CSSProperties}
              >
                <div>
                  <span>{c.shortName}</span>
                  <strong>
                    {done} / {ts.length}
                  </strong>
                </div>
                <ProgressBar
                  value={ts.length ? (done / ts.length) * 100 : 0}
                  label={`${c.name} syllabus completion`}
                  color={c.color}
                />
              </div>
            );
          })}
          <p className="fine-print">
            Learning progress reflects only topics you entered and completed. It
            is independent of your attendance.
          </p>
        </section>
        <section className="panel">
          <SectionHead title="This week, day by day" />
          <div className="daily-progress">
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(base, i),
                planned = sessionsOn(date, settings).length,
                done = records.filter(
                  (r) => r.date === date && present(r),
                ).length;
              return (
                <div key={date}>
                  <span>{formatDate(date, { weekday: "short" })}</span>
                  <ProgressBar
                    value={planned ? (done / planned) * 100 : 0}
                    label={`${formatDate(date, { weekday: "long" })} attended sessions`}
                  />
                  <strong>{planned ? `${done}/${planned}` : "—"}</strong>
                </div>
              );
            })}
          </div>
          <p className="fine-print">
            Attended sessions / scheduled sessions. Days without classes show a
            dash.
          </p>
        </section>
      </div>
      <section className="panel history-panel">
        <SectionHead title="Attendance timeline" />
        <div className="history-filters">
          <label>
            Course
            <select
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                setLimit(25);
              }}
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setLimit(25);
              }}
            >
              <option value="all">All records</option>
              <option value="late">Late arrivals</option>
              <option value="on-time">On time</option>
              <option value="attended">Attended</option>
              <option value="missed">Missed</option>
              <option value="excused">Excused</option>
            </select>
          </label>
          <p>{history.length} records</p>
        </div>
        {history.length ? (
          history.slice(0, limit).map((r) => {
            const s = sessionsFor(settings).find((x) => x.id === r.sessionId)!;
            return (
              <button
                className="history-row"
                key={r.id}
                onClick={() => setActive({ session: s, date: r.date })}
              >
                <span>
                  {formatDate(r.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div>
                  <strong>{courseById(s.courseId).shortName}</strong>
                  <span>
                    {courseById(s.courseId).code} ·{" "}
                    {r.arrival
                      ? `Arrived ${formatTime(r.arrival)}`
                      : "No check-in"}
                    {r.override ? " · corrected" : ""}
                  </span>
                </div>
                <Status status={r.status} minutes={r.lateMinutes} />
                <ArrowUpRight size={15} />
              </button>
            );
          })
        ) : (
          <Empty
            icon={<Clock size={25} />}
            title="Your history will grow with you"
          >
            Your saved check-ins and corrections appear here.
          </Empty>
        )}
        {history.length > limit && (
          <button
            className="button secondary full"
            onClick={() => setLimit((n) => n + 25)}
          >
            Show more records
          </button>
        )}
        <p className="fine-print">
          Attendance = attended ÷ (attended + missed). Excused and unrecorded
          sessions are excluded.{" "}
          {settings.autoMissed
            ? "Unrecorded past classes after your tracking start are classified as missed."
            : "Past classes stay unrecorded until you enter a status."}
        </p>
      </section>
      {study.length > 0 && (
        <section className="panel study-history">
          <SectionHead title="Saved focus sessions" />
          {study
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 15)
            .map((s) => (
              <div className="simple-list-item" key={s.id}>
                <div>
                  <strong>{courseById(s.courseId).shortName}</strong>
                  <span>
                    {formatDate(s.date)} ·{" "}
                    {s.seconds < 60
                      ? `${s.seconds} sec`
                      : `${Math.round(s.seconds / 60)} min`}
                  </span>
                </div>
                <button
                  className="text-link"
                  onClick={() =>
                    act(db.study.delete(s.id), "Study session removed")
                  }
                >
                  Remove
                </button>
              </div>
            ))}
        </section>
      )}
      {active && (
        <AttendanceDialog {...active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="panel metric-card">
      <div>
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
