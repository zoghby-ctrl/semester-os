import Dexie, { type Table } from "dexie";
import {
  attendanceSchema,
  backupSchema,
  defaultSettings,
  itemSchema,
  noteSchema,
  settingsSchema,
  studySchema,
  timerSchema,
  topicSchema,
  type Attendance,
  type Backup,
  type Note,
  type PlannerItem,
  type Settings,
  type Study,
  type Timer,
  type Topic,
} from "./schema";
import { recordId } from "./scheduling";
import { migrateSettings } from "./legacy";
import { normalizedSemesterSchema, type NormalizedSemester } from "./domain";
import { assertPlainData, MAX_WALLPAPER_BYTES, sniffFormat, validateImageHeader } from "./security";
type Snapshot = { settings: Settings; attendance: Attendance[]; topics: Topic[]; items: PlannerItem[]; notes: Note[]; study: Study[]; wallpaper?: Wallpaper; timer?: Timer };
export interface Recovery { id?: number; kind: string; createdAt: string; settings?: unknown; snapshot?: Snapshot }
export interface Wallpaper {
  id: "main";
  name: string;
  type: string;
  blob: Blob;
  updatedAt?: string;
}
export class SemesterDatabase extends Dexie {
  settings!: Table<Settings, string>;
  attendance!: Table<Attendance, string>;
  topics!: Table<Topic, string>;
  items!: Table<PlannerItem, string>;
  notes!: Table<Note, string>;
  study!: Table<Study, string>;
  wallpaper!: Table<Wallpaper, string>;
  timer!: Table<Timer, string>;
  recovery!: Table<Recovery, number>;
  constructor(name = "semester-os-v1") {
    super(name);
    this.version(1).stores({
      settings: "id",
      attendance: "id,date,sessionId",
      topics: "id,courseId",
      items: "id,courseId,due",
      notes: "id,courseId,sessionId",
      study: "id,courseId,date",
      wallpaper: "id",
      timer: "id",
    });
    this.version(2).stores({ recovery: "++id,kind,createdAt" });
  }
}
export const db = new SemesterDatabase();
export async function initialize(database = db) {
  await database.transaction("rw", [database.settings, database.recovery], async () => {
    const current = await database.settings.get("main");
    if (!current) await database.settings.add(structuredClone(defaultSettings));
    else {
      const migrated = migrateSettings(current);
      if (JSON.stringify(current) !== JSON.stringify(migrated)) {
        await database.recovery.add({ kind: "Preferences before migration", createdAt: timestamp(), settings: current });
        await database.settings.put(migrated);
      }
    }
  });
}
export const uid = () => crypto.randomUUID();
export const timestamp = () => new Date().toISOString();
export async function saveAttendance(record: Attendance, database = db) {
  const parsed = attendanceSchema.parse(record);
  if (parsed.id !== recordId(parsed.sessionId, parsed.date))
    throw new Error("Attendance key does not match session and date");
  await database.transaction("rw", [database.settings, database.attendance], async () => {
    const settings = await database.settings.get("main");
    const session = settings?.semester?.sessions.find(s => s.id === parsed.sessionId);
    if (!session) throw new Error("Unknown session in your semester");
    if (new Date(parsed.date + "T12:00:00").getDay() !== session.day) throw new Error("Attendance date must match the scheduled weekday");
    await database.attendance.put(parsed);
  });
}
export async function saveSettings(settings: Settings, database = db) {
  assertPlainData(settings);
  const value = settingsSchema.parse(settings);
  if (value.semester) {
    value.semester.student.displayName = value.name;
    value.semester.semester.start = value.semesterStart;
    value.semester.semester.end = value.semesterEnd;
  }
  await database.settings.put(value);
}
export async function updateSettings(patch: Partial<Settings>) {
  await db.transaction("rw", db.settings, async () => {
    const current = (await db.settings.get("main")) ?? defaultSettings;
    await saveSettings({ ...current, ...patch });
  });
}
export async function updatePrismSettings(
  patch: Partial<Settings["prism"]>,
  database = db,
) {
  await database.transaction("rw", database.settings, async () => {
    const current = settingsSchema.parse(
      (await database.settings.get("main")) ?? defaultSettings,
    );
    await saveSettings(
      { ...current, prism: { ...current.prism, ...patch } },
      database,
    );
  });
}
async function saveRelated<T extends { courseId: string }>(table: Table<T, string>, value: T) {
  return db.transaction("rw", [db.settings, table], async () => {
    const settings = await db.settings.get("main");
    if (!settings?.semester?.courses.some(c => c.id === value.courseId)) throw new Error("Choose a course in your semester first");
    if (table.name === "notes") validateRelations(settings, { notes: [value as unknown as Note] });
    return table.put(value);
  });
}
export const saveTopic = (topic: Topic) => saveRelated(db.topics, topicSchema.parse(topic));
export const saveItem = (item: PlannerItem) => saveRelated(db.items, itemSchema.parse(item));
export const saveNote = (note: Note) => saveRelated(db.notes, noteSchema.parse(note));
export const saveStudy = (study: Study) => saveRelated(db.study, studySchema.parse(study));
export const saveTimer = (timer: Timer) => saveRelated(db.timer, timerSchema.parse(timer));

