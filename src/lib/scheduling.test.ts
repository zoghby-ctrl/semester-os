import { demoSettings } from "./legacy";
const defaultSettings = demoSettings();
import { describe, expect, it } from "vitest";
import { courses, sourceSessions } from "../data/legacy-academic";

import {
  addDays,
  attendanceStats,
  effectiveRecords,
  lateness,
  localDate,
  nextSession,
  recordId,
  sessionStatus,
  sessionWindow,
  sessionsOn,
  weekStart,
} from "./scheduling";
import type { Attendance } from "./schema";
const settings = structuredClone(defaultSettings);
const record = (
  status: Attendance["status"],
  sessionId = "sun-math",
): Attendance => ({
  id: recordId(sessionId, "2026-09-27"),
  sessionId,
  date: "2026-09-27",
  status,
  arrival: status === "late" ? "08:41" : "08:30",
  plannedStart: "08:30",
  plannedEnd: "10:30",
  lateMinutes: status === "late" ? 11 : 0,
  override: false,
  note: "",
  updatedAt: "2026-09-27T10:00:00Z",
});
describe("Academic source integrity", () => {
  it("keeps all six official codes, 17 credits and 11 sessions", () => {
    expect(courses.map((c) => c.id)).toEqual([
      "INF2101",
      "CSC2100",
      "CSC2104",
      "CSC2105",
      "HU2100",
      "BSC1301",
    ]);
    expect(courses.reduce((n, c) => n + c.credits, 0)).toBe(17);
    expect(sourceSessions).toHaveLength(11);
    expect(sourceSessions.every((s) => !s.timeConfirmed)).toBe(true);
  });
  it("retains original lab and tutorial types and rooms", () => {
    expect(
      sourceSessions.find((s) => s.id === "tue-system-tutorial"),
    ).toMatchObject({ type: "tutorial", room: "B411" });
    expect(sourceSessions.find((s) => s.id === "sun-data-lab")).toMatchObject({
      type: "lab",
      room: "A409",
    });
    expect(sourceSessions.find((s) => s.id === "tue-ai")?.room).toBe("A509");
  });
});
describe("Local calendar and scheduling", () => {
  it("does not shift local dates through UTC conversion", () => {
    expect(localDate(new Date(2026, 8, 27, 0, 5))).toBe("2026-09-27");
    expect(weekStart("2026-10-01")).toBe("2026-09-27");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });
  it("finds Sunday through Tuesday and no Wednesday classes", () => {
    expect(sessionsOn("2026-09-27", settings)).toHaveLength(4);
    expect(sessionsOn("2026-09-28", settings)).toHaveLength(4);
    expect(sessionsOn("2026-09-29", settings)).toHaveLength(3);
    expect(sessionsOn("2026-09-30", settings)).toHaveLength(0);
  });
  it("uses inclusive semester boundaries and excludes holidays", () => {
    const s = {
      ...settings,
      semesterStart: "2026-09-28",
      semesterEnd: "2026-09-29",
      excludedDates: ["2026-09-29"],
    };
    expect(sessionsOn("2026-09-27", s)).toHaveLength(0);
    expect(sessionsOn("2026-09-28", s)).toHaveLength(4);
    expect(sessionsOn("2026-09-29", s)).toHaveLength(0);
    expect(sessionsOn("2026-10-04", s)).toHaveLength(0);
  });
  it("finds current class and moves to next at exact end", () => {
    expect(
      nextSession(new Date("2026-09-27T10:29:59"), settings)?.session.id,
    ).toBe("sun-math");
    expect(
      nextSession(new Date("2026-09-27T10:30:00"), settings)?.session.id,
    ).toBe("sun-arch");
  });
  it("separates the current class from the following class and advances across campus days", () => {
    const duringClass = sessionWindow(
      new Date("2026-09-27T09:00:00"),
      settings,
    );
    expect(duringClass.current?.session.id).toBe("sun-math");
    expect(duringClass.next?.session.id).toBe("sun-arch");
    const lastClass = sessionWindow(new Date("2026-09-29T13:00:00"), settings);
    expect(lastClass.current?.session.id).toBe("tue-system");
    expect(lastClass.next?.date).toBe("2026-10-04");
    expect(
      sessionWindow(new Date("2026-09-27T08:00:00"), settings).current,
    ).toBeNull();
    expect(
      sessionWindow(new Date("2026-09-27T08:00:00"), settings).next?.session.id,
    ).toBe("sun-math");
  });
  it("finds next campus day over empty days and returns null after semester", () => {
    expect(nextSession(new Date("2026-10-01T12:00:00"), settings)?.date).toBe(
      "2026-10-04",
    );
    expect(
      nextSession(new Date("2026-10-01T12:00:00"), {
        ...settings,
        semesterEnd: "2026-09-29",
      }),
    ).toBeNull();
  });
  it("respects user time overrides", () => {
    const s = {
      ...settings,
      schedule: settings.schedule.map((x) =>
        x.id === "sun-math" ? { ...x, start: "09:00", timeConfirmed: true } : x,
      ),
    };
    expect(sessionsOn("2026-09-27", s)[0].start).toBe("09:00");
  });
});
describe("Attendance and lateness", () => {
  it("calculates actual minutes and grace independently", () => {
    expect(lateness("08:30", "08:41")).toEqual({
      status: "late",
      lateMinutes: 11,
    });
    expect(lateness("08:30", "08:35", 5)).toEqual({
      status: "on-time",
      lateMinutes: 5,
    });
    expect(lateness("08:30", "08:36", 5)).toEqual({
      status: "late",
      lateMinutes: 6,
    });
    expect(lateness("08:30", "08:10")).toEqual({
      status: "on-time",
      lateMinutes: 0,
    });
  });
  it("uses exact time boundaries and never assumes physical presence", () => {
    const session = sourceSessions[0];
    expect(
      sessionStatus(
        session,
        "2026-09-27",
        new Date("2026-09-27T08:29:59"),
        settings,
      ),
    ).toBe("upcoming");
    expect(
      sessionStatus(
        session,
        "2026-09-27",
        new Date("2026-09-27T08:30:00"),
        settings,
      ),
    ).toBe("in-progress");
    expect(
      sessionStatus(
        session,
        "2026-09-27",
        new Date("2026-09-27T10:30:00"),
        settings,
      ),
    ).toBe("unrecorded");
    expect(
      sessionStatus(
        session,
        "2026-09-27",
        new Date("2026-09-27T09:00:00"),
        settings,
        record("excused"),
      ),
    ).toBe("excused");
  });
  it("does not manufacture missed records by default", () => {
    expect(
      effectiveRecords([], settings, new Date("2026-09-30T12:00:00")),
    ).toEqual([]);
  });
  it("derives missed records only after tracking starts, excluding breaks, and retains corrections", () => {
    const s = {
      ...settings,
      autoMissed: true,
      trackingSince: "2026-09-27",
      excludedDates: ["2026-09-28"],
    };
    const rs = effectiveRecords(
      [record("excused")],
      s,
      new Date("2026-09-29T11:00:00"),
    );
    expect(rs).toHaveLength(5);
    expect(rs[0].status).toBe("excused");
    expect(rs.filter((r) => r.date === "2026-09-28")).toHaveLength(0);
    expect(rs.filter((r) => r.date === "2026-09-29")).toHaveLength(1);
  });
  it("counts excused separately and reports null for no denominator", () => {
    expect(attendanceStats([]).percentage).toBeNull();
    expect(attendanceStats([record("excused")]).percentage).toBeNull();
    const s = attendanceStats([
      record("late"),
      record("attended"),
      record("missed"),
      record("excused"),
    ]);
    expect(s.percentage).toBe(67);
    expect(s.attended).toBe(2);
    expect(s.lateMinutes).toBe(11);
    expect(s.excused).toBe(1);
  });
});
