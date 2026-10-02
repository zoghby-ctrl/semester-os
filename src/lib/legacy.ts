// The original transcription belongs only to explicit demo selection and old
// workspace conversion. It must never initialize a new student's semester.
import { courses, sourceSessions } from "../data/legacy-academic";
import { normalizedSemesterSchema, type NormalizedSemester } from "./domain";
import { defaultSettings, settingsSchema, type Settings } from "./schema";

export function legacySemester(name: string, demo = false): NormalizedSemester {
  const rooms = [...new Set(sourceSessions.map((s) => s.room))].map((label) => ({ id: label, label, building: null }));
  return normalizedSemesterSchema.parse({
    schemaVersion: 1, origin: demo ? "demo" : "legacy", student: { id: "student", displayName: name },
    university: { id: "ecu", name: "Egyptian Chinese University", adapterId: "ecu" },
    program: { id: "computer-science", name: "Computer Science", specialization: null },
    level: { id: "level-2", label: "Level 2" },
    semester: { id: "semester-1", name: "Semester 1", start: null, end: null },
    courses: courses.map((c) => ({ ...c, code: c.id, prerequisiteKnown: true })),
    offerings: courses.map((c) => ({ id: `offering-${c.id}`, courseId: c.id, semesterId: "semester-1", section: null })),
    sessions: sourceSessions.map((s) => ({ ...s, offeringId: `offering-${s.courseId}`, roomId: s.room })),
    rooms, confirmedAt: new Date().toISOString(),
  });
}
export function migrateSettings(input: unknown): Settings {
  if (!input || typeof input !== "object") throw new Error("Saved preferences are malformed. Your stored data has been retained.");
  const value = input as Record<string, unknown>;
  if (value.schemaVersion !== undefined && value.schemaVersion !== 2) throw new Error("This workspace uses a newer unsupported data version.");
  // Additive academicContext evidence is optional. Existing v2 semesters retain
  // their values and absent evidence exactly; no catalog/context re-inference.
  if (value.schemaVersion === 2) return settingsSchema.parse(input);
  if (typeof value.name !== "string" || !Array.isArray(value.schedule) || value.schedule.length !== 11)
    throw new Error("The old workspace could not be safely migrated. Your stored data has been retained.");
  return settingsSchema.parse({ ...value, schemaVersion: 2, semester: legacySemester(value.name), onboardingComplete: true });
}
export const demoSettings = (): Settings => settingsSchema.parse({
  ...defaultSettings, name: "Demo Student", semester: legacySemester("Demo Student", true), onboardingComplete: true,
  schedule: sourceSessions.map(({ id, start, end, timeConfirmed }) => ({ id, start, end, timeConfirmed })),
});