export function validateRelations(settings: Settings, records: Partial<Pick<Snapshot, "attendance" | "topics" | "items" | "notes" | "study">>) {
  const courses = new Set(settings.semester?.courses.map(c => c.id) ?? []);
  const sessions = new Map(settings.semester?.sessions.map(s => [s.id, s]) ?? []);
  for (const key of ["topics", "items", "notes", "study"] as const)
    if (records[key]?.some(r => !courses.has(r.courseId))) throw new Error(`Unknown course in ${key}`);
  for (const r of records.attendance ?? []) {
    const session = sessions.get(r.sessionId);
    if (!session) throw new Error("Unknown attendance session");
    if (new Date(r.date + "T12:00:00").getDay() !== session.day) throw new Error("Attendance date must match the scheduled weekday");
  }
  for (const note of records.notes ?? []) {
    if (note.sessionId && sessions.get(note.sessionId)?.courseId !== note.courseId) throw new Error("Note session does not belong to its course");
    if (note.sessionId && note.date && new Date(note.date + "T12:00:00").getDay() !== sessions.get(note.sessionId)?.day) throw new Error("Note date must match the scheduled weekday");
  }
}
export function validateBackup(input: unknown): Backup {
  assertPlainData(input);
  let candidate = input;
  if (input && typeof input === "object" && "version" in input && input.version === 1) {
    const legacy = input as Record<string, unknown>;
    candidate = { ...legacy, version: 2, settings: migrateSettings(legacy.settings) };
  }
  const backup = backupSchema.parse(candidate);
  validateRelations(backup.settings, backup);
  for (const key of [
    "attendance",
    "topics",
    "items",
    "notes",
    "study",
  ] as const) {
    if (new Set(backup[key].map((x) => x.id)).size !== backup[key].length)
      throw new Error(`Duplicate ${key} entries`);
  }
  if (backup.attendance.some((r) => r.id !== recordId(r.sessionId, r.date)))
    throw new Error("Backup contains mismatched attendance keys");
  if (
    backup.settings.trackingSince &&
    backup.settings.trackingSince < "2000-01-01"
  )
    throw new Error("Tracking start must be after 1999");
  if (backup.wallpaper) {
    const data = backup.wallpaper.data;
    if (data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error("Invalid wallpaper data");
    if (data.length * 3 / 4 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0) > MAX_WALLPAPER_BYTES) throw new Error("Wallpaper exceeds 50 MB");
    const header = Uint8Array.from(atob(data.slice(0, Math.min(data.length, 64))), c => c.charCodeAt(0));
    if (sniffFormat(header) !== backup.wallpaper.type) throw new Error("Wallpaper contents do not match the backup's media type");
  }
  return backup;
}
const asBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read wallpaper"));
    reader.readAsDataURL(blob);
  });
