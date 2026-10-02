// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { Provider, setupNavigationHint } from "./lib/context";
import { activateSemester, db, initialize, updateSettings } from "./lib/db";
import { legacySemester } from "./lib/legacy";

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
      await mount();await click("Upload your timetable");
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
