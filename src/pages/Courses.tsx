import { useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock,
  MapPin,
  Plus,
  Save,
  Trash2,
  FileText,
  Search,
} from "lucide-react";
import { category, days, type Session } from "../data/academic";
import { useApp } from "../lib/context";
import { db, saveItem, saveNote, saveTopic, timestamp, uid } from "../lib/db";
import {
  addDays,
  attendanceStats,
  effectiveRecords,
  formatDate,
  formatTime,
  localDate,
  present,
  sessionsFor,
  weekStart,
} from "../lib/scheduling";
import type { Note, PlannerItem } from "../lib/schema";
import {
  AddButton,
  CourseTag,
  Empty,
  Modal,
  ProgressBar,
  SectionHead,
  Status,
} from "../components/ui";
import { PlannerDialog } from "../components/PlannerDialog";
import { AttendanceDialog } from "../components/AttendanceDialog";
import { academicLabel, creditLabel } from "../lib/academic";
export function Courses() {
  const { courses, sourceSessions } = useApp();
  const { navigate, topics, attendance, settings, now } = useApp();
  const [search, setSearch] = useState("");
  const records = effectiveRecords(attendance, settings, now);
  const visible = courses.filter((c) =>
    `${c.id} ${c.name} ${c.prerequisite?.name ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR SPACE / COURSES</div>
          <h1>
            Your course workspaces<span className="accent-punctuation">.</span>
          </h1>
          <p>{academicLabel(settings)} · {courses.length} courses · {creditLabel(settings)} credit hours</p>
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search courses"
            placeholder="Find a course…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="course-grid">
        {visible.map((c, i) => {
          const syllabus = topics.filter((t) => t.courseId === c.id),
            done = syllabus.filter((t) => t.done).length;
          const stats = attendanceStats(
            records.filter(
              (r) =>
                sourceSessions.find((s) => s.id === r.sessionId)?.courseId ===
                c.id,
            ),
          );
          return (
            <button
              key={c.id}
              className="course-card panel"
              style={{ "--course": c.color } as CSSProperties}
              onClick={() => navigate(`courses/${c.id}`)}
            >
              <div className="course-card-top">
                <CourseTag id={c.id} />
                <ArrowUpRight size={19} />
              </div>
              <span className="course-number" aria-hidden="true">
                0{i + 1}
              </span>
              <h2>{c.name}</h2>
              <div className="course-meta">
                <span>{c.credits === null ? "Credits not supplied" : `${c.credits} credit hours`}</span>
                <span>
                  {sourceSessions.filter((s) => s.courseId === c.id).length}{" "}
                  weekly sessions
                </span>
              </div>
              <div className="course-card-progress">
                <div>
                  <span>Syllabus progress</span>
                  <strong>
                    {syllabus.length
                      ? `${Math.round((done / syllabus.length) * 100)}%`
                      : "Not started"}
                  </strong>
                </div>
                <ProgressBar
                  value={syllabus.length ? (done / syllabus.length) * 100 : 0}
                  label={`${c.name} topic completion`}
                  color={c.color}
                />
                <div>
                  <small>
                    {done} / {syllabus.length} topics completed
                  </small>
                  <small>
                    {stats.percentage === null
                      ? "No attendance yet"
                      : `${stats.percentage}% attendance`}
                  </small>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!visible.length && (
        <Empty title="No matching courses">
          Search for a course name, code, or prerequisite.
        </Empty>
      )}
      <p className="source-footnote">
        <BookOpen size={14} />
        Official course names and prerequisites from the supplied material plan.
        Topic lists are yours to add.
      </p>
    </>
  );
}
export function CourseDetail({ id }: { id: string }) {
  const { courses, courseById, sourceSessions } = useApp();
  const {
    settings,
    now,
    attendance,
    topics,
    notes,
    items,
    study,
    act,
    navigate,
  } = useApp();
  const c = courseById(id);
  const [tab, setTab] = useState("overview"),
    [topic, setTopic] = useState(""),
    [editingNote, setEditingNote] = useState<Note | null | undefined>(
      undefined,
    ),
    [addingItem, setAddingItem] = useState<PlannerItem | null | undefined>(
      undefined,
    ),
    [session, setSession] = useState<{ session: Session; date: string } | null>(
      null,
    );
  if (!courses.some(course => course.id === id))
    return (
      <Empty
        title="Course not found"
        action={
          <button className="button" onClick={() => navigate("courses")}>
            All courses
          </button>
        }
      >
        Choose a course from your current semester.
      </Empty>
    );
  const syllabus = topics.filter((t) => t.courseId === id),
    done = syllabus.filter((t) => t.done).length,
    records = effectiveRecords(attendance, settings, now)
      .filter(
        (r) =>
          sourceSessions.find((s) => s.id === r.sessionId)?.courseId === id,
      )
      .sort((a, b) => b.date.localeCompare(a.date)),
    stats = attendanceStats(records),
    courseNotes = notes
      .filter((n) => n.courseId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    courseItems = items
      .filter((t) => t.courseId === id)
      .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const studyMinutes = Math.round(
    study.filter((x) => x.courseId === id).reduce((n, x) => n + x.seconds, 0) /
      60,
  );
  return (
    <div style={{ "--course": c.color } as CSSProperties}>
      <button
        className="text-link back-link"
        onClick={() => navigate("courses")}
      >
        <ArrowLeft size={15} />
        All courses
      </button>
      <div className="course-detail-heading">
        <CourseTag id={id} />
        <h1>{c.name}</h1>
        <p>{c.credits ?? "Credits not supplied"}{c.credits !== null && " credit hours"} <span className="separator">/</span> {academicLabel(settings)}</p>
      </div>
      <div className="detail-stats">
        <div>
          <span>ATTENDANCE</span>
          <strong>
            {stats.percentage === null ? "—" : stats.percentage + "%"}
          </strong>
          <small>
            {stats.attended} attended / {stats.attended + stats.missed} counted
          </small>
        </div>
        <div>
          <span>TOPICS COMPLETE</span>
          <strong>
            {done}
            <small> / {syllabus.length}</small>
          </strong>
          <small>Separate from attendance</small>
        </div>
        <div>
          <span>STUDY TIME</span>
          <strong>
            {studyMinutes}
            <small> min</small>
          </strong>
          <small>From saved focus sessions</small>
        </div>
        <div>
          <span>LATE MINUTES</span>
          <strong>{stats.lateMinutes}</strong>
          <small>{stats.late} late arrivals</small>
        </div>
      </div>
      <div className="tabs" aria-label="Course sections">
        {[
          ["overview", "Overview"],
          ["topics", "Syllabus"],
          ["notes", "Notes"],
          ["plans", "Tasks & exams"],
          ["history", "Attendance"],
        ].map(([key, label]) => (
          <button
            className={tab === key ? "active" : ""}
            aria-pressed={tab === key}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
            {key === "notes" && courseNotes.length > 0 && (
              <span>{courseNotes.length}</span>
            )}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="detail-grid">
          <section className="panel">
            <SectionHead title="Your weekly sessions" />
            {sessionsFor(settings)
              .filter((s) => s.courseId === id)
              .map((s) => (
                <button
                  className="detail-session"
                  key={s.id}
                  onClick={() =>
                    setSession({
                      session: s,
                      date: addDays(weekStart(localDate(now)), s.day),
                    })
                  }
                >
                  <span className="session-day">{days[s.day].slice(0, 3)}</span>
                  <div>
                    <strong>{category(s.type)}</strong>
                    <span>
                      <Clock size={13} />
                      {formatTime(s.start)} – {formatTime(s.end)}
                      {!s.timeConfirmed && " · assumed"}
                    </span>
                  </div>
                  <span className="room-line">
                    <MapPin size={13} />
                    {s.room || "Room not supplied"}
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            <div className="course-source-note">
              Original session types:{" "}
              {sessionsFor(settings)
                .filter((s) => s.courseId === id)
                .map((s) => s.type)
                .join(", ")}
              . Labs and tutorials share one visible category.
            </div>
          </section>
          <section className="panel">
            <SectionHead title="Academic details" />
            <dl className="academic-details">
              <div>
                <dt>Official code</dt>
                <dd>{c.id}</dd>
              </div>
              <div>
                <dt>Credit hours</dt>
                <dd>{c.credits ?? "Not supplied"}</dd>
              </div>
              <div>
                <dt>Prerequisite</dt>
                <dd>
                  {c.prerequisite ? (
                    <>
                      {c.prerequisite.code}
                      <br />
                      <span>{c.prerequisite.name}</span>
                    </>
                  ) : (
                    c.prerequisiteKnown ? "None (material plan)" : "Not supplied"
                  )}
                </dd>
              </div>
              <div>
                <dt>Plan contact hours / week</dt>
                <dd>
                  {c.hours ? `${c.hours.lecture} lecture · ${c.hours.lab} lab · ${c.hours.tutorial} tutorial` : "Not supplied"}
                </dd>
              </div>
            </dl>
            <p className="fine-print">
              Contact hours come from the material plan. Scheduled session types
              and rooms come from the timetable; differences are retained.
            </p>
          </section>
          <section className="panel">
            <SectionHead
              title="Syllabus progress"
              action={
                <button className="text-link" onClick={() => setTab("topics")}>
                  Manage topics
                  <ArrowUpRight size={15} />
                </button>
              }
            />
            <ProgressBar
              value={syllabus.length ? (done / syllabus.length) * 100 : 0}
              label="Course topics completed"
              color={c.color}
            />
            <p className="subtle">
              {syllabus.length
                ? `${done} of ${syllabus.length} topics completed`
                : "Add topics from your syllabus to track what you’ve learned."}
            </p>
          </section>
          <section className="panel">
            <SectionHead
              title="Next on your list"
              action={
                <AddButton onClick={() => setAddingItem(null)}>Add</AddButton>
              }
            />
            {courseItems
              .filter((x) => !x.done)
              .slice(0, 3)
              .map((item) => (
                <button
                  className="simple-list-item"
                  key={item.id}
                  onClick={() => setAddingItem(item)}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.kind} ·{" "}
                      {item.due ? formatDate(item.due) : "No due date"}
                    </span>
                  </div>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            {!courseItems.some((x) => !x.done) && (
              <p className="subtle">No open tasks or announced exams.</p>
            )}
          </section>
        </div>
      )}
      {tab === "topics" && (
        <section className="panel">
          <SectionHead title="What you’re learning" />
          <p className="subtle">
            Enter your own syllabus topics. Checking one off updates learning
            progress, without affecting attendance.
          </p>
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!topic.trim()) return;
              if (
                await act(
                  saveTopic({
                    id: uid(),
                    courseId: id,
                    title: topic.trim(),
                    done: false,
                    updatedAt: timestamp(),
                  }),
                  "Topic added",
                )
              )
                setTopic("");
            }}
          >
            <input
              aria-label="New syllabus topic"
              required
              maxLength={200}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Add a topic from your syllabus…"
            />
            <button className="button">
              <Plus size={16} />
              Add topic
            </button>
          </form>
          {syllabus.length ? (
            <div className="checklist">
              {syllabus.map((t) => (
                <div className="checklist-row" key={t.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={(e) =>
                        act(
                          saveTopic({
                            ...t,
                            done: e.target.checked,
                            updatedAt: timestamp(),
                          }),
                        )
                      }
                    />
                    <span className={t.done ? "completed-text" : ""}>
                      {t.title}
                    </span>
                  </label>
                  <button
                    className="icon-button"
                    aria-label={`Delete topic ${t.title}`}
                    onClick={() => act(db.topics.delete(t.id), "Topic removed")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<BookOpen size={26} />}
              title="Your syllabus starts here"
            >
              Add topics exactly as your lecturer provides them.
            </Empty>
          )}
        </section>
      )}
      {tab === "notes" && (
        <section className="panel">
          <SectionHead
            title="Things to remember"
            action={
              <AddButton onClick={() => setEditingNote(null)}>
                New note
              </AddButton>
            }
          />
          {courseNotes.length ? (
            <div className="notes-grid">
              {courseNotes.map((n) => (
                <article className="note-card" key={n.id}>
                  <div>
                    <FileText size={16} />
                    <span>{formatDate(localDate(new Date(n.updatedAt)))}</span>
                    <button
                      className="icon-button"
                      aria-label="Edit note"
                      onClick={() => setEditingNote(n)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <p>{n.text}</p>
                  {n.sessionId && (
                    <span className="fine-print">
                      Session: {n.date ? formatDate(n.date) : ""}
                    </span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty icon={<FileText size={25} />} title="A home for your notes">
              Save concepts, questions, and ideas you want to revisit.
            </Empty>
          )}{" "}
          {records.filter((r) => r.note).length > 0 && (
            <>
              <h3 className="subsection-title">From session check-ins</h3>
              {records
                .filter((r) => r.note)
                .map((r) => (
                  <article className="session-note" key={r.id}>
                    <span>
                      {formatDate(r.date)} ·{" "}
                      {category(
                        sourceSessions.find((s) => s.id === r.sessionId)!.type,
                      )}
                    </span>
                    <p>{r.note}</p>
                  </article>
                ))}
            </>
          )}
        </section>
      )}
      {tab === "plans" && (
        <section className="panel">
          <SectionHead
            title="Tasks, assignments & exams"
            action={
              <AddButton onClick={() => setAddingItem(null)}>
                New plan
              </AddButton>
            }
          />
          {courseItems.length ? (
            courseItems.map((item) => (
              <div className="planner-row" key={item.id}>
                <button
                  className={`check-button ${item.done ? "checked" : ""}`}
                  aria-label={
                    item.done
                      ? `Reopen ${item.title}`
                      : `Complete ${item.title}`
                  }
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
                  onClick={() => setAddingItem(item)}
                >
                  <span className={`item-kind ${item.kind}`}>{item.kind}</span>
                  <strong className={item.done ? "completed-text" : ""}>
                    {item.title}
                  </strong>
                  <span>{item.due ? formatDate(item.due) : "No date"}</span>
                  <ArrowUpRight size={15} />
                </button>
              </div>
            ))
          ) : (
            <Empty title="A clean slate">
              Add announced assignments and exams when you’re ready.
            </Empty>
          )}
        </section>
      )}
      {tab === "history" && (
        <section className="panel">
          <SectionHead title="Your attendance story" />
          {records.length ? (
            records.map((r) => {
              const s = sessionsFor(settings).find(
                (s) => s.id === r.sessionId,
              )!;
              return (
                <button
                  className="history-row"
                  key={r.id}
                  onClick={() => setSession({ session: s, date: r.date })}
                >
                  <span>
                    {formatDate(r.date, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <div>
                    <strong>{category(s.type)}</strong>
                    <span>
                      {r.arrival
                        ? `Arrived ${formatTime(r.arrival)}`
                        : "No arrival time"}{" "}
                      · {s.room || "Room not supplied"}
                    </span>
                  </div>
                  <Status status={r.status} minutes={r.lateMinutes} />
                  <ArrowUpRight size={15} />
                </button>
              );
            })
          ) : (
            <Empty title="No check-ins yet">
              Record attendance from Today or any session in Schedule.
            </Empty>
          )}
          <p className="fine-print">
            Attendance: attended ÷ (attended + missed). Excused and unrecorded
            sessions are excluded. {records.filter(present).length} completed
            sessions recorded.
          </p>
        </section>
      )}
      {editingNote !== undefined && (
        <NoteDialog
          courseId={id}
          note={editingNote ?? undefined}
          onClose={() => setEditingNote(undefined)}
        />
      )}{" "}
      {addingItem !== undefined && (
        <PlannerDialog
          courseId={id}
          item={addingItem ?? undefined}
          onClose={() => setAddingItem(undefined)}
        />
      )}{" "}
      {session && (
        <AttendanceDialog
          key={`${session.session.id}:${session.date}`}
          {...session}
          onClose={() => setSession(null)}
        />
      )}
    </div>
  );
}
function NoteDialog({
  courseId,
  note,
  onClose,
}: {
  courseId: string;
  note?: Note;
  onClose: () => void;
}) {
  const { courseById } = useApp();
  const { act } = useApp();
  const [text, setText] = useState(note?.text ?? ""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={note ? "Edit note" : "New course note"}
      description={courseById(courseId).name}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          const ok = await act(
            saveNote({
              id: note?.id ?? uid(),
              courseId,
              sessionId: note?.sessionId ?? null,
              date: note?.date ?? null,
              text: text.trim(),
              updatedAt: timestamp(),
            }),
            "Note saved",
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <label>
          Your note
          <textarea
            autoFocus
            required
            rows={10}
            maxLength={10000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Capture a thought…"
          />
        </label>
        <div className="dialog-actions">
          {note && (
            <button
              type="button"
              className="button danger secondary"
              onClick={async () => {
                if (await act(db.notes.delete(note.id), "Note removed"))
                  onClose();
              }}
            >
              Delete note
            </button>
          )}
          <button disabled={busy} className="button">
            <Save size={16} />
            Save note
          </button>
        </div>
      </form>
    </Modal>
  );
}