export async function exportBackup(database = db): Promise<Backup> {
  const [settings, attendance, topics, items, notes, study, wallpaper] =
    await database.transaction("r", database.tables, () =>
      Promise.all([
        database.settings.get("main"),
        database.attendance.toArray(),
        database.topics.toArray(),
        database.items.toArray(),
        database.notes.toArray(),
        database.study.toArray(),
        database.wallpaper.get("main"),
      ]),
    );
  if (!settings) throw new Error("Settings are unavailable");
  return validateBackup({
    format: "semester-os",
    version: 2,
    exportedAt: timestamp(),
    settings,
    attendance,
    topics,
    items,
    notes,
    study,
    wallpaper: wallpaper
      ? {
          name: wallpaper.name,
          type: wallpaper.type,
          data: await asBase64(wallpaper.blob),
        }
      : null,
  });
}
export async function importBackup(input: unknown, database = db) {
  const b = validateBackup(input);
  let wallpaper: Wallpaper | undefined;
  if (b.wallpaper) {
    const parts: Uint8Array<ArrayBuffer>[] = [];
    for (let start = 0; start < b.wallpaper.data.length; start += 32768) {
      const binary = atob(b.wallpaper.data.slice(start, start + 32768));
      parts.push(Uint8Array.from(binary, c => c.charCodeAt(0)));
    }
    wallpaper = {
      id: "main",
      name: b.wallpaper.name,
      type: b.wallpaper.type,
      updatedAt: timestamp(),
      blob: new Blob(parts, {
        type: b.wallpaper.type,
      }),
    };
    if (wallpaper.blob.size > 50 * 1024 * 1024)
      throw new Error("Wallpaper exceeds 50 MB");
    await inspectWallpaper(wallpaper.blob, wallpaper.type);
  }
  await database.transaction("rw", database.tables, async () => {
    await snapshotWorkspace("Before backup restore", database);
    for (const table of database.tables) if (table.name !== "recovery") await table.clear();
    await database.settings.put(b.settings);
    await database.attendance.bulkPut(b.attendance);
    await database.topics.bulkPut(b.topics);
    await database.items.bulkPut(b.items);
    await database.notes.bulkPut(b.notes);
    await database.study.bulkPut(b.study);
    if (wallpaper) await database.wallpaper.put(wallpaper);
  });
}
async function snapshotWorkspace(kind: string, database: SemesterDatabase) {
  const settings = await database.settings.get("main");
  if (!settings) return;
  const [attendance, topics, items, notes, study, wallpaper, timer] = await Promise.all([
    database.attendance.toArray(), database.topics.toArray(), database.items.toArray(), database.notes.toArray(), database.study.toArray(), database.wallpaper.get("main"), database.timer.get("active"),
  ]);
  await database.recovery.add({ kind, createdAt: timestamp(), snapshot: { settings, attendance, topics, items, notes, study, wallpaper, timer } });
}
export async function activateSemester(input: NormalizedSemester, expectedSemesterId: string | null, database = db) {
  const semester = normalizedSemesterSchema.parse(input);
  await database.transaction("rw", database.tables, async () => {
    const current = await database.settings.get("main");
    if (!current || (current.semester?.semester.id ?? null) !== expectedSemesterId) throw new Error("Your semester changed while setup was open. Reopen setup to continue safely.");
    if (current.semester) await snapshotWorkspace("Before semester change", database);
    for (const table of [database.attendance, database.topics, database.items, database.notes, database.study, database.timer]) await table.clear();
    await saveSettings({ ...current, name: semester.student.displayName, semester, schedule: [], onboardingComplete: true, semesterStart: semester.semester.start, semesterEnd: semester.semester.end, trackingSince: null, excludedDates: [], autoMissed: false }, database);
  });
}
export async function restoreRecovery(id: number, database = db) {
  const entry = await database.recovery.get(id);
  if (!entry?.snapshot) throw new Error("This recovery entry has no complete workspace snapshot");
  const settings = migrateSettings(entry.snapshot.settings);
  const validated = validateBackup({ format: "semester-os", version: 2, exportedAt: timestamp(), settings, attendance: entry.snapshot.attendance, topics: entry.snapshot.topics, items: entry.snapshot.items, notes: entry.snapshot.notes, study: entry.snapshot.study, wallpaper: null });
  const timer = entry.snapshot.timer ? timerSchema.parse(entry.snapshot.timer) : undefined;
  if (timer && !settings.semester?.courses.some(c => c.id === timer.courseId)) throw new Error("Recovery timer refers to an unknown course");
  const wallpaper = entry.snapshot.wallpaper;
  if (wallpaper) { validateWallpaperRecord(wallpaper); await inspectWallpaper(wallpaper.blob, wallpaper.type); }
  await database.transaction("rw", database.tables, async () => {
    if ((await database.recovery.get(id))?.createdAt !== entry.createdAt) throw new Error("The recovery point changed. Reopen it before restoring.");
    const s = validated;
    await snapshotWorkspace("Before recovery", database);
    for (const table of database.tables) if (table.name !== "recovery") await table.clear();
    await database.settings.put(settings);
    await database.attendance.bulkPut(s.attendance);
    await database.topics.bulkPut(s.topics);
    await database.items.bulkPut(s.items);
    await database.notes.bulkPut(s.notes);
    await database.study.bulkPut(s.study);
    if (wallpaper) await database.wallpaper.put(wallpaper);
    if (timer) await database.timer.put(timer);
  });
}
export async function resetSemester(database = db) {
  await database.transaction(
    "rw",
    database.tables,
    async () => {
      await snapshotWorkspace("Before records reset", database);
      await Promise.all([
        database.attendance.clear(),
        database.topics.clear(),
        database.items.clear(),
        database.notes.clear(),
        database.study.clear(),
        database.timer.clear(),
      ]);
    },
  );
}
export async function saveWallpaper(file: File) {
  if (!file.size)
    throw new Error("This file is empty. Choose another wallpaper.");
  if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|ogg))$/.test(file.type))
    throw new Error("Choose a JPG, PNG, WebP, GIF, MP4, WebM or Ogg file");
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Choose a file smaller than 50 MB");
  if (file.name.length > 255) throw new Error("Use a shorter wallpaper filename");
  await inspectWallpaper(file, file.type);
  await db.wallpaper.put({
    id: "main",
    name: file.name,
    type: file.type,
    blob: file,
    updatedAt: timestamp(),
  });
  await updateSettings({ wallpaperEnabled: true });
}

