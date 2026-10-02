import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { themeIds } from "./schema";
import { getThemeMotion, motionTokenNames, progressFraction, themeMotionTokens } from "./motion";
const uiStyles = readFileSync(new URL("../themes.css", import.meta.url), "utf8");

describe("Theme-aware information-layer motion", () => {
  it("gives every curated world a distinct UI identity with a real CSS treatment", () => {
    const curated = themeIds.filter(id => id !== "custom").map(id => getThemeMotion(id));
    expect(new Set(curated.map(m => m.identity)).size).toBe(13);
    for (const m of curated) {
      expect(uiStyles).toContain(`@keyframes ${m.card.effect}`);
      expect(uiStyles).toContain(`@keyframes ${m.page.effect}`);
      expect(m.surfaceLight).not.toBe("none");
    }
  });
  it("keeps decorative route entry short and tactile motion restrained", () => {
    for (const id of themeIds) {
      const m = getThemeMotion(id);
      expect(m.page.enter).toBeGreaterThan(0);
      expect(m.page.enter).toBeLessThanOrEqual(.3);
      expect(m.button.duration).toBeLessThanOrEqual(.18);
      expect(m.button.press).toBeGreaterThanOrEqual(.97);
      expect(m.button.press).toBeLessThanOrEqual(1);
      expect(m.modal.enter).toBeLessThanOrEqual(.18);
      expect(m.modal.scale).toBeGreaterThanOrEqual(.97);
    }
  });
  it("limits physical lift to Campus and keeps Focus fast and precise", () => {
    expect(getThemeMotion("campus").card.hover).toBe(-2);
    expect(themeIds.filter(id => getThemeMotion(id).card.hover !== 0)).toEqual(["campus"]);
    const focus = getThemeMotion("focus");
    expect(focus.page.enter).toBeLessThanOrEqual(.1);
    expect(focus.button.press).toBeGreaterThanOrEqual(.995);
    expect(focus.toast.travel).toBeLessThanOrEqual(2);
  });
  it("uses the chosen custom environment for interaction while retaining the student's accent", () => {
    for (const [environment, identity] of [["orbit", "orbit"], ["nebula", "nebula"], ["grid", "data"], ["fragments", "rose"], ["none", "focus"]] as const) {
      const m = getThemeMotion("custom", false, environment);
      expect(m.identity).toBe(identity);
      expect(m.surfaceLight).toContain("var(--accent)");
      expect(uiStyles).toContain(`@keyframes ${m.page.effect}`);
    }
  });
  it("eliminates travel and timing while keeping static theme identity for Reduced Motion", () => {
    for (const id of themeIds) {
      const active = getThemeMotion(id), reduced = getThemeMotion(id, true);
      expect(reduced.identity).toBe(active.identity);
      expect(reduced.surfaceLight).toBe(active.surfaceLight);
      expect([reduced.card.enter, reduced.card.hover, reduced.button.duration, reduced.page.enter, reduced.modal.enter, reduced.nav.active, reduced.progress.change, reduced.toast.enter, reduced.toast.travel]).toEqual(Array(9).fill(0));
      expect([reduced.card.press, reduced.button.press, reduced.modal.scale]).toEqual([1, 1, 1]);
      expect([reduced.card.effect, reduced.page.effect, reduced.nav.effect]).toEqual(["none", "none", "none"]);
    }
  });
  it("always replaces the entire token set so switching themes cannot retain stale movement", () => {
    for (const id of themeIds) for (const reduced of [false, true]) {
      const tokens = themeMotionTokens(getThemeMotion(id, reduced)) as Record<string, string | number>;
      expect(Object.keys(tokens).sort()).toEqual([...motionTokenNames].sort());
      expect(Object.values(tokens).every(value => value !== undefined && !String(value).includes("NaN"))).toBe(true);
    }
  });
  it("pauses academic and route decorations when the document is hidden", () => {
    for (const selector of [".page-transition::after", ".now-line::after", ".status-dot", ".timer-display::before", ".toast::after"]) {
      expect(uiStyles).toContain(`html[data-page-hidden="true"] ${selector}`);
    }
    expect(uiStyles).toContain("animation-play-state:paused!important");
  });
  it("protects progress semantics from impossible and non-finite inputs", () => {
    expect([-10, 0, 25, 100, 200, NaN, Infinity, -Infinity].map(progressFraction)).toEqual([0, 0, .25, 1, 1, 0, 0, 0]);
  });
});
