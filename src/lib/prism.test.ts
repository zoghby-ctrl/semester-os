import { describe, expect, it } from "vitest";
import {
  createStarField,
  starCount,
  frameDelta,
  driftIntensity,
} from "./prism";
import {
  defaultPrismSettings,
  defaultSettings,
  settingsSchema,
} from "./schema";

describe("Prism scene budgets and continuity", () => {
  it("caps density for desktop and mobile and keeps zero density empty", () => {
    expect(starCount(100, false)).toBe(1100);
    expect(starCount(100, true)).toBe(700);
    expect(starCount(0, false)).toBe(0);
    expect(starCount(1000, false)).toBe(1100);
  });
  it("preserves existing stars when density increases and keeps three real depth layers", () => {
    const low = createStarField(20, 1.6);
    const high = createStarField(70, 1.6);
    expect(Array.from(high.positions.slice(0, low.positions.length))).toEqual(
      Array.from(low.positions),
    );
    const distances = Array.from(
      { length: low.count },
      (_, i) => 8 - low.positions[i * 3 + 2],
    );
    expect(distances.some((d) => d <= 24)).toBe(true);
    expect(distances.some((d) => d >= 28 && d <= 48)).toBe(true);
    expect(distances.some((d) => d >= 55)).toBe(true);
    expect(Array.from(high.colors).every((c) => c >= 0.74 && c <= 1)).toBe(
      true,
    );
  });
  it("rescales the same sky for aspect ratio changes without reshuffling it", () => {
    const landscape = createStarField(32, 1.6);
    const portrait = createStarField(32, 0.5);
    expect(landscape.screen).toEqual(portrait.screen);
    expect(landscape.phases).toEqual(portrait.phases);
    expect(landscape.positions[0] / portrait.positions[0]).toBeCloseTo(3.2);
  });
});
describe("Safe ambient motion", () => {
  it("clamps stalls and excludes invalid or negative deltas", () => {
    expect(frameDelta(3600)).toBe(0.075);
    expect(frameDelta(0.04)).toBe(0.04);
    for (const dt of [-1, NaN, Infinity]) expect(frameDelta(dt)).toBe(0);
  });
  it("separates continuous drift from parallax and respects drift and motion Off", () => {
    expect(driftIntensity("off", 100)).toBe(0);
    expect(driftIntensity("normal", 0)).toBe(0);
    expect(driftIntensity("normal", 35)).toBeCloseTo(0.61);
    expect(driftIntensity("subtle", 35)).toBeCloseTo(0.244);
    expect(new Set(createStarField(32, 1.6).layers)).toEqual(
      new Set([0, 1, 2]),
    );
  });
});
describe("Prism settings compatibility", () => {
  it("gives old settings and backups new defaults without changing the existing timetable", () => {
    const legacy = {
      ...defaultSettings,
      prism: undefined,
      name: "Ahmed",
      theme: "aurora",
    };
    const migrated = settingsSchema.parse(legacy);
    expect(migrated.prism).toEqual(defaultPrismSettings);
    expect(migrated.schedule).toEqual(legacy.schedule);
    expect(migrated.theme).toBe("aurora");
  });
  it("rejects unsafe density, dimming and frequency values from backups", () => {
    for (const patch of [
      { density: 101 },
      { shootingFrequency: 0 },
      { dim: 100 },
      { brightness: -1 },
      { blur: 20 },
      { drift: "fast" },
    ])
      expect(
        settingsSchema.safeParse({
          ...defaultSettings,
          prism: { ...defaultPrismSettings, ...patch },
        }).success,
      ).toBe(false);
  });
  it("adds drift to existing Prism preferences without overriding their controls", () => {
    const { drift: _, ...prism } = defaultPrismSettings;
    const parsed = settingsSchema.parse({
      ...defaultSettings,
      prism: { ...prism, parallax: 0, brightness: 42 },
    });
    expect(parsed.prism.drift).toBe("normal");
    expect(parsed.prism.parallax).toBe(0);
    expect(parsed.prism.brightness).toBe(42);
  });
});
