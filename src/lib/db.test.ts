import { demoSettings } from "./legacy";
const defaultSettings = demoSettings();
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  exportBackup,
  importBackup,
  initialize,
  resetSemester,
  saveAttendance,
  saveSettings,
  SemesterDatabase,
  updatePrismSettings,
  validateBackup,
} from "./db";
import {
  defaultPrismSettings,
  type Attendance,
  type Settings,
} from "./schema";
let database: SemesterDatabase;
const record: Attendance = {
  id: "2026-09-27:sun-math",
  sessionId: "sun-math",
  date: "2026-09-27",
  status: "late",
  arrival: "08:41",
  plannedStart: "08:30",
  plannedEnd: "10:30",
  lateMinutes: 11,
  override: false,
  note: "Covered introductory material",
  updatedAt: "2026-09-27T10:00:00Z",
};
beforeEach(async () => {
  database = new SemesterDatabase(`test-${crypto.randomUUID()}`);
  await initialize(database);
  await saveSettings(defaultSettings, database);
});
afterEach(async () => {
  await database.delete();
});
describe("IndexedDB persistence and backup", () => {
  it("adds Star Drift to existing Prism settings without changing prior preferences", async () => {
    const { drift: _, ...prism } = defaultPrismSettings;
    await database.settings.put({
      ...defaultSettings,
      prism: { ...prism, parallax: 0, shootingFrequency: 50 },
    } as Settings);
    await initialize(database);
    expect((await database.settings.get("main"))?.prism).toEqual({
      ...prism,
      drift: "normal",
      parallax: 0,
      shootingFrequency: 50,
    });
  });
  it("preserves concurrent Prism edits across reopen and backup restoration", async () => {
    await saveAttendance(record, database);
    await Promise.all([
      updatePrismSettings({ density: 46 }, database),
      updatePrismSettings({ shootingStars: false, parallax: 11 }, database),
      updatePrismSettings({ brightness: 85, dim: 38 }, database),
    ]);
    database.close();
    await database.open();
    const expected = {
      ...defaultPrismSettings,
      density: 46,
      shootingStars: false,
      parallax: 11,
      brightness: 85,
      dim: 38,
    };
    expect((await database.settings.get("main"))?.prism).toEqual(expected);
    const backup = await exportBackup(database);
    await updatePrismSettings({ density: 0, brightness: 0 }, database);
    await importBackup(backup, database);
    expect((await database.settings.get("main"))?.prism).toEqual(expected);
    expect(await database.attendance.get(record.id)).toEqual(record);
  });
  it("upgrades legacy preferences without losing existing attendance or personal choices", async () => {
    const legacy = {
      ...defaultSettings,
      prism: undefined,
      name: "Ahmed A",
      theme: "midnight",
    };
    await database.settings.put(legacy as unknown as Settings);
    await saveAttendance(record, database);
    await initialize(database);
    const updated = await database.settings.get("main");
    expect(updated?.prism).toEqual(defaultPrismSettings);
    expect(updated?.name).toBe("Ahmed A");
    expect(updated?.theme).toBe("midnight");
    expect(await database.attendance.get(record.id)).toEqual(record);
  });
  it("rejects contradictory arrival records and overlapping imported timetables", async () => {
    await expect(
      saveAttendance({ ...record, lateMinutes: 2 }, database),
    ).rejects.toThrow("Late minutes");
    await expect(
      saveAttendance({ ...record, status: "excused" }, database),
    ).rejects.toThrow("cannot contain an arrival");
    await expect(
      saveAttendance(
        { ...record, date: "2026-09-28", id: "2026-09-28:sun-math" },
        database,
      ),
    ).rejects.toThrow("weekday");
    await expect(
      saveSettings(
        {
          ...defaultSettings,
          schedule: defaultSettings.schedule.map((s) =>
            s.id === "sun-math" ? { ...s, end: "11:00" } : s,
          ),
        },
        database,
      ),
    ).rejects.toThrow("overlap");
  });
  it("initializes without overwriting saved preferences", async () => {
    await saveSettings(
      { ...defaultSettings, name: "Ahmed A", theme: "aurora" },
      database,
    );
    await initialize(database);
    expect((await database.settings.get("main"))?.name).toBe("Ahmed A");
  });
  it("preserves check-ins across close and reopen and keeps historical planned times", async () => {
    await saveAttendance(record, database);
    database.close();
    await database.open();
    await saveSettings(
      {
        ...defaultSettings,
        schedule: defaultSettings.schedule.map((s) => ({
          ...s,
          start: s.id === "sun-math" ? "09:00" : s.start,
        })),
      },
      database,
    );
    expect(await database.attendance.get(record.id)).toEqual(record);
  });
  it("overwrites a corrected record without duplicating the session", async () => {
    await saveAttendance(record, database);
    await saveAttendance(
      {
        ...record,
        status: "excused",
        arrival: null,
        lateMinutes: 0,
        override: true,
      },
      database,
    );
    expect(await database.attendance.count()).toBe(1);
    expect((await database.attendance.get(record.id))?.status).toBe("excused");
  });
  it("round trips a versioned backup", async () => {
    await saveAttendance(record, database);
    await database.notes.add({
      id: "note-1",
      courseId: "BSC1301",
      sessionId: null,
      date: null,
      text: "A saved idea",
      updatedAt: record.updatedAt,
    });
    const backup = await exportBackup(database);
    await resetSemester(database);
    await importBackup(backup, database);
    expect(await database.attendance.get(record.id)).toEqual(record);
    expect((await database.notes.get("note-1"))?.text).toBe("A saved idea");
  });
  it("rejects corrupt and future-version imports without changing current data", async () => {
    await saveAttendance(record, database);
    const backup = await exportBackup(database);
    await expect(
      importBackup({ ...backup, version: 99 }, database),
    ).rejects.toThrow();
    await expect(
      importBackup(
        { ...backup, attendance: [{ ...record, id: "bad-key" }] },
        database,
      ),
    ).rejects.toThrow();
    await expect(
      importBackup(
        {
          ...backup,
          wallpaper: { name: "corrupt.png", type: "image/png", data: "a" },
        },
        database,
      ),
    ).rejects.toThrow("Invalid wallpaper data");
    expect(await database.attendance.get(record.id)).toEqual(record);
  });
  it("rejects duplicate IDs and invalid dates", async () => {
    const backup = await exportBackup(database);
    expect(() =>
      validateBackup({ ...backup, attendance: [record, record] }),
    ).toThrow("Duplicate");
    expect(() =>
      validateBackup({
        ...backup,
        attendance: [{ ...record, date: "2026-02-30" }],
      }),
    ).toThrow();
  });
  it("rejects duplicate schedule entries, invalid times and missing auto-missed start", async () => {
    await expect(
      saveSettings(
        {
          ...defaultSettings,
          schedule: Array(11).fill(defaultSettings.schedule[0]),
        },
        database,
      ),
    ).rejects.toThrow();
    await expect(
      saveSettings({ ...defaultSettings, autoMissed: true }, database),
    ).rejects.toThrow();
    await expect(
      saveSettings(
        {
          ...defaultSettings,
          schedule: defaultSettings.schedule.map((s) => ({
            ...s,
            start: "25:99",
          })),
        },
        database,
      ),
    ).rejects.toThrow();
  });
  it("reset retains preferences and removes all academic records", async () => {
    await saveAttendance(record, database);
    await database.topics.add({
      id: "t",
      courseId: "CSC2100",
      title: "Trees",
      done: true,
      updatedAt: record.updatedAt,
    });
    await saveSettings({ ...defaultSettings, theme: "campus" }, database);
    await resetSemester(database);
    expect(await database.attendance.count()).toBe(0);
    expect(await database.topics.count()).toBe(0);
    expect((await database.settings.get("main"))?.theme).toBe("campus");
  });
});
