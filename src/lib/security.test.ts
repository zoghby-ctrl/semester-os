import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertPlainData, imageDimensions, MAX_BACKUP_BYTES, parseBackupJson, sniffFormat, utf8Size, validateImageHeader } from "./security";
import { deleteWorkspace, exportBackup, importBackup, initialize, restoreRecovery, saveSettings, SemesterDatabase, validateBackup, validateWorkspace } from "./db";
import { defaultSettings } from "./schema";
import { demoSettings } from "./legacy";
import { inspectDocument } from "../importer/extract";
import { normalizeImport } from "../importer/normalize";
import { emptyImport, manualCourse, manualSession, parseTimetable } from "../importer/parse";
import { confirmedField } from "../importer/confidence";
import { ECUAdapter } from "../universities";
import type { ExtractionPage } from "../importer/types";
let database: SemesterDatabase;
beforeEach(async () => { database = new SemesterDatabase(`security-${crypto.randomUUID()}`); await initialize(database); await saveSettings(demoSettings(), database); });
afterEach(async () => { await database.delete(); });
const context = { name: "Student", adapterId: "ecu", program: "", level: "", semesterName: "Autumn", specialization: "", start: null, end: null };
const png = (width: number, height: number) => { const b = new Uint8Array(32); b.set([137,80,78,71,13,10,26,10]); b.set(new TextEncoder().encode("IHDR"),12); const view = new DataView(b.buffer); view.setUint32(16,width); view.setUint32(20,height); return b; };

