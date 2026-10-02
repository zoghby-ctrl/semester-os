import { z } from "zod";

export const idSchema = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(s + "T12:00:00");
  return !isNaN(+d) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === s;
}, "Enter a valid date");
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const confidenceSchema = z.object({
  level: z.enum(["high", "medium", "low", "unknown", "confirmed"]),
  method: z.enum(["pdf-text", "ocr", "layout", "manual", "legacy", "demo", "catalog"]),
  reason: z.string().max(500),
  // An OCR engine score is evidence about recognition, not a calibrated
  // probability that an academic field is correct.
  recognitionScore: z.number().min(0).max(100).nullable().default(null),
  source: z.string().max(200).nullable().default(null),
  page: z.number().int().min(1).nullable().default(null),
});
export type ExtractionConfidence = z.infer<typeof confidenceSchema>;
export const studentProfileSchema = z.object({ id: idSchema, displayName: z.string().max(50) });
export type StudentProfile = z.infer<typeof studentProfileSchema>;
export const universityProfileSchema = z.object({ id: idSchema, name: z.string().min(1).max(200), adapterId: idSchema });
export type UniversityProfile = z.infer<typeof universityProfileSchema>;
export const academicProgramSchema = z.object({ id: idSchema, name: z.string().min(1).max(200), specialization: z.string().max(200).nullable() });
export type AcademicProgram = z.infer<typeof academicProgramSchema>;
export const academicLevelSchema = z.object({ id: idSchema, label: z.string().min(1).max(100) });
export type AcademicLevel = z.infer<typeof academicLevelSchema>;
export const semesterSchema = z.object({ id: idSchema, name: z.string().min(1).max(100), start: dateSchema.nullable(), end: dateSchema.nullable() });
export type Semester = z.infer<typeof semesterSchema>;
export const courseSchema = z.object({
  id: idSchema,
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200).nullable(),
  shortName: z.string().min(1).max(200).nullable(),
  credits: z.number().min(0).max(30).nullable(),
  prerequisite: z.object({ code: z.string().max(100), name: z.string().max(200) }).nullable(),
  prerequisiteKnown: z.boolean().default(false),
  color: z.string().regex(/^#[\da-f]{6}$/i),
  hours: z.object({ lecture: z.number().min(0).max(50), lab: z.number().min(0).max(50), tutorial: z.number().min(0).max(50) }).nullable(),
  // Optional additive metadata: old semesters/backups remain valid.
  metadataProvenance: z.object({code:confidenceSchema,name:confidenceSchema,credits:confidenceSchema,prerequisite:confidenceSchema,hours:confidenceSchema}).optional(),
});
export type Course = z.infer<typeof courseSchema>;
export const courseOfferingSchema = z.object({ id: idSchema, courseId: idSchema, semesterId: idSchema, section: z.string().max(100).nullable() });
export type CourseOffering = z.infer<typeof courseOfferingSchema>;
export const roomSchema = z.object({ id: idSchema, label: z.string().min(1).max(100), building: z.string().max(100).nullable() });
export type Room = z.infer<typeof roomSchema>;
export const sessionSchema = z.object({
  id: idSchema, courseId: idSchema, offeringId: idSchema,
  day: z.number().int().min(0).max(6),
  type: z.enum(["lecture", "lab", "tutorial"]),
  roomId: idSchema.nullable(), room: z.string().max(100),
  start: timeSchema, end: timeSchema, timeConfirmed: z.boolean(),
}).refine((s) => s.end > s.start, "End time must follow start");
export type Session = z.infer<typeof sessionSchema>;
export type Lecture = Session & { type: "lecture" };
export type Lab = Session & { type: "lab" };
export type Tutorial = Session & { type: "tutorial" };
export const normalizedSemesterSchema = z.object({
  schemaVersion: z.literal(1),
  origin: z.enum(["import", "manual", "demo", "legacy"]),
  student: studentProfileSchema,
  university: universityProfileSchema,
  program: academicProgramSchema.nullable(),
  level: academicLevelSchema.nullable(),
  semester: semesterSchema,
  courses: z.array(courseSchema).max(100),
  offerings: z.array(courseOfferingSchema).max(200),
  sessions: z.array(sessionSchema).max(500),
  rooms: z.array(roomSchema).max(300),
  confirmedAt: z.string().datetime(),
}).superRefine((s, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  for (const key of ["courses", "offerings", "sessions", "rooms"] as const)
    if (new Set(s[key].map((x) => x.id)).size !== s[key].length) issue(`Duplicate ${key} IDs`);
  const courses = new Set(s.courses.map((c) => c.id));
  const rooms = new Map(s.rooms.map((r) => [r.id, r]));
  const offerings = new Map(s.offerings.map((o) => [o.id, o]));
  for (const o of s.offerings)
    if (!courses.has(o.courseId) || o.semesterId !== s.semester.id) issue("Offering refers to an unknown course or semester");
  for (const session of s.sessions) {
    if (!courses.has(session.courseId) || offerings.get(session.offeringId)?.courseId !== session.courseId) issue("Session refers to an unknown course offering");
    if (session.roomId && rooms.get(session.roomId)?.label !== session.room) issue("Session refers to an unknown or mismatched room");
  }
  if (s.semester.start && s.semester.end && s.semester.end < s.semester.start) issue("Semester end must follow start");
});
export type NormalizedSemester = z.infer<typeof normalizedSemesterSchema>;
export const courseColors = ["#94b5ff", "#c1a2f8", "#e9b480", "#89d7c4", "#eaa4b7", "#a7c9ec", "#c3ce93", "#d5b9f3"];

export function semesterConflicts(sessions: Pick<Session, "id" | "day" | "start" | "end">[]) {
  const conflicts: [string, string][] = [];
  const sorted = [...sessions].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length && sorted[j].day === sorted[i].day && sorted[j].start < sorted[i].end; j++)
      conflicts.push([sorted[i].id, sorted[j].id]);
  return conflicts;
}
