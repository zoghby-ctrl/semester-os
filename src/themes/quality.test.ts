import { describe, expect, it } from "vitest";
import { AdaptiveQuality, visualQualityProfile } from "./quality";
import { atmosphereSchema, customThemeSchema, defaultCustomTheme, motionEnvironments } from "./schema";
import { defaultSettings, settingsSchema } from "../lib/schema";

describe("Local visual quality and compatible preferences", () => {
  it("reduces particles, effects, detail, DPR, then distant effects in order", () => {
    const keys = ["particleScale", "effectScale", "detailScale", "dprScale", "distantScale"] as const;
    for (let stage = 1; stage <= 5; stage++) {
      const before = visualQualityProfile("auto", stage - 1), after = visualQualityProfile("auto", stage);
      expect(after[keys[stage - 1]]).toBeLessThan(before[keys[stage - 1]]);
      for (const key of keys.filter(k => k !== keys[stage - 1])) expect(after[key]).toBe(before[key]);
    }
    expect(visualQualityProfile("auto", 5).particleScale).toBeGreaterThan(0);
  });
  it("requires sustained slow windows and ignores invalid or isolated suspension samples", () => {
    const adaptive = new AdaptiveQuality();
    for (const interval of [0, -1, NaN, Infinity]) adaptive.observe(25, interval, 33);
    adaptive.observe(1, 4000, 33);
    expect(adaptive.stage).toBe(0);
    const sustained = new AdaptiveQuality();
    for (let i = 0; i < 179; i++) expect(sustained.observe(20, 33, 33)).toBe(false);
    expect(sustained.observe(20, 33, 33)).toBe(true);
    expect(sustained.stage).toBe(1);
    for (let i = 0; i < 1000; i++) sustained.observe(2, 34, 33);
    expect(sustained.stage).toBe(1);
  });
  it("adapts to sustained severe visible slowdown and sporadic expensive atmosphere frames", () => {
    const severe = new AdaptiveQuality();
    for (let i = 0; i < 16; i++) severe.observe(400, 700, 33);
    expect(severe.stage).toBe(1);
    const intermittent = new AdaptiveQuality();
    for (let i = 0; i < 16; i++) {
      intermittent.observe(230, 300, 33);
      for (let j = 0; j < 4; j++) intermittent.observe(1, 33, 33);
    }
    expect(intermittent.stage).toBeGreaterThan(0);
  });
  it("manual levels stay fixed; previews and compact displays have lower frame budgets", () => {
    for (const level of ["low", "medium", "high", "ultra"] as const) expect(visualQualityProfile(level, 5)).toEqual(visualQualityProfile(level));
    expect(visualQualityProfile("auto", 0, true).fps).toBeLessThan(visualQualityProfile("auto").fps);
    expect(visualQualityProfile("auto", 0, false, true).fps).toBe(20);
  });
  it("loads older saved looks with inferred environments and friendly control defaults", () => {
    const { environment: _env, ...old } = defaultCustomTheme;
    expect(customThemeSchema.parse({ ...old, animation: "waves" }).environment).toBe("caustics");
    expect(customThemeSchema.parse({ ...old, animation: "none" }).environment).toBe("none");
    const { speed: _speed, depth: _depth, ...atmosphere } = defaultSettings.atmosphere;
    expect(atmosphereSchema.parse(atmosphere)).toMatchObject({ speed: 50, depth: 50 });
    const { visualQuality: _quality, ...settings } = defaultSettings;
    expect(settingsSchema.parse(settings).visualQuality).toBe("auto");
    for (const environment of motionEnvironments) expect(customThemeSchema.parse({ ...old, environment }).environment).toBe(environment);
    expect(atmosphereSchema.safeParse({ ...atmosphere, speed: 101 }).success).toBe(false);
  });
});
