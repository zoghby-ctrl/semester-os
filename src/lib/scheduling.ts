import { category, type Session } from "../data/academic";
import type { Attendance, Settings } from "./schema";
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const localTime = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const minutes = (s: string) =>
  Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export const at = (date: string, time: string) =>
  new Date(`${date}T${time}:00`);
export const dateFrom = (date: string) => new Date(date + "T12:00:00");
export const addDays = (date: string, n: number) => {
  const d = dateFrom(date);
  d.setDate(d.getDate() + n);
  return localDate(d);
};
export const weekStart = (date: string) =>
  addDays(date, -dateFrom(date).getDay());
export const formatTime = (time: string) =>
  at("2000-01-01", time).toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });
export const formatDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) => dateFrom(date).toLocaleDateString("en", options);
export const sessionsFor = (settings: Settings) =>
  (settings.semester?.sessions ?? []).map((s) => ({
    ...s,
    ...settings.schedule.find((x) => x.id === s.id),
  }));
export const isActiveDate = (date: string, settings: Settings) =>
  (!settings.semesterStart || date >= settings.semesterStart) &&
  (!settings.semesterEnd || date <= settings.semesterEnd) &&
  !settings.excludedDates.includes(date);
export const sessionsOn = (date: string, settings: Settings) =>
  isActiveDate(date, settings)
    ? sessionsFor(settings)
        .filter((s) => s.day === dateFrom(date).getDay())
        .sort((a, b) => a.start.localeCompare(b.start))
    : [];
export const recordId = (sessionId: string, date: string) =>
  `${date}:${sessionId}`;
export function lateness(start: string, arrival: string, grace = 0) {
  const lateMinutes = Math.max(0, minutes(arrival) - minutes(start));
  return {
    lateMinutes,
    status: lateMinutes > grace ? ("late" as const) : ("on-time" as const),
  };
}
export function sessionStatus(
  session: Pick<Session, "start" | "end">,
  date: string,
  now: Date,
  settings: Settings,
  record?: Attendance,
) {
  if (record) return record.status;
  if (now < at(date, session.start)) return "upcoming";
  if (now < at(date, session.end)) return "in-progress";
  if (
    settings.autoMissed &&
    settings.trackingSince &&
    date >= settings.trackingSince
  )
    return "missed";
  return "unrecorded";
}
export const statusLabel = (status: string) =>
  ({
    "on-time": "On time",
    late: "Late",
    attended: "Attended",
    missed: "Missed",
    excused: "Excused",
    upcoming: "Upcoming",
    "in-progress": "In progress",
    unrecorded: "Unrecorded",
  })[status] ?? status;
export const present = (r: { status: string }) =>
  ["on-time", "late", "attended"].includes(r.status);
export function nextSession(now: Date, settings: Settings) {
  let date = localDate(now);
  if (settings.semesterStart && date < settings.semesterStart)
    date = settings.semesterStart;
  for (let i = 0; i < 370; i++) {
    const day = addDays(date, i);
    if (settings.semesterEnd && day > settings.semesterEnd) return null;
    const s = sessionsOn(day, settings).find((s) => at(day, s.end) > now);
    if (s) return { session: s, date: day };
  }
  return null;
}
export function sessionWindow(now: Date, settings: Settings) {
  const date=localDate(now);
  const currents=sessionsOn(date,settings).filter(s=>at(date,s.start)<=now&&at(date,s.end)>now).map(session=>({session,date}));
  let next: {session:Session;date:string}|null=null;
  const from=settings.semesterStart&&date<settings.semesterStart?settings.semesterStart:date;
  if(settings.semester?.sessions.length) for(let i=0;i<370;i++) {
    const day=addDays(from,i);if(settings.semesterEnd&&day>settings.semesterEnd) break;
    const session=sessionsOn(day,settings).find(s=>at(day,s.start)>now);
    if(session){next={session,date:day};break;}
  }
  return { current:currents[0]??null,currents,next };
}
export const roomLabel=(room:string)=>room.trim()||"Room not supplied";

// Assign columns inside each connected overlap group. Consecutive classes
// regain the full column width, and all concurrent classes stay selectable.
export function timetableLanes(sessions:Pick<Session,"id"|"day"|"start"|"end">[]) {
  const placements=new Map<string,{column:number;columns:number}>();
  for(let day=0;day<7;day++) {
    let group:typeof sessions=[];let end="";
    const flush=()=>{
      const laneEnds:string[]=[];
      for(const s of group){let column=laneEnds.findIndex(time=>time<=s.start);if(column<0)column=laneEnds.length;laneEnds[column]=s.end;placements.set(s.id,{column,columns:0});}
      for(const s of group) placements.get(s.id)!.columns=laneEnds.length;
      group=[];end="";
    };
    for(const s of sessions.filter(s=>s.day===day).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end))) {
      if(group.length&&s.start>=end) flush();group.push(s);if(s.end>end)end=s.end;
    }
    flush();
  }
  return placements;
}
export function semesterElapsed(settings:Settings,now:Date) {
  if(!settings.semesterStart||!settings.semesterEnd) return null;
  const utc=(date:string)=>Date.parse(date+"T00:00:00Z");
  const total=Math.round((utc(settings.semesterEnd)-utc(settings.semesterStart))/86400000)+1;
  const elapsed=Math.min(total,Math.max(0,Math.round((utc(localDate(now))-utc(settings.semesterStart))/86400000)));
  return {elapsed,total,percentage:Math.round(elapsed/total*100)};
}
export function countdown(target: Date, now: Date) {
  const mins = Math.max(0, Math.ceil((+target - +now) / 60000));
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
}
export function effectiveRecords(
  records: Attendance[],
  settings: Settings,
  now: Date,
): Attendance[] {
  if (!settings.autoMissed || !settings.trackingSince) return records;
  const from =
    settings.semesterStart && settings.semesterStart > settings.trackingSince
      ? settings.semesterStart
      : settings.trackingSince;
  const end = localDate(now);
  const known = new Set(records.map((r) => r.id));
  const out = [...records];
  for (let date = from; date <= end; date = addDays(date, 1))
    for (const s of sessionsOn(date, settings))
      if (at(date, s.end) <= now && !known.has(recordId(s.id, date)))
        out.push({
          id: recordId(s.id, date),
          sessionId: s.id,
          date,
          status: "missed",
          arrival: null,
          plannedStart: s.start,
          plannedEnd: s.end,
          lateMinutes: 0,
          override: false,
          note: "Automatically classified; no check-in recorded.",
          updatedAt: at(date, s.end).toISOString(),
        });
  return out;
}
export function attendanceStats(records: Attendance[]) {
  const attended = records.filter(present).length,
    missed = records.filter((r) => r.status === "missed").length,
    excused = records.filter((r) => r.status === "excused").length;
  return {
    attended,
    missed,
    excused,
    late: records.filter((r) => r.lateMinutes > 0 && present(r)).length,
    lateMinutes: records.filter(present).reduce((n, r) => n + r.lateMinutes, 0),
    percentage:
      attended + missed
        ? Math.round((100 * attended) / (attended + missed))
        : null,
    total: records.length,
  };
}
export const describeSession = (s: Session) =>
  `${category(s.type)} · ${s.room}`;
