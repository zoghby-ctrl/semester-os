import { z } from "zod";
import { atmosphereSchema, customThemeSchema, defaultAtmosphere, defaultCustomTheme, themeIdSchema, visualQualitySchema } from "../themes/schema";
import { dateSchema, timeSchema, idSchema, normalizedSemesterSchema, semesterConflicts } from "./domain";
export { dateSchema, timeSchema } from "./domain";
const courseId = idSchema, sessionId = idSchema;
export const attendanceSchema = z
  .object({
    id: z.string().min(1).max(140).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    sessionId,
    date: dateSchema,
    status: z.enum(["on-time", "late", "attended", "missed", "excused"]),
    arrival: timeSchema.nullable(),
    plannedStart: timeSchema,
    plannedEnd: timeSchema,
    lateMinutes: z.number().int().min(0).max(1439),
    override: z.boolean(),
    note: z.string().max(5000),
    updatedAt: z.string().datetime(),
  })
  .superRefine((r, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (r.plannedEnd <= r.plannedStart)
      issue("Recorded end time must follow start");
    if (["missed", "excused"].includes(r.status)) {
      if (r.arrival !== null || r.lateMinutes !== 0)
        issue("Missed and excused records cannot contain an arrival");
    } else {
      if (!r.arrival) issue("An attended session requires an arrival time");
      else {
        const minutes = (t: string) =>
          Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
        const actual = Math.max(
          0,
          minutes(r.arrival) - minutes(r.plannedStart),
        );
        if (actual !== r.lateMinutes)
          issue("Late minutes must match the recorded arrival");
        if (r.status === "late" && actual === 0)
          issue("A late arrival must follow class start");
      }
    }
  });
export type Attendance = z.infer<typeof attendanceSchema>;
export const defaultPrismSettings = {
  starfield: true,
  density: 32,
  brightness: 72,
  twinkle: 18,
  shootingStars: true,
  shootingFrequency: 100,
  meteorShower: "shower" as const,
  meteorSpeed: "slow" as const,
  parallax: 22,
  drift: "normal" as const,
  dim: 24,
  blur: 0,
};
export const prismSettingsSchema = z
  .object({
    starfield: z.boolean(),
    density: z.number().min(0).max(100),
    brightness: z.number().min(0).max(100),
    twinkle: z.number().min(0).max(100),
    shootingStars: z.boolean(),
    shootingFrequency: z.number().min(50).max(150),
    meteorShower: z.enum(["off", "sparse", "shower", "storm"]).optional(),
    meteorSpeed: z.enum(["slow", "normal", "fast"]).default("slow"),
    parallax: z.number().min(0).max(100),
    drift: z.enum(["off", "subtle", "normal"]).default("normal"),
    dim: z.number().min(0).max(90),
    blur: z.number().min(0).max(8),
  })
  .transform((p) => ({
    ...p,
    meteorShower:
      p.meteorShower ??
      (!p.shootingStars
        ? ("off" as const)
        : p.shootingFrequency <= 75
          ? ("sparse" as const)
          : p.shootingFrequency >= 125
            ? ("storm" as const)
            : ("shower" as const)),
  }));
export type PrismSettings = z.infer<typeof prismSettingsSchema>;
export const settingsSchema = z
  .object({
    id: z.literal("main"),
    schemaVersion: z.literal(2),
    semester: normalizedSemesterSchema.nullable(),
    onboardingComplete: z.boolean(),
    name: z.string().max(50),
    theme: themeIdSchema,
    visualQuality: visualQualitySchema.default("auto"),
    customTheme: customThemeSchema.default(()=>({...defaultCustomTheme})),
    atmosphere: atmosphereSchema.default(()=>({...defaultAtmosphere})),
    favoriteThemes: z.array(themeIdSchema).max(14).default([]),
    themeFavorites: z.array(z.object({id:idSchema,name:z.string().min(1).max(60),theme:themeIdSchema,customTheme:customThemeSchema,atmosphere:atmosphereSchema,motion:z.number().min(0).max(100),grain:z.number().min(0).max(100),prism:prismSettingsSchema})).max(30).default([]),
    reduceMotion: z.boolean(),
    motion: z.number().min(0).max(100),
    grain: z.number().min(0).max(100),
    blur: z.number().min(0).max(30),
    dim: z.number().min(45).max(95),
    wallpaperPaused: z.boolean(),
    wallpaperEnabled: z.boolean(),
    prism: prismSettingsSchema.default(() => ({ ...defaultPrismSettings })),
    graceMinutes: z.number().int().min(0).max(60),
    autoMissed: z.boolean(),
    semesterStart: dateSchema.nullable(),
    semesterEnd: dateSchema.nullable(),
    excludedDates: z.array(dateSchema).max(500),
    trackingSince: dateSchema.nullable(),
    schedule: z
      .array(
        z
          .object({
            id: sessionId,
            start: timeSchema,
            end: timeSchema,
            timeConfirmed: z.boolean(),
          })
          .refine((s) => s.end > s.start, "End time must follow start"),
      )
      .max(500),
  })
  .superRefine((s, ctx) => {
    if (new Set(s.favoriteThemes).size !== s.favoriteThemes.length || new Set(s.themeFavorites.map(f => f.id)).size !== s.themeFavorites.length) ctx.addIssue({code: "custom", message: "Appearance favorites contain duplicate entries"});
    if (s.trackingSince && s.trackingSince < "2000-01-01")
      ctx.addIssue({
        code: "custom",
        message: "Tracking start must be after 1999",
      });
    const sessionMap = new Map(s.semester?.sessions.map(x => [x.id, x]) ?? []);
    if (s.schedule.some(x => !sessionMap.has(x.id))) ctx.addIssue({code: "custom", message: "Unknown session in timetable settings"});
    const effective = (s.semester?.sessions ?? []).map(x => ({...x, ...s.schedule.find(t => t.id === x.id)}));
    const originalConflicts = new Set(semesterConflicts(s.semester?.sessions ?? []).map(x => x.join(":")));
    if (semesterConflicts(effective).some(x => !originalConflicts.has(x.join(":")))) ctx.addIssue({code: "custom", message: "Timetable edits create an overlap. Correct the times before saving."});
    if (s.semesterStart && s.semesterEnd && s.semesterEnd < s.semesterStart)
      ctx.addIssue({
        code: "custom",
        message: "Semester end must follow start",
      });
    if (new Set(s.schedule.map((x) => x.id)).size !== s.schedule.length)
      ctx.addIssue({
        code: "custom",
        message: "Schedule contains duplicate sessions",
      });
    if (s.autoMissed && !s.trackingSince)
      ctx.addIssue({
        code: "custom",
        message: "Set tracking start before automatic missed status",
      });
  });
