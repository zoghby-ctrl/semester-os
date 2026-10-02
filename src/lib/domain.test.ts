import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { normalizedSemesterSchema, semesterConflicts } from "./domain";
import { demoSettings, legacySemester, migrateSettings } from "./legacy";
import { defaultSettings, settingsSchema } from "./schema";
import { activateSemester, exportBackup, importBackup, initialize, restoreRecovery, saveSettings, SemesterDatabase, validateBackup } from "./db";
import { nextSession, sessionsOn } from "./scheduling";

const databases: SemesterDatabase[] = [];
const database = () => { const d = new SemesterDatabase(`domain-${crypto.randomUUID()}`); databases.push(d); return d; };
afterEach(async () => { for (const d of databases.splice(0)) await d.delete(); });
describe("Normalized academic data", () => {
  it("initializes a completely clean student without demo data or another name", async () => {
    const d = database(); await initialize(d);
    const s = (await d.settings.get("main"))!;
    expect(s).toEqual(defaultSettings);
    expect(s.semester).toBeNull(); expect(s.name).toBe(""); expect(s.schedule).toEqual([]);
    expect(nextSession(new Date("2026-10-01T12:00:00"), s)).toBeNull();
    expect(await d.attendance.count()).toBe(0);
  });
  it("supports empty semesters and arbitrary weekdays with no material plan", () => {
    const s = demoSettings();
    s.semester!.courses.forEach(c => { c.credits = null; c.hours = null; c.name = null; c.prerequisiteKnown = false; });
    s.semester!.sessions = [{...s.semester!.sessions[0], day: 6, room: "", roomId: null}];
    s.schedule = [];
    expect(settingsSchema.safeParse(s).success).toBe(true);
    expect(sessionsOn("2026-10-03", s)).toHaveLength(1);
    s.semester!.sessions = [];
    expect(nextSession(new Date("2026-10-01"), s)).toBeNull();
  });
  it("rejects duplicates and orphaned course/session/room relationships", () => {
    const original = legacySemester("Demo Student", true);
    for (const mutate of [
      (s: typeof original) => s.courses.push(s.courses[0]),
      (s: typeof original) => {s.sessions[0].courseId = "missing";},
      (s: typeof original) => {s.sessions[0].roomId = "missing";},
      (s: typeof original) => {s.offerings[0].semesterId = "missing";},
    ]) { const s = structuredClone(original); mutate(s); expect(normalizedSemesterSchema.safeParse(s).success).toBe(false); }
  });
  it("accepts imperfect overlapping input and reports all conflict pairs", () => {
    const s = legacySemester("", true);
    s.sessions[0].end = "13:00";
    expect(normalizedSemesterSchema.safeParse(s).success).toBe(true);
    expect(semesterConflicts(s.sessions)).toEqual([["sun-math", "sun-arch"], ["sun-math", "sun-data"]]);
  });
});
describe("Safe migration and portability", () => {
  it("preserves an existing ECU workspace and every record during additive context migration",async()=>{
    const d=database(),settings=demoSettings();settings.semester!.origin="legacy";settings.theme="campus";
    await d.settings.put(settings);
    const stamp="2026-10-01T12:00:00Z",courseId="BSC1301";
    await d.attendance.put({id:"2026-09-27:sun-math",sessionId:"sun-math",date:"2026-09-27",status:"attended",arrival:"08:30",plannedStart:"08:30",plannedEnd:"10:30",lateMinutes:0,override:false,note:"Keep",updatedAt:stamp});
    await d.topics.put({id:"topic",courseId,title:"Keep topic",done:true,updatedAt:stamp});
    await d.items.put({id:"item",courseId,title:"Keep plan",kind:"assignment",due:null,done:false,note:"",updatedAt:stamp});
    await d.notes.put({id:"note",courseId,sessionId:null,date:null,text:"Keep note",updatedAt:stamp});
    await d.study.put({id:"study",courseId,date:"2026-10-01",seconds:1200,note:"Keep history",updatedAt:stamp});
    const timer={id:"active" as const,courseId,startedAt:12345,accumulated:42,note:"Keep timer"};await d.timer.put(timer);
    await d.recovery.add({kind:"Existing recovery",createdAt:stamp,settings});
    const before=await exportBackup(d);
    await initialize(d);await initialize(d);d.close();await d.open();
    expect(await d.settings.get("main")).toEqual(settings);expect((await d.settings.get("main"))?.semester?.academicContext).toBeUndefined();
    const after=await exportBackup(d);expect({...after,exportedAt:before.exportedAt}).toEqual(before);
    expect(await d.timer.get("active")).toEqual(timer);expect(await d.recovery.count()).toBe(1);
    await importBackup(before,d);expect(await d.settings.get("main")).toEqual(settings);expect(await d.notes.get("note")).toEqual(before.notes[0]);
  });
  it("round-trips new generic context evidence in v2 backups without changing old semesters",async()=>{
    const d=database();await initialize(d);const settings=demoSettings();
    settings.semester!.university={id:"generic",adapterId:"generic",name:"Custom University"};
    settings.semester!.academicContext={faculty:"Custom School",specialization:"Custom specialty",confirmed:{},detected:[]};
    await saveSettings(settings,d);const backup=await exportBackup(d);await importBackup(JSON.parse(JSON.stringify(backup)),d);
    expect(backup.version).toBe(2);expect((await d.settings.get("main"))?.semester).toEqual(settings.semester);
    const old=legacySemester("",false);expect(normalizedSemesterSchema.parse(old)).toEqual(old);expect(old.academicContext).toBeUndefined();
  });
  it("upgrades a real version-1 IndexedDB database transactionally and idempotently", async () => {
    const name = `v1-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({settings:"id",attendance:"id,date,sessionId",topics:"id,courseId",items:"id,courseId,due",notes:"id,courseId,sessionId",study:"id,courseId,date",wallpaper:"id",timer:"id"});
    const {schemaVersion: _, semester: __, onboardingComplete: ___, ...legacy} = demoSettings();
    legacy.name = "Existing student"; legacy.theme = "midnight"; legacy.schedule[0].start = "09:00";
    await old.table("settings").put(legacy);
    await old.table("notes").put({id:"n",courseId:"BSC1301",sessionId:null,date:null,text:"Keep this note",updatedAt:new Date().toISOString()});
    await old.table("timer").put({id:"active",courseId:"BSC1301",startedAt:12345,accumulated:42,note:"Keep timer"});
    old.close();
    const d = new SemesterDatabase(name); databases.push(d);
    await initialize(d); await initialize(d);
    const settings = (await d.settings.get("main"))!;
    expect(settings.semester?.origin).toBe("legacy"); expect(settings.name).toBe("Existing student");
    expect(settings.theme).toBe("midnight"); expect(settings.schedule[0].start).toBe("09:00");
    expect((await d.notes.get("n"))?.text).toBe("Keep this note"); expect((await d.timer.get("active"))?.accumulated).toBe(42);
    expect(await d.recovery.count()).toBe(1);
    expect((await d.recovery.toArray())[0].settings).toEqual(legacy);
  });
  it("retains malformed or future-version persisted state without resetting it", async () => {
    const d = database(); const raw = {...defaultSettings, schemaVersion:99};
    await d.settings.put(raw as unknown as typeof defaultSettings);
    await expect(initialize(d)).rejects.toThrow("unsupported");
    expect(await d.settings.get("main")).toEqual(raw);
  });
  it("converts old backups and includes academic data in new backups", async () => {
    const d = database(); await initialize(d); await saveSettings(demoSettings(), d);
    const modern = await exportBackup(d);
    expect(modern.version).toBe(2); expect(modern.settings.semester?.sessions).toHaveLength(11);
    const {schemaVersion: _,semester: __,onboardingComplete: ___,...legacy} = modern.settings;
    const converted = validateBackup({...modern, version:1, settings:legacy});
    expect(converted.settings.semester?.origin).toBe("legacy");
    await importBackup({...modern,version:1,settings:legacy},d);
    expect((await d.settings.get("main"))?.schedule).toEqual(legacy.schedule);
    expect(() => migrateSettings({...legacy,schedule:[]})).toThrow("safely");
  });
  it("rejects unknown record references before replacing data", async () => {
    const d=database(); await initialize(d); await saveSettings(demoSettings(),d);
    const b=await exportBackup(d);
    await expect(importBackup({...b,items:[{id:"x",courseId:"other",title:"Keep out",kind:"exam",due:null,done:false,note:"",updatedAt:new Date().toISOString()}]},d)).rejects.toThrow("Unknown course");
    expect((await d.settings.get("main"))?.semester?.origin).toBe("demo");
  });
  it("archives the entire old workspace and allows restoring it after semester changes", async () => {
    const d=database(); await initialize(d); await saveSettings(demoSettings(),d);
    await d.notes.add({id:"n",courseId:"BSC1301",sessionId:null,date:null,text:"Previous semester note",updatedAt:new Date().toISOString()});
    const next=legacySemester("New student",false); next.semester.id="next"; next.offerings.forEach(o=>o.semesterId="next");
    await activateSemester(next,"semester-1",d);
    expect(await d.notes.count()).toBe(0);
    const recovery=(await d.recovery.toArray()).find(r=>r.snapshot)!;
    await restoreRecovery(recovery.id!,d);
    expect((await d.notes.get("n"))?.text).toBe("Previous semester note");
    expect((await d.settings.get("main"))?.name).toBe("Demo Student");
    await expect(activateSemester(next,"wrong",d)).rejects.toThrow("changed");
  });
});