describe("File trust boundaries", () => {
  it("rejects HTML and script content disguised as timetable formats", async () => {
    for (const name of ["t.pdf", "t.png", "t.jpg", "t.webp"]) await expect(inspectDocument(new File(["<script>alert(1)</script>"], name, { type: name.endsWith("pdf") ? "application/pdf" : "" }))).rejects.toThrow("contents");
  });
  it("rejects MIME, extension, and content mismatches before decoding", async () => {
    await expect(inspectDocument(new File(["%PDF-1.7\n"], "t.png", { type: "image/png" }))).rejects.toThrow("contents");
    await expect(inspectDocument(new File([png(100,100)], "t.png", { type: "application/pdf" }))).rejects.toThrow("contents");
    expect(await inspectDocument(new File(["%PDF-1.7\n"], "t.pdf", { type: "application/pdf" }))).toBe("application/pdf");
  });
  it("rejects image resource bombs and truncated headers before bitmap allocation", async () => {
    await expect(inspectDocument(new File([png(100000,100000)], "t.png", { type: "image/png" }))).rejects.toThrow("40 megapixels");
    expect(() => validateImageHeader(png(0,100), "image/png")).toThrow();
    expect(imageDimensions(new Uint8Array(5), "image/png")).toBeNull();
    expect(sniffFormat(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("reads WebP variants and JPEG dimensions without running document content", () => {
    const webp = new Uint8Array(32); webp.set(new TextEncoder().encode("RIFF")); webp.set(new TextEncoder().encode("WEBPVP8X"),8); new DataView(webp.buffer).setUint32(16,10,true); webp[24]=99; webp[27]=79;
    expect(sniffFormat(webp)).toBe("image/webp"); expect(imageDimensions(webp,"image/webp")).toEqual({width:100,height:80});
    const jpg = new Uint8Array([255,216,255,192,0,17,8,0,100,0,80,3]);
    expect(imageDimensions(jpg,"image/jpeg")).toEqual({width:80,height:100});
  });
  it("rejects malformed OCR geometry and excessive extractor output", () => {
    const page: ExtractionPage = { page: 1, source: "t.pdf", method: "ocr", width: 1000, height: 500, text: "CSC2105", words: [{text:"CSC2105",x:NaN,y:0,width:50,height:10,score:90}], blocks: [] };
    expect(() => parseTimetable([page],ECUAdapter)).toThrow();
    page.words[0].x=0;page.words=Array(20001).fill(page.words[0]);expect(() => parseTimetable([page],ECUAdapter)).toThrow();
  });
  it("rejects forged reviewed sessions with invalid times, IDs, or enums", () => {
    for (const patch of [{start:confirmedField("99:00")},{day:confirmedField(7)},{courseId:"javascript:alert(1)"},{type:confirmedField("script")}]) {
      const result=emptyImport("ecu"),course=manualCourse("CSC2105");course.reviewed=true;result.courses=[course];
      result.sessions=[{...manualSession(course.id),day:confirmedField(0),type:confirmedField("lecture"),start:confirmedField("08:00"),end:confirmedField("10:00"),reviewed:true,...patch} as typeof result.sessions[number]];
      expect(() => normalizeImport(result,context)).toThrow();
    }
  });
});
describe("Backup, recovery, and persistence boundaries", () => {
  it("rejects prototype pollution at any nesting level", () => {
    for (const key of ["__proto__","constructor","prototype"]) expect(() => parseBackupJson(`{"settings":{"${key}":{"polluted":true}}}`)).toThrow("Unsafe object key");
    expect(({} as {polluted?:boolean}).polluted).toBeUndefined();
  });
  it("does not execute accessor properties on hostile objects", () => {
    let executed=false;const input=Object.defineProperty({},"settings",{enumerable:true,get:()=>{executed=true;return {};}});
    expect(() => validateBackup(input)).toThrow("Executable properties");expect(executed).toBe(false);
  });
  it("rejects malformed JSON, deep nesting, cycles, and byte-size overflow", () => {
    expect(() => parseBackupJson('{"version":')).toThrow("valid JSON");
    expect(() => parseBackupJson("[".repeat(22)+"0"+"]".repeat(22))).toThrow("complex");
    const cyclic:{self?:unknown}={};cyclic.self=cyclic;expect(() => assertPlainData(cyclic)).toThrow("Circular");
    expect(() => parseBackupJson(" ".repeat(MAX_BACKUP_BYTES+1))).toThrow("100 MB");
    expect(utf8Size("aé学😀")).toBe(10);
    expect(parseBackupJson(JSON.stringify({note:'[brackets] and "quoted" text \\ end'}))).toEqual({note:'[brackets] and "quoted" text \\ end'});
  });
  it("keeps the live workspace and recovery journal unchanged after invalid backups", async () => {
    const good=await exportBackup(database);
    for (const input of [{...good,version:99},{...good,format:"wrong"},{...good,notes:{}},{...good,settings:{...good.settings,theme:"javascript:alert(1)"}},{...good,wallpaper:{name:"x.png",type:"image/png",data:btoa("<svg onload=alert(1)>")}}]) await expect(importBackup(input,database)).rejects.toThrow();
    expect(await database.settings.get("main")).toEqual(good.settings);expect(await database.recovery.count()).toBe(0);
  });
  it("rejects corrupted recovery records before replacing any current state", async () => {
    const settings=(await database.settings.get("main"))!;const id=await database.recovery.add({kind:"bad snapshot",createdAt:new Date().toISOString(),snapshot:{settings,attendance:[],topics:[],items:[],study:[],notes:[{id:"n",courseId:settings.semester!.courses[0].id,sessionId:null,date:null,text:"note",updatedAt:"invalid"}]}});
    await expect(restoreRecovery(id,database)).rejects.toThrow();expect(await database.settings.get("main")).toEqual(settings);expect(await database.recovery.count()).toBe(1);
  });
  it("keeps HTML, URL-looking strings, and strange Unicode as plain stored text", async () => {
    const good=await exportBackup(database),payload='<script>alert(1)</script><img src=x onerror=alert(2)> javascript:alert(3) 学期 🌸';
    good.settings.semester!.courses[0].name=payload;good.settings.semester!.sessions[0].room=payload.slice(0,100);good.settings.semester!.sessions[0].roomId=null;
    good.notes=[{id:"note-1",courseId:good.settings.semester!.courses[0].id,sessionId:null,date:null,text:payload,updatedAt:new Date().toISOString()}];
    await importBackup(good,database);expect((await database.notes.get("note-1"))?.text).toBe(payload);expect((await database.settings.get("main"))?.semester?.courses[0].name).toBe(payload);
  });
  it("preserves corrupt settings after a failed migration", async () => {
    const broken={...demoSettings(),schemaVersion:99};await database.settings.put(broken as unknown as typeof defaultSettings);
    await expect(initialize(database)).rejects.toThrow("unsupported");expect(await database.settings.get("main")).toEqual(broken);
  });
  it("rejects invalid persisted records and leaves them available for recovery", async () => {
    const b=await exportBackup(database);const note={id:"bad",courseId:"unknown",sessionId:null,date:null,text:"x",updatedAt:new Date().toISOString()};
    await database.notes.put(note);expect(() => validateWorkspace({...b,wallpaper:undefined,notes:[note]})).toThrow("Unknown course");expect(await database.notes.get("bad")).toEqual(note);
  });
  it("retains appearance favorites through backup restoration and reopen", async () => {
    const s=demoSettings();s.theme="black-rose";s.favoriteThemes=["black-rose","rose-orbit"];s.themeFavorites=[{id:"look-1",name:"A quiet rose",theme:"custom",customTheme:s.customTheme,atmosphere:s.atmosphere,motion:s.motion,grain:s.grain,prism:s.prism}];
    await saveSettings(s,database);const b=await exportBackup(database);await importBackup(b,database);database.close();await database.open();expect((await database.settings.get("main"))?.themeFavorites[0].name).toBe("A quiet rose");expect(await database.recovery.count()).toBe(1);
  });
  it("deletes academic and appearance data including all recovery copies on explicit deletion", async () => {
    await importBackup(await exportBackup(database),database);expect(await database.recovery.count()).toBe(1);
    await deleteWorkspace(database);expect(await database.settings.get("main")).toEqual(defaultSettings);for (const table of database.tables) if(table.name!=="settings") expect(await table.count()).toBe(0);
  });
});