export type Settings = z.infer<typeof settingsSchema>;
export const topicSchema = z.object({
  id: idSchema,
  courseId,
  title: z.string().min(1).max(200),
  done: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type Topic = z.infer<typeof topicSchema>;
export const itemSchema = z.object({
  id: idSchema,
  courseId,
  title: z.string().min(1).max(200),
  kind: z.enum(["assignment", "exam", "task"]),
  due: dateSchema.nullable(),
  done: z.boolean(),
  note: z.string().max(5000),
  updatedAt: z.string().datetime(),
});
export type PlannerItem = z.infer<typeof itemSchema>;
export const noteSchema = z.object({
  id: idSchema,
  courseId,
  sessionId: sessionId.nullable(),
  date: dateSchema.nullable(),
  text: z.string().min(1).max(10000),
  updatedAt: z.string().datetime(),
});
export type Note = z.infer<typeof noteSchema>;
export const studySchema = z.object({
  id: idSchema,
  courseId,
  date: dateSchema,
  seconds: z.number().int().min(1).max(86400),
  note: z.string().max(5000),
  updatedAt: z.string().datetime(),
});
export type Study = z.infer<typeof studySchema>;
export const timerSchema = z.object({
  id: z.literal("active"),
  courseId,
  startedAt: z.number().finite().min(0).max(8640000000000000).nullable(),
  accumulated: z.number().min(0).max(86400),
  note: z.string().max(5000),
});
export type Timer = z.infer<typeof timerSchema>;
export const backupSchema = z.object({
  format: z.literal("semester-os"),
  version: z.literal(2),
  exportedAt: z.string().datetime(),
  settings: settingsSchema,
  attendance: z.array(attendanceSchema).max(100000),
  topics: z.array(topicSchema).max(10000),
  items: z.array(itemSchema).max(10000),
  notes: z.array(noteSchema).max(10000),
  study: z.array(studySchema).max(100000),
  wallpaper: z
    .object({
      name: z.string().max(255),
      type: z
        .string()
        .regex(/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|ogg))$/),
      data: z.string().min(1).max(69905068),
    })
    .nullable(),
}).strict();
export type Backup = z.infer<typeof backupSchema>;
export const defaultSettings: Settings = {
  id: "main",
  schemaVersion: 2,
  semester: null,
  onboardingComplete: false,
  name: "",
  theme: "prism",
  visualQuality: "auto",
  customTheme:{...defaultCustomTheme},
  atmosphere:{...defaultAtmosphere},
  favoriteThemes:[],
  themeFavorites:[],
  reduceMotion: false,
  motion: 35,
  grain: 12,
  blur: 4,
  dim: 75,
  wallpaperPaused: false,
  wallpaperEnabled: true,
  prism: { ...defaultPrismSettings },
  graceMinutes: 0,
  autoMissed: false,
  semesterStart: null,
  semesterEnd: null,
  excludedDates: [],
  trackingSince: null,
  schedule: [],
};

export type AttendanceRecord = Attendance;
export type Assignment = PlannerItem & {kind: "assignment"};
export type Exam = PlannerItem & {kind: "exam"};
export type StudySession = Study;
export type ProgressRecord = Topic;
export type ThemePreferences = Pick<Settings, "theme" | "prism" | "reduceMotion" | "motion" | "grain">;
export type SemesterSettings = Pick<Settings, "semesterStart" | "semesterEnd" | "excludedDates" | "graceMinutes" | "autoMissed" | "trackingSince">;