function validateWallpaperRecord(wallpaper: Wallpaper) {
  if (wallpaper.id !== "main" || typeof wallpaper.name !== "string" || wallpaper.name.length > 255 || !(wallpaper.blob instanceof Blob) || wallpaper.blob.type !== wallpaper.type || !wallpaper.blob.size || wallpaper.blob.size > MAX_WALLPAPER_BYTES || !/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|ogg))$/.test(wallpaper.type)) throw new Error("The saved wallpaper is malformed");
}
async function inspectWallpaper(blob: Blob, type: string) {
  const bytes = new Uint8Array(await blob.slice(0, 1024 * 1024).arrayBuffer());
  const detected = sniffFormat(bytes);
  if (detected !== type || !detected) throw new Error("Wallpaper contents do not match its media type");
  if (detected.startsWith("image/")) validateImageHeader(bytes, detected);
}
export async function deleteWorkspace(database = db) {
  await database.transaction("rw", database.tables, async () => {
    for (const table of database.tables) await table.clear();
    await database.settings.put(structuredClone(defaultSettings));
  });
}
export function validateWorkspace(data: { settings: Settings; attendance: Attendance[]; topics: Topic[]; items: PlannerItem[]; notes: Note[]; study: Study[]; wallpaper?: Wallpaper; timer?: Timer }) {
  for (const [key, max] of [["attendance", 100000], ["study", 100000], ["topics", 10000], ["items", 10000], ["notes", 10000]] as const) if (data[key].length > max) throw new Error("Saved workspace exceeds the supported record limit");
  const settings = settingsSchema.parse(data.settings);
  const attendance = data.attendance.map(r => attendanceSchema.parse(r)), topics = data.topics.map(r => topicSchema.parse(r)), items = data.items.map(r => itemSchema.parse(r)), notes = data.notes.map(r => noteSchema.parse(r)), study = data.study.map(r => studySchema.parse(r));
  validateRelations(settings, { attendance, topics, items, notes, study });
  if (attendance.some(r => r.id !== recordId(r.sessionId, r.date))) throw new Error("Invalid saved attendance key");
  const timer = data.timer ? timerSchema.parse(data.timer) : undefined;
  if (timer && !settings.semester?.courses.some(c => c.id === timer.courseId)) throw new Error("Invalid saved timer course");
  if (data.wallpaper) validateWallpaperRecord(data.wallpaper);
  return { settings, attendance, topics, items, notes, study, wallpaper: data.wallpaper, timer };
}
