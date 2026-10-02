// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { Provider, setupNavigationHint } from "./lib/context";
import { activateSemester, db, initialize, updateSettings } from "./lib/db";
import { legacySemester } from "./lib/legacy";
import { reviewMaterialPlanPages } from "./importer/page-selection";
import type { ExtractionPage } from "./importer/types";

// The real App, Provider, setup UI, parsing, normalization and persistence run.
// Only GPU/PWA browser services and document extraction need test substitutes.
vi.mock("./components/Background", () => ({ Background: () => null }));
vi.mock("virtual:pwa-register/react", () => ({ useRegisterSW: () => ({
  needRefresh: [false], offlineReady: [false], updateServiceWorker: vi.fn(),
}) }));
vi.mock("./importer/extract", async importOriginal => ({ ...await importOriginal<typeof import("./importer/extract")>(), browserExtractor: { extract: async () => [{
  page: 1, source: "synthetic-timetable.pdf", method: "pdf-text", width: 1000, height: 700,
  text: "Saturday QA1001 Lecture 08:00–09:30 A1", blocks: [],
  words: ["Saturday", "QA1001", "Lecture", "08:00–09:30", "A1"].map((text, index) => ({
    text, x: [10, 120, 230, 340, 500][index], y: 10, width: text.length * 7, height: 12, score: null,
  })),
}] } }));

let root: Root | undefined;
let container: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    media, matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  window.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  history.replaceState(null, "", "/");
  await db.delete();
  await db.open();
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  await db.delete();
  vi.unstubAllGlobals();
});
async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    if (predicate()) return;
  }
  throw new Error("Expected UI state did not arrive");
}
async function mount(hash = "") {
  history.replaceState(null, "", "/" + hash);
  root = createRoot(container);
  await act(async () => root!.render(<Provider><App /></Provider>));
  await until(() => !!document.querySelector(".app-shell"));
  // Let the first-run hash guard finish its initial setup transition before
  // interacting with Welcome; its keyed route remount is intentional.
  if (!(await db.settings.get("main"))?.onboardingComplete) {
    await until(() => location.hash === "#setup" && document.title === "Setup · Semester OS");
  }
}
function button(label: string, scope: ParentNode = document) {
  const found = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(el =>
    (el.getAttribute("aria-label") || el.textContent?.trim()) === label);
  if (!found) throw new Error("Missing button: " + label);
  return found;
}
async function click(label: string, scope: ParentNode = document) {
  await act(async () => button(label, scope).click());
}
function inputFor(label:string) {return [...document.querySelectorAll<HTMLLabelElement>("label")].find(l=>l.textContent?.startsWith(label))!.querySelector<HTMLInputElement>("input")!;}
async function fill(label:string,value:string) {await act(async()=>{const input=inputFor(label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));});}
async function uploadTimetable(plan=false) {
  for(const [index,name] of (plan?["synthetic-timetable.pdf","synthetic-plan.pdf"]:["synthetic-timetable.pdf"]).entries()) {
    const input=document.querySelectorAll<HTMLInputElement>('input[type="file"]')[index];
    Object.defineProperty(input,"files",{value:[new File(["%PDF-1.4 synthetic fixture"],name,{type:"application/pdf"})],configurable:true});
    await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
  }
  await until(()=>!button("Read my timetable").disabled);
}
async function confirmRecords() {for(const check of [...document.querySelectorAll<HTMLLabelElement>(".review-check")]) if(/Course details checked|Session checked against/.test(check.textContent??"")) await act(async()=>check.querySelector<HTMLInputElement>("input")!.click());}
const syntheticPage=(heading:string,pageNo:number,source="synthetic-timetable.pdf",code="QA1001"):ExtractionPage=>({
  page:pageNo,source,method:"pdf-text",width:1000,height:700,text:heading+" Saturday "+code+" Lecture 08:00–09:30 A403",blocks:[],
  words:[{text:heading,x:10,y:10,width:250,height:12,score:null},...["Saturday",code,"Lecture","08:00–09:30","A403"].map((text,i)=>({text,x:[10,140,280,400,600][i],y:80,width:text.length*7,height:12,score:null}))],
});
async function openEmpty() {
  await click("Open an empty workspace");
  await until(() => location.hash === "#today" && !!document.querySelector(".study-panel"));
}
async function openDemo() {
  await click("Explore Demo Semester");
  await until(() => location.hash === "#today" && !!document.querySelector(".demo-banner") && !!document.querySelector(".study-panel"));
}
async function key(key: string, modifiers: KeyboardEventInit = {}) {
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", {
    key, bubbles: true, cancelable: true, ...modifiers,
  })));
}
async function expectNoHashChange(action: () => Promise<void>) {
  const changed = vi.fn();
  window.addEventListener("hashchange", changed);
  try {
    await action();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(location.hash).toBe("#setup");
    expect(changed).not.toHaveBeenCalled();
  } finally { window.removeEventListener("hashchange", changed); }
}

