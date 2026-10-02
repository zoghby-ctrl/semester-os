import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, initialize, validateWorkspace } from "./db";
import { StorageRecovery } from "../components/StorageRecovery";
import type {
  Attendance,
  Note,
  PlannerItem,
  Settings,
  Study,
  Timer,
  Topic,
} from "./schema";
import type { Wallpaper } from "./db";
import { coursesFor, findCourse } from "./academic";
import { sessionsFor } from "./scheduling";
import type { Course, Session } from "../data/academic";
interface Data {
  courses: Course[];
  sourceSessions: Session[];
  courseById: (id: string) => Course;
  settings: Settings;
  attendance: Attendance[];
  topics: Topic[];
  items: PlannerItem[];
  notes: Note[];
  study: Study[];
  wallpaper?: Wallpaper;
  timer?: Timer;
  now: Date;
  toast: (message: string) => void;
  act: (operation: Promise<unknown>, message?: string) => Promise<boolean>;
  navigate: (view: string) => void;
  view: string;
}
const Context = createContext<Data | null>(null);
export const useApp = () => {
  const value = useContext(Context);
  if (!value) throw new Error("Missing Semester OS context");
  return value;
};
export function Provider({ children }: { children: ReactNode }) {
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [now, setNow] = useState(new Date()),
    [message, setMessage] = useState(""),
    [view, setView] = useState(location.hash.slice(1) || "today");
  useEffect(() => {
    initialize()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
    const tick = setInterval(() => setNow(new Date()), 1000);
    const hash = () => setView(location.hash.slice(1) || "today");
    addEventListener("hashchange", hash);
    return () => {
      clearInterval(tick);
      removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(t);
  }, [message]);
  const data = useLiveQuery(async () => {
    if (!ready) return undefined;
    return db.transaction("r", db.tables, async () => {
      const [
        settings,
        attendance,
        topics,
        items,
        notes,
        study,
        wallpaper,
        timer,
      ] = await Promise.all([
        db.settings.get("main"),
        db.attendance.toArray(),
        db.topics.toArray(),
        db.items.toArray(),
        db.notes.toArray(),
        db.study.toArray(),
        db.wallpaper.get("main"),
        db.timer.get("active"),
      ]);
      if (!settings) throw new Error("Settings could not be loaded");
      return validateWorkspace({
        settings,
        attendance,
        topics,
        items,
        notes,
        study,
        wallpaper,
        timer,
      });
    }).catch(() => ({ invalid: true as const }));
  }, [ready]);
  const toast = useCallback((msg: string) => setMessage(msg), []);
  const act = useCallback(
    async (operation: Promise<unknown>, msg?: string) => {
      try {
        await operation;
        if (msg) toast(msg);
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not save changes");
        return false;
      }
    },
    [toast],
  );
  const navigate = useCallback((target: string) => {
    location.hash = target;
  }, []);
  if (error || data && "invalid" in data) return <StorageRecovery />;
  if (!data)
    return (
      <div className="boot">
        <div className="brand-mark">△</div>
        <h1>Opening your space</h1>
        <p>Loading your semester from this device.</p>
      </div>
    );
  return (
    <Context.Provider value={{ ...data, courses: coursesFor(data.settings), sourceSessions: sessionsFor(data.settings), courseById: (id) => findCourse(data.settings, id), now, toast, act, navigate, view }}>
      {children}
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </Context.Provider>
  );
}
