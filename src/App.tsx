import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { surfaceMotionOrigin, useSystemReducedMotion } from "./lib/motion";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Command as CommandIcon,
  Download,
  HelpCircle,
  LayoutDashboard,
  MapPin,
  Search,
  Settings,
  Sparkles,
  Sun,
  WifiOff,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { days, category, type Session } from "./data/academic";
import { useApp } from "./lib/context";
import {
  addDays,
  formatTime,
  localDate,
  nextSession,
  sessionWindow,
  sessionsFor,
  weekStart,
} from "./lib/scheduling";
import { Background } from "./components/Background";
import { Modal } from "./components/ui";
import { AttendanceDialog } from "./components/AttendanceDialog";
import { Today } from "./pages/Today";
import { Schedule } from "./pages/Schedule";
import { Courses, CourseDetail } from "./pages/Courses";
import { Progress } from "./pages/Progress";
import { Planner } from "./pages/Planner";
import { SettingsPage } from "./pages/Settings";
import { getThemeDefinition, themePaused, themeTokenNames, themeTokens } from "./themes/definitions";
import { getThemeMotion, motionTokenNames, themeMotionTokens } from "./themes/motion";
import { academicLabel } from "./lib/academic";
import { Welcome } from "./pages/Welcome";
import { LegalLinks } from "./pages/Legal";
const navigation = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "planner", label: "Planner", icon: CheckCircle2 },
];
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function App() {
  const { courses, courseById } = useApp();
  const { settings, view, navigate, now, toast } = useApp();
  const reduced = useSystemReducedMotion();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [palette, setPalette] = useState(false),
    [help, setHelp] = useState(false),
    [installHelp, setInstallHelp] = useState(false),
    [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null),
    [online, setOnline] = useState(navigator.onLine),
    [room, setRoom] = useState(""),
    [active, setActive] = useState<{
      session: Session;
      date: string;
      initialMode?: "auto" | "attended" | "late";
    } | null>(null);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registered) => setRegistration(registered ?? null),
    onRegisterError: () =>
      toast(
        "Offline setup could not finish. Reconnect and reload to try again.",
      ),
  });
  const section = view.split("/")[0];
  const theme = useMemo(() => getThemeDefinition(settings.theme, settings.customTheme), [settings.theme, settings.customTheme]);
  const noMotion = settings.reduceMotion || reduced;
  useEffect(() => {
    if (!settings.onboardingComplete && section !== "setup") navigate("setup");
  }, [settings.onboardingComplete, section, navigate]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const course = courses.find((c) => c.id === view.split("/")[1]);
    document.title = `${course?.name ?? section.charAt(0).toUpperCase() + section.slice(1)} · Semester OS`;
  }, [view, section]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.themeLight = String(theme.palette.light);
    document.documentElement.dataset.typography = theme.typography.treatment;
    const uiMotion = getThemeMotion(settings.theme, noMotion, settings.customTheme.environment);
    document.documentElement.dataset.motionStyle = uiMotion.identity;
    const uiTokens = themeMotionTokens(uiMotion) as Record<string, string | number>;
    for (const name of motionTokenNames) document.documentElement.style.setProperty(name, String(uiTokens[name]));
    const tokens = themeTokens(theme, settings.atmosphere);
    for (const name of themeTokenNames) {
      const value = (tokens as Record<string, string>)[name];
      if (value) document.documentElement.style.setProperty(name, value);
      else document.documentElement.style.removeProperty(name);
    }
    document.documentElement.dataset.reduceMotion = String(!!noMotion);
    document.documentElement.dataset.ambientPaused = String(
      themePaused(settings, reduced, true),
    );
    document.documentElement.style.setProperty(
      "--prism-speed",
      `${75 - settings.motion * 0.5}s`,
    );
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        theme.palette.background,
      );
  }, [settings.theme, settings.customTheme, settings.atmosphere, settings.motion, settings.wallpaperPaused, noMotion, theme]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const routes: Record<string, string> = {
          "1": "today",
          "2": "schedule",
          "3": "courses",
          "4": "progress",
          "5": "planner",
          "6": "settings",
        };
        if (routes[e.key]) {
          e.preventDefault();
          navigate(routes[e.key]);
        }
      }
    };
    const before = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e as InstallEvent);
      },
      status = () => setOnline(navigator.onLine),
      installed = () => {
        setInstallPrompt(null);
        toast("Semester OS installed");
      };
    addEventListener("keydown", key);
    addEventListener("beforeinstallprompt", before);
    addEventListener("online", status);
    addEventListener("offline", status);
    addEventListener("appinstalled", installed);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("beforeinstallprompt", before);
      removeEventListener("online", status);
      removeEventListener("offline", status);
      removeEventListener("appinstalled", installed);
    };
  }, [navigate, toast]);
  useEffect(() => {
    if (offlineReady) toast("Semester OS is ready for offline use.");
  }, [offlineReady, toast]);
  useEffect(() => {
    if (!registration) return;
    let lastCheck = 0;
    const checkForUpdate = () => {
      if (document.hidden || !navigator.onLine || Date.now() - lastCheck < 5 * 60 * 1000) return;
      lastCheck = Date.now();
      void registration.update().catch(() => {});
    };
    checkForUpdate();
    const interval = window.setInterval(checkForUpdate, 60 * 60 * 1000);
    document.addEventListener("visibilitychange", checkForUpdate);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", checkForUpdate); };
  }, [registration]);
  const install = async () => {
    if (!installPrompt) {
      setInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setInstallPrompt(null);
  };
  const quick = (mode: "auto" | "attended" | "late") => {
    const next =
      mode === "auto"
        ? sessionWindow(now, settings).next
        : nextSession(now, settings);
    if (!next) {
      toast("No upcoming class in your configured semester.");
      return;
    }
    setActive({ ...next, initialMode: mode });
    setPalette(false);
  };
  const rooms = Array.from(
    new Set(sessionsFor(settings).map((s) => s.room).filter(Boolean)),
  ).sort();
  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <Background />
      <div className="app-shell" onPointerOver={surfaceMotionOrigin}>
        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => navigate("today")}
            aria-label="Semester OS home"
          >
            <img src="/icon.svg" alt="" />
            <span>
              semester<span className="brand-os">os</span>
              <small>YOUR PERSONAL OPERATING SPACE</small>
            </span>
          </button>
          <button className="sidebar-search" onClick={() => setPalette(true)}>
            <Search size={16} />
            <span>Find anything</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${section === id ? "active" : ""}`}
                aria-current={section === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {section === id && <i />}
              </button>
            ))}
          </nav>
          <div className="sidebar-course-label">
            <span>THIS SEMESTER</span>
            <span>{String(courses.length).padStart(2, "0")}</span>
          </div>
          <div className="sidebar-courses">
            {courses.map((c) => (
              <button key={c.id} onClick={() => navigate(`courses/${c.id}`)}>
                <i style={{ background: c.color }} />
                <span>{c.shortName}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button
              className="theme-shortcut"
              onClick={() => navigate("settings")}
            >
              <Sparkles size={16} />
              <span>
                {theme.name} mode<small>Your space, your atmosphere</small>
              </span>
              <ChevronRight size={14} />
            </button>
            <button className="nav-item" onClick={install}>
              <Download size={17} />
              <span>
                {installPrompt ? "Install Semester OS" : "Install options"}
              </span>
            </button>
            <button
              className={`nav-item ${section === "settings" ? "active" : ""}`}
              aria-current={section === "settings" ? "page" : undefined}
              onClick={() => navigate("settings")}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
            <button
              className="user-profile"
              onClick={() => navigate("settings")}
            >
              <span className="avatar">
                {settings.name.slice(0, 1).toUpperCase() || "S"}
              </span>
              <span>
                <strong>{settings.name || "Your workspace"}</strong>
                <small>{[settings.semester?.level?.label, settings.semester?.program?.name].filter(Boolean).join(" · ") || "Set up your semester"}</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              WORKSPACE <ChevronRight size={12} />
              <span>
                {section === "courses" && view.includes("/")
                  ? "Course workspace"
                  : section.charAt(0).toUpperCase() + section.slice(1)}
              </span>
            </div>
            <div className="topbar-right">
              {!online && (
                <span className="offline-status">
                  <WifiOff size={13} />
                  Offline
                </span>
              )}
              <span className="local-clock">
                <span className="tiny-dot live" />
                {now.toLocaleTimeString("en", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
                <small>
                  {Intl.DateTimeFormat()
                    .resolvedOptions()
                    .timeZone.split("/")
                    .pop()
                    ?.replaceAll("_", " ")}
                </small>
              </span>
              <button
                className="icon-button"
                aria-label="Keyboard shortcuts"
                onClick={() => setHelp(true)}
              >
                <HelpCircle size={18} />
              </button>
              <button
                className="icon-button mobile-search"
                aria-label="Open command palette"
                onClick={() => setPalette(true)}
              >
                <Search size={20} />
              </button>
            </div>
          </header>
          {needRefresh && (
            <div className="update-banner">
              An update is ready. Save your edits, then refresh.
              <button
                className="button small"
                onClick={() => updateServiceWorker(true)}
              >
                Update app
              </button>
            </div>
          )}
          <main id="main-content" tabIndex={-1}>
{settings.semester?.origin === "demo" && <div className="demo-banner"><span>DEMO SEMESTER · Sample academic data</span><button className="text-link" onClick={() => navigate("setup")}>Create your semester <ArrowUpRight size={14} /></button></div>}
            {/* Publish the selected route immediately; cancelled exit animations
                must not hold navigation after rapid changes or motion toggles. */}
              <div
                className="page"
                key={view}
              >
                {/* The route is visible and interactive from its first frame.
                    A new route/theme replaces this decorative layer immediately. */}
                {!noMotion && <span className="page-transition" key={`${view}:${settings.theme}`} aria-hidden="true" />}
                {!settings.onboardingComplete || section === "setup" ? (<Welcome />) : section === "today" ? (
                  <Today />
                ) : section === "schedule" ? (
                  <Schedule />
                ) : section === "courses" ? (
                  view.includes("/") ? (
                    <CourseDetail key={view} id={view.split("/")[1]} />
                  ) : (
                    <Courses />
                  )
                ) : section === "progress" ? (
                  <Progress />
                ) : section === "planner" ? (
                  <Planner />
                ) : section === "settings" ? (
                  <SettingsPage />
                ) : (
                  <Today />
                )}
              </div>
            <footer className="workspace-footer">
              <LegalLinks />
              <span>
                SEMESTER OS <i /> {academicLabel(settings).toUpperCase()}
              </span>
              <button onClick={() => setHelp(true)}>
                YOUR SPACE. YOUR PACE. <CommandIcon size={12} />
              </button>
            </footer>
          </main>
        </div>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            aria-current={section === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button
          className={section === "settings" ? "active" : ""}
          onClick={() => navigate("settings")}
          aria-current={section === "settings" ? "page" : undefined}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </nav>
      <Modal
        open={palette}
        onClose={() => setPalette(false)}
        title="Find your next move"
        wide
      >
        <Command label="Semester OS command palette" className="command-menu">
          <div className="command-search">
            <Search size={19} />
            <Command.Input
              placeholder="Search courses, rooms, or actions…"
              autoFocus
            />
          </div>
          <Command.List>
            <Command.Empty>
              No matching command. Try a course code or room.
            </Command.Empty>
            <Command.Group heading="Go to">
              {[
                ...navigation,
                { id: "settings", label: "Settings", icon: Settings },
              ].map(({ id, label, icon: Icon }) => (
                <Command.Item
                  key={id}
                  value={`${label} page`}
                  onSelect={() => {
                    navigate(id);
                    setPalette(false);
                  }}
                >
                  <Icon size={17} />
                  {label}
                  <span className="command-hint">Open</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Quick actions">
              <Command.Item
                value="check in attendance mark attended"
                onSelect={() => quick("attended")}
              >
                <CheckCircle2 size={17} />
                Mark attended / correct arrival
              </Command.Item>
              <Command.Item
                value="mark late arrival lateness"
                onSelect={() => quick("late")}
              >
                <Clock size={17} />
                Record a late arrival
              </Command.Item>
              <Command.Item
                value="next class current class show session"
                onSelect={() => quick("auto")}
              >
                <Sun size={17} />
                Show next class
              </Command.Item>
              <Command.Item
                value="planner assignments exams deadlines calendar"
                onSelect={() => {
                  navigate("planner");
                  setPalette(false);
                }}
              >
                <CalendarDays size={17} />
                Open semester planner
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Courses">
              {courses.map((c) => (
                <Command.Item
                  key={c.id}
                  value={`${c.code} ${c.name} open course`}
                  onSelect={() => {
                    navigate(`courses/${c.id}`);
                    setPalette(false);
                  }}
                >
                  <span
                    className="command-course-dot"
                    style={{ background: c.color }}
                  />
                  {c.name}
                  <span className="command-hint">{c.code}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Rooms">
              {rooms.map((r) => (
                <Command.Item
                  key={r}
                  value={`room ${r}`}
                  onSelect={() => {
                    setRoom(r);
                    setPalette(false);
                  }}
                >
                  <MapPin size={17} />
                  {r}
                  <span className="command-hint">Find sessions</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
          <div className="command-footer">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> navigate
            </span>
            <span>
              <kbd>↵</kbd> select
            </span>
            <span>
              <kbd>esc</kbd> close
            </span>
          </div>
        </Command>
      </Modal>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="A few useful shortcuts"
        description="Move around your semester without leaving the keyboard."
      >
        <div className="shortcut-list">
          <div>
            <span>Search & quick actions</span>
            <kbd>Ctrl / ⌘ + K</kbd>
          </div>
          {[...navigation, { id: "settings", label: "Settings" }].map(
            (n, i) => (
              <div key={n.id}>
                <span>Open {n.label}</span>
                <kbd>Alt + {i + 1}</kbd>
              </div>
            ),
          )}
          <div>
            <span>Show this panel</span>
            <kbd>?</kbd>
          </div>
          <div>
            <span>Close dialogs</span>
            <kbd>Esc</kbd>
          </div>
        </div>
        <button
          className="button secondary full"
          onClick={() => {
            setHelp(false);
            navigate("planner");
          }}
        >
          Open planner
          <CalendarDays size={16} />
        </button>
      </Modal>
      <Modal
        open={installHelp}
        onClose={() => setInstallHelp(false)}
        title="Keep Semester OS close"
        description="Install from a supported browser for a dedicated app window."
      >
        <div className="installation-help">
          <p>
            Chrome or Edge: use the browser menu → Install Semester OS or
            Install this page as an app.
          </p>
          <p>Safari on iPhone / iPad: Share → Add to Home Screen.</p>
          <p>
            The production app supports offline use after its first load.
            Installation requires HTTPS or localhost.
          </p>
        </div>
        <button className="button full" onClick={() => setInstallHelp(false)}>
          Got it
        </button>
      </Modal>
      <Modal
        open={!!room}
        onClose={() => setRoom("")}
        title={`Room ${room}`}
        description="Sessions using this room in your supplied timetable."
      >
        {sessionsFor(settings)
          .filter((s) => s.room === room)
          .map((s) => (
            <button
              className="detail-session"
              key={s.id}
              onClick={() => {
                setActive({
                  session: s,
                  date: addDays(weekStart(localDate(now)), s.day),
                });
                setRoom("");
              }}
            >
              <MapPin size={17} />
              <div>
                <strong>{courseById(s.courseId).shortName}</strong>
                <span>
                  {days[s.day]} · {formatTime(s.start)} · {category(s.type)}
                </span>
              </div>
              <ArrowUpRight size={15} />
            </button>
          ))}
      </Modal>
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