describe("First-run navigation with real setup and IndexedDB", () => {
  it("requires a deliberate university choice and keeps fresh academic fields neutral",async()=>{
    await mount();await click("Upload your timetable");
    expect(button("Egyptian Chinese University").getAttribute("aria-pressed")).toBe("false");expect(button("Another university").getAttribute("aria-pressed")).toBe("false");
    for(const label of ["Program","Faculty / school","Academic level","Semester / term"]) expect(inputFor(label).value).toBe("");
    expect(button("Enter courses & sessions manually").disabled).toBe(true);expect(button("Read my timetable").disabled).toBe(true);
    await click("Another university");expect(inputFor("University name").value).toBe("");expect(button("Enter courses & sessions manually").disabled).toBe(false);
  });
  it("keeps detected context blank until explicitly confirmed",async()=>{
    const {browserExtractor}=await import("./importer/extract");const spy=vi.spyOn(browserExtractor,"extract").mockResolvedValue([syntheticPage("Level 4 Semester 2",1)]);
    try {
      await mount();await click("Upload your timetable");await click("Another university");await uploadTimetable();await click("Read my timetable");await until(()=>!!document.querySelector(".review-content"));
      expect(document.querySelector(".context-suggestions")?.textContent).toContain("Level 4 · Semester 2");expect(inputFor("Academic level").value).toBe("");
      await click("Confirm",document.querySelector(".context-suggestion")!);expect(inputFor("Academic level").value).toBe("Level 4");expect(inputFor("Semester / term").value).toBe("Semester 2");
      await confirmRecords();await click("Generate my semester");await until(()=>!!document.querySelector(".generated-space"));
      const semester=(await db.settings.get("main"))?.semester;expect(semester?.level?.label).toBe("Level 4");expect(semester?.academicContext?.confirmed.level?.method).toBe("pdf-text");
    } finally {spy.mockRestore();}
  });
  it("can leave detected context unknown and complete a timetable-only setup",async()=>{
    const {browserExtractor}=await import("./importer/extract");const spy=vi.spyOn(browserExtractor,"extract").mockResolvedValue([syntheticPage("Level 3 Semester 2",1)]);
    try {
      await mount();await click("Upload your timetable");await click("Another university");await uploadTimetable();await click("Read my timetable");await until(()=>!!document.querySelector(".review-content"));
      await click("Leave unknown");await confirmRecords();await click("Generate my semester");await until(()=>!!document.querySelector(".generated-space"));
      const semester=(await db.settings.get("main"))?.semester;expect(semester?.level).toBeNull();expect(semester?.semester.name).toBe("My semester");expect(semester?.academicContext?.detected).toHaveLength(2);
    } finally {spy.mockRestore();}
  });
  it("blocks a wrong selected plan page until the student deliberately keeps it",async()=>{
    const {browserExtractor}=await import("./importer/extract");const timetable=syntheticPage("",1),wrong=syntheticPage("Level 2 Semester 1",4,"synthetic-plan.pdf"),other=syntheticPage("Level 1 Semester 1",9,"synthetic-plan.pdf");
    const spy=vi.spyOn(browserExtractor,"extract").mockImplementation(async(file,options)=>{
      if(file.name.includes("timetable")) return [timetable];
      options.materialPlan!.onReview!(reviewMaterialPlanPages([wrong,other],options.materialPlan!.context!,["QA1001"],options.pages));return [wrong];
    });
    try {
      await mount();await click("Upload your timetable");await click("Egyptian Chinese University");await fill("Academic level","Level 1");await fill("Semester / term","Semester 1");await uploadTimetable(true);await fill("Material plan PDF pages","4");await click("Read my timetable");await until(()=>!!document.querySelector(".plan-page-review"));
      expect(document.querySelector(".plan-page-review")?.textContent).toContain("This page appears to describe Level 2 · Semester 1, but you selected Level 1 · Semester 1");expect(document.querySelector(".plan-page-review")?.textContent).toContain("likely match on page 9");
      await confirmRecords();expect(button("Generate my semester").disabled).toBe(true);
      await click("Keep selected page");expect(button("Generate my semester").disabled).toBe(false);expect(inputFor("Academic level").value).toBe("Level 1");
      await click("Generate my semester");await until(()=>!!document.querySelector(".generated-space"));expect((await db.settings.get("main"))?.semester?.level?.label).toBe("Level 1");
      expect(spy.mock.calls[1][1].pages).toEqual([4]);
    } finally {spy.mockRestore();}
  });
  it("reads the suggested alternative only after the student chooses it",async()=>{
    const {browserExtractor}=await import("./importer/extract");const wrong=syntheticPage("Level 2 Semester 1",4,"synthetic-plan.pdf"),other=syntheticPage("Level 1 Semester 1",9,"synthetic-plan.pdf");
    const spy=vi.spyOn(browserExtractor,"extract").mockImplementation(async(file,options)=>{
      if(file.name.includes("timetable")) return [syntheticPage("",1)];
      options.materialPlan!.onReview!(reviewMaterialPlanPages([wrong,other],options.materialPlan!.context!,["QA1001"],options.pages));return options.pages?.includes(9)?[other]:[wrong];
    });
    try {
      await mount();await click("Upload your timetable");await click("Egyptian Chinese University");await fill("Academic level","Level 1");await fill("Semester / term","Semester 1");await uploadTimetable(true);await fill("Material plan PDF pages","4");await click("Read my timetable");await until(()=>!!document.querySelector(".plan-page-review"));
      await click("Use detected page");await until(()=>document.querySelector(".plan-page-review")?.textContent?.includes("selected PDF pages: 9")??false);
      expect(spy.mock.calls[2][1].pages).toEqual([9]);expect(document.querySelector(".plan-page-review [role=alert]")).toBeNull();expect(inputFor("Academic level").value).toBe("Level 1");
    } finally {spy.mockRestore();}
  });
  it("lets the student correct the university in review and removes ECU defaults",async()=>{
    const {browserExtractor}=await import("./importer/extract");const spy=vi.spyOn(browserExtractor,"extract").mockResolvedValue([syntheticPage("",1,"synthetic-timetable.pdf","CSC2105")]);
    try {
      await mount();await click("Upload your timetable");await click("Egyptian Chinese University");await uploadTimetable();await click("Read my timetable");await until(()=>!!document.querySelector(".review-content"));
      expect(inputFor("Official name").value).toBe("Artificial Intelligence");
      const select=document.querySelector<HTMLSelectElement>(".academic-context-editor select")!;await act(async()=>{select.value="generic";select.dispatchEvent(new Event("change",{bubbles:true}));});
      expect(inputFor("Official name").value).toBe("");expect(inputFor("Credit hours").value).toBe("");await fill("University name","Cairo University");await fill("Official name","My official title");await confirmRecords();await click("Generate my semester");await until(()=>!!document.querySelector(".generated-space"));
      expect((await db.settings.get("main"))?.semester?.university).toMatchObject({adapterId:"generic",name:"Cairo University"});
    } finally {spy.mockRestore();}
  });
  it("manual setup supports a custom university with unknown level and term",async()=>{
    await mount();await click("Upload your timetable");await click("Another university");await fill("University name","Custom University");await click("Enter courses & sessions manually");await click("Add course");await fill("Course code","ART101");await fill("Official name","Studio Practice");await click("Add session");
    for(const [label,value] of [["Weekday","5"],["Session type","tutorial"]]) {
      const select=[...document.querySelectorAll("label")].find(l=>l.textContent?.startsWith(label))!.querySelector("select")!;
      await act(async()=>{select.value=value;select.dispatchEvent(new Event("change",{bubbles:true}));});
    }
    await fill("Starts","14:00");await fill("Ends","16:00");await confirmRecords();expect(button("Generate my semester").disabled).toBe(false);
    await click("Generate my semester");await until(()=>!!document.querySelector(".generated-space"));const semester=(await db.settings.get("main"))?.semester;
    expect(semester).toMatchObject({origin:"manual",level:null,program:null,university:{name:"Custom University"},semester:{name:"My semester"}});expect(semester?.sessions).toHaveLength(1);
  });
  it("demo context does not initialize a subsequent real import",async()=>{
    await initialize();await activateSemester(legacySemester("Demo Student",true),null);await mount("#setup");await click("Upload your timetable");
    expect(button("Egyptian Chinese University").getAttribute("aria-pressed")).toBe("false");expect(inputFor("Your name").value).toBe("");expect(inputFor("Academic level").value).toBe("");expect(inputFor("Program").value).toBe("");
  });
  it("makes workflow help accessible before setup without unlocking navigation", async () => {
    await mount(); await click("Help & getting started");
    const dialog=document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Record or correct attendance");
    expect(dialog.textContent).toContain("Automatic missed classification is off");
    expect(dialog.textContent).toContain("Data & backup");
    expect(location.hash).toBe("#setup");
    expect(button("Today").getAttribute("aria-disabled")).toBe("true");
    await click("Close dialog",dialog);
  });
  it("keeps the guide available for empty/demo workspaces and reflects actual attendance preferences", async () => {
    await mount(); await openEmpty();
    expect(document.querySelector(".workflow-guide.panel")?.textContent).toContain("How to use Semester OS");
    await act(async()=>{await updateSettings({graceMinutes:10,autoMissed:true,trackingSince:"2026-10-01"});});
    await until(()=>!!document.querySelector(".workflow-guide.panel")?.textContent?.includes("10-minute grace period"));
    expect(document.querySelector(".workflow-guide.panel")?.textContent).toContain("Automatic missed classification is on");
  });
  it("forwards chosen plan pages and timetable codes to the local extractor", async () => {
    const {browserExtractor}=await import("./importer/extract");
    const spy=vi.spyOn(browserExtractor,"extract");
    try {
      await mount();await click("Upload your timetable");await click("Egyptian Chinese University");
      for (const [i,name] of ["synthetic-timetable.pdf","synthetic-plan.pdf"].entries()) {
        const input=document.querySelectorAll<HTMLInputElement>('input[type="file"]')[i];
        Object.defineProperty(input,"files",{value:[new File(["%PDF-1.4 test"],name,{type:"application/pdf"})]});
        await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
      }
      await until(()=>!![...document.querySelectorAll("label")].find(l=>l.textContent?.startsWith("Material plan PDF pages")));
      const range=[...document.querySelectorAll("label")].find(l=>l.textContent?.startsWith("Material plan PDF pages"))!.querySelector("input")!;
      await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(range,"4-5");range.dispatchEvent(new Event("input",{bubbles:true}));});
      await click("Read my timetable");await until(()=>!!document.querySelector(".review-content"));
      expect(spy.mock.calls[1][1]).toMatchObject({pages:[4,5],materialPlan:{adapterId:"ecu",courseCodes:["QA1001"]}});
    } finally {spy.mockRestore();}
  });
  it("explains check-ins while preserving save, correction, and clear actions", async () => {
    await mount();await openDemo();await click("Schedule");
    await until(()=>!!document.querySelector(".schedule-block"));
    await click("Previous week");
    const openFirst=async()=>{await act(async()=>document.querySelector<HTMLButtonElement>(".schedule-block")!.click());await until(()=>!!document.querySelector('[role="dialog"]'));};
    await openFirst();
    let dialog=document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("suggested time is the scheduled start");
    expect(dialog.textContent).toContain("excused is excluded");
    await click("Save attendance",dialog);
    await until(()=>!document.querySelector('[role="dialog"]'));
    expect(await db.attendance.count()).toBe(1);
    await openFirst();dialog=document.querySelector('[role="dialog"]')!;
    const select=dialog.querySelector("select")!;
    await act(async()=>{select.value="excused";select.dispatchEvent(new Event("change",{bubbles:true}));});
    await click("Save attendance",dialog);await until(()=>!document.querySelector('[role="dialog"]'));
    expect((await db.attendance.toArray())[0].status).toBe("excused");
    expect(await db.attendance.count()).toBe(1);
    await openFirst();await click("Clear record",document.querySelector('[role="dialog"]')!);
    await until(()=>!document.querySelector('[role="dialog"]'));
    expect(await db.attendance.count()).toBe(0);
  });
  it("starts a fresh user on Setup with workspace navigation explicitly unavailable", async () => {
    await mount();
    await until(() => location.hash === "#setup");
    expect(button("Setup").getAttribute("aria-current")).toBe("page");
    for (const label of ["Today", "Schedule", "Courses", "Progress", "Planner", "Settings"]) {
      const item = button(label);
      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(item.getAttribute("title")).toBe(setupNavigationHint);
      expect(document.getElementById(item.getAttribute("aria-describedby")!)?.textContent).toBe(setupNavigationHint);
    }
    expect((await db.settings.get("main"))?.onboardingComplete).toBe(false);
  });
  for (const label of ["Today", "Schedule"]) it("does not change the hash for locked " + label + " on desktop or mobile", async () => {
    await mount();
    await until(() => location.hash === "#setup");
    const changed = vi.fn();
    window.addEventListener("hashchange", changed);
    try {
      await click(label, document.querySelector(".sidebar")!);
      await click(label, document.querySelector(".bottom-nav")!);
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
      expect(location.hash).toBe("#setup");
      expect(changed).not.toHaveBeenCalled();
    } finally { window.removeEventListener("hashchange", changed); }
  });
  it("keeps brand/home on the same setup hash", async () => {
    await mount();
    await until(() => location.hash === "#setup");
    expect(button("Semester OS home").getAttribute("aria-disabled")).toBe("true");
    await expectNoHashChange(() => click("Semester OS home"));
  });
  it("keeps all six Alt workspace shortcuts on Setup", async () => {
    await mount();
    await until(() => location.hash === "#setup");
    await expectNoHashChange(async () => {
      for (const number of ["1", "2", "3", "4", "5", "6"]) await key(number, { altKey: true });
    });
  });
  it("disables workspace palette commands and keeps Setup selectable", async () => {
    await mount();
    await until(() => location.hash === "#setup");
    await key("k", { ctrlKey: true });
    await until(() => !!document.querySelector("[cmdk-root]"));
    const today = document.querySelector<HTMLElement>('[cmdk-item][data-value="Today page"]')!;
    expect(today.getAttribute("aria-disabled")).toBe("true");
    expect(document.querySelector('[cmdk-item][data-value="Setup page"]')?.getAttribute("aria-disabled")).toBe("false");
    await expectNoHashChange(async () => {
      await act(async () => today.click());
      await key("ArrowDown");
      await key("Enter");
    });
    await key("Escape");
  });
  it("Open an empty workspace saves onboarding completion", async () => {
    await mount(); await openEmpty();
    const settings = await db.settings.get("main");
    expect(settings?.onboardingComplete).toBe(true);
    expect(settings?.semester).toBeNull();
  });
  it("Open an empty workspace lands on Today", async () => {
    await mount(); await openEmpty();
    expect(location.hash).toBe("#today");
    expect(document.querySelector(".welcome-space")).toBeNull();
  });
  it("Demo Semester saves onboarding completion and its labelled origin", async () => {
    await mount(); await openDemo();
    const settings = await db.settings.get("main");
    expect(settings?.onboardingComplete).toBe(true);
    expect(settings?.semester?.origin).toBe("demo");
  });
  it("Demo Semester lands on Today", async () => {
    await mount(); await openDemo();
    expect(location.hash).toBe("#today");
    expect(document.querySelector(".study-panel")).not.toBeNull();
  });
  it("a reviewed timetable generates a semester, unlocks navigation and enters Today", async () => {
    await mount(); await click("Upload your timetable");
    await click("Another university");
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new File(["%PDF-1.4 synthetic fixture"], "synthetic-timetable.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await until(() => !button("Read my timetable").disabled);
    await click("Read my timetable");
    await until(() => !!document.querySelector(".review-content"));
    expect(document.querySelectorAll(".review-card")).toHaveLength(2);
    for (const label of [...document.querySelectorAll<HTMLLabelElement>(".review-check")]) {
      if (/Course details checked|Session checked against/.test(label.textContent || "")) {
        await act(async () => label.querySelector<HTMLInputElement>("input")!.click());
      }
    }
    expect(button("Generate my semester").disabled).toBe(false);
    await click("Generate my semester");
    await until(() => !!document.querySelector(".generated-space") && button("Today").getAttribute("aria-disabled") === null);
    const settings = await db.settings.get("main");
    expect(settings?.onboardingComplete).toBe(true);
    expect(settings?.semester?.courses[0].code).toBe("QA1001");
    await click("Enter your semester");
    await until(() => location.hash === "#today");
  });
  it("unlocks navigation immediately after completion without a reload", async () => {
    await mount(); await openEmpty();
    expect(button("Schedule").getAttribute("aria-disabled")).toBeNull();
    expect(button("Semester OS home").getAttribute("aria-disabled")).toBeNull();
    await click("Schedule");
    await until(() => location.hash === "#schedule");
    expect(button("Schedule").getAttribute("aria-current")).toBe("page");
  });
  it("preserves completion when the app remounts after refresh", async () => {
    await mount(); await openEmpty();
    await act(async () => root!.unmount()); root = undefined;
    await mount("#today");
    expect((await db.settings.get("main"))?.onboardingComplete).toBe(true);
    expect(location.hash).toBe("#today");
    expect(button("Today").getAttribute("aria-disabled")).toBeNull();
  });
  it("keeps normal navigation and shortcuts available for an existing user visiting Setup", async () => {
    await initialize(); await activateSemester(legacySemester("", true), null);
    await mount("#setup");
    expect(button("Courses").getAttribute("aria-disabled")).toBeNull();
    await click("Courses"); await until(() => location.hash === "#courses");
    await key("2", { altKey: true }); await until(() => location.hash === "#schedule");
    await click("Semester OS home"); await until(() => location.hash === "#today");
  });
  it("retains the onboarding gate for a direct workspace URL", async () => {
    await mount("#schedule");
    await until(() => location.hash === "#setup");
    expect(document.querySelector(".welcome-space")).not.toBeNull();
  });
  it("keeps upload and public policy links available before onboarding", async () => {
    await mount();
    expect(document.querySelector('a[href="/privacy"]')).not.toBeNull();
    expect(document.querySelector('a[href="/terms"]')).not.toBeNull();
    await click("Upload your timetable");
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(2);
    expect(location.hash).toBe("#setup");
    expect((await db.settings.get("main"))?.onboardingComplete).toBe(false);
    await click("Back");
    expect(button("Explore Demo Semester")).not.toBeNull();
    expect(button("Open an empty workspace")).not.toBeNull();
  });
});
