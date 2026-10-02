import { describe, expect, it, vi } from "vitest";
import { getThemeDefinition, signatureThemes } from "./definitions";
import { defaultCustomTheme, motionEnvironments } from "./schema";
import { cloudNoise, createWorldParticles, daylightAt, distantEvent, focusBreath, gridPoint, midnightTwinkle, noise2, particlePosition, ribbonHeight, worldDelta, worldKind, worldParticleCount } from "./worlds";
import { dispatchWorldFrames, nextWorldFrameDelay, registerWorldClient, worldLoopStats, type WorldFrameClient } from "./worldLoop";

describe("Distinct calm theme worlds", () => {
  it("assigns a distinct movement language to every non-Prism curated world", () => {
    const worlds = signatureThemes.filter(theme => theme.id !== "prism").map(theme => worldKind(theme));
    expect(worlds).toHaveLength(12);
    expect(new Set(worlds).size).toBe(12);
    for (const environment of motionEnvironments) {
      const custom = { ...defaultCustomTheme, environment };
      expect(worldKind(getThemeDefinition("custom", custom), custom)).toBe(environment);
    }
  });
  it("uses continuous deterministic advected noise with independent cloud layers", () => {
    expect(noise2(-.001, .6)).toBeCloseTo(noise2(.001, .6), 4);
    for (let i = 0; i < 40; i++) {
      const value = cloudNoise(i * .153, i * .031, i * .37, i % 3);
      expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
    }
    expect(cloudNoise(.32, .7, 14, 0)).not.toBe(cloudNoise(.32, .7, 14, 1));
    expect(cloudNoise(.32, .7, 14)).not.toBe(cloudNoise(.32, .7, 15));
    expect(cloudNoise(.32, .7, 14)).toBe(cloudNoise(.32, .7, 14));
  });
  it("preserves particle pools through quality reductions and gives depth genuine movement", () => {
    const pool = createWorldParticles(60);
    expect(createWorldParticles(20)).toEqual(pool.slice(0, 20));
    const theme = getThemeDefinition("black-rose");
    const count = worldParticleCount(theme, "fragments", 100, false, false);
    expect(count).toBeLessThanOrEqual(theme.performance.desktopParticles);
    expect(worldParticleCount(theme, "fragments", 100, true, false)).toBeLessThan(count);
    expect(worldParticleCount(theme, "fragments", 100, false, false, .4)).toBeLessThan(count);
    expect(worldParticleCount(theme, "fragments", 0, false, false)).toBe(0);
    const p = { ...pool[0], x: .2, y: .3, depth: 1 };
    const near = particlePosition(p, "fragments", 4, 100);
    const flat = particlePosition(p, "fragments", 4, 0);
    expect(near.x - p.x).toBeGreaterThan(flat.x - p.x);
    expect(particlePosition(p, "fragments", 0)).not.toEqual(near);
  });
  it("uses opposing curved orbits and independent aurora folds", () => {
    const p = createWorldParticles(1)[0];
    const clockwise = { ...p, group: 0 }, counter = { ...p, group: 1 };
    expect(particlePosition(clockwise, "orbit", 2).angle - particlePosition(clockwise, "orbit", 0).angle).toBeGreaterThan(0);
    expect(particlePosition(counter, "orbit", 2).angle - particlePosition(counter, "orbit", 0).angle).toBeLessThan(0);
    const speeds = [0, 1, 2, 3].map(layer => ribbonHeight(.4, 30, layer, true) - ribbonHeight(.4, 29, layer, true));
    expect(new Set(speeds).size).toBe(4);
    expect(speeds.some(speed => speed > 0)).toBe(true);
    expect(speeds.some(speed => speed < 0)).toBe(true);
  });
  it("keeps Midnight's satellite rare and suppresses every travel event when paused", () => {
    expect(distantEvent("night", 100, false)).toBeNull();
    expect(distantEvent("night", 168, false)?.progress).toBeCloseTo(.5);
    expect(distantEvent("night", 168, true)).toBeNull();
    expect(distantEvent("fragments", 101, false)?.progress).toBeCloseTo(.5);
    expect(distantEvent("cherry", 36, false)?.progress).toBeCloseTo(.5);
    expect(distantEvent("focus", 168, false)).toBeNull();
    for (const kind of ["night", "fragments", "cherry"] as const) expect(distantEvent(kind, 168, true)).toBeNull();
  });
  it("projects grid intersections toward a stable horizon and moves depth slowly", () => {
    const horizon = gridPoint(0, 0, 0), middle = gridPoint(0, 6, 0), near = gridPoint(0, 12, 0);
    expect(horizon.y).toBe(.39);
    expect(middle.y - horizon.y).toBeLessThan(near.y - middle.y);
    expect(Math.abs(gridPoint(6, 6, 1).y - gridPoint(6, 6, 0).y)).toBeLessThan(.003);
    expect(gridPoint(6, 6, 0).x).toBe(.5);
  });
  it("keeps Focus particle-free with a visible, slow three-minute breathing range", () => {
    expect(worldParticleCount(getThemeDefinition("focus"), "focus", 100, false, false)).toBe(0);
    expect(focusBreath(0)).toBeCloseTo(focusBreath(180));
    expect(focusBreath(45) - focusBreath(135)).toBeCloseTo(.12);
    expect(Math.abs(focusBreath(1) - focusBreath(0))).toBeLessThan(.0022);
  });
  it("keeps Midnight twinkle bounded, independent across depths, and still when paused", () => {
    const stars = createWorldParticles(9);
    for (const star of stars) {
      const values = Array.from({length:120}, (_, time) => midnightTwinkle(star, time, false));
      expect(Math.min(...values)).toBeGreaterThanOrEqual(.2);
      expect(Math.max(...values)).toBeLessThanOrEqual(.98);
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(.5);
      expect(midnightTwinkle(star, 0, true)).toBe(midnightTwinkle(star, 100, true));
    }
    expect(midnightTwinkle(stars[0], 12, false)).not.toBe(midnightTwinkle(stars[1], 12, false));
  });
  it("bounds Campus illumination and lets motes cross moving daylight instead of staying fully lit", () => {
    const samples = [0, 30, 90, 240].map(time => daylightAt(.4, .3, time));
    for (const value of samples) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(.1);
    expect(daylightAt(.4, .3, 0)).toBeGreaterThan(daylightAt(0, 1, 0));
  });
});

describe("Shared world frame dispatch and resume", () => {
  it("retries an early Focus frame at its remaining deadline instead of skipping a whole period", () => {
    const frames: number[] = [];
    const client: WorldFrameClient = { active: true, fps: 3, last: 0, draw: (_, dt) => frames.push(dt) };
    expect(nextWorldFrameDelay([client], 1000)).toBe(0);
    dispatchWorldFrames([client], 1000, false);
    dispatchWorldFrames([client], 1331, false);
    expect(frames).toEqual([0]);
    expect(nextWorldFrameDelay([client], 1331)).toBeCloseTo(2.333);
    dispatchWorldFrames([client], 1348, false);
    expect(frames).toHaveLength(2); expect(frames[1]).toBeCloseTo(.348);
  });
  it("dispatches several scenes through one clock while respecting individual frame rates", () => {
    const fastFrames: number[] = [], slowFrames: number[] = [];
    const clients: WorldFrameClient[] = [
      { active: true, fps: 30, last: 0, draw: (_, dt) => fastFrames.push(dt) },
      { active: true, fps: 3, last: 0, draw: (_, dt) => slowFrames.push(dt) },
    ];
    for (let stamp = 1000; stamp <= 2000; stamp += 1000 / 60) dispatchWorldFrames(clients, stamp, false);
    expect(fastFrames.length).toBeGreaterThan(slowFrames.length * 4);
    expect(fastFrames[0]).toBe(0); expect(slowFrames[0]).toBe(0);
    expect(slowFrames[1]).toBeCloseTo(1 / 3, 2);
  });
  it("pauses both hidden and inactive scenes without a simulation jump on resume", () => {
    const deltas: number[] = [];
    const client: WorldFrameClient = { active: true, fps: 30, last: 0, draw: (_, dt) => deltas.push(dt) };
    dispatchWorldFrames([client], 1000, false); dispatchWorldFrames([client], 1040, false);
    dispatchWorldFrames([client], 5000, true); dispatchWorldFrames([client], 3600000, false);
    expect(deltas).toEqual([0, .04, 0]);
    client.active = false; dispatchWorldFrames([client], 3601000, false);
    client.active = true; dispatchWorldFrames([client], 7200000, false);
    expect(deltas.at(-1)).toBe(0);
    expect(worldDelta(Infinity)).toBe(0); expect(worldDelta(-10)).toBe(0); expect(worldDelta(3600)).toBe(.05);
  });
  it("bounds suspension gaps and keeps moving through sustained slow visible frames", () => {
    for (const fps of [30, 3]) {
      const deltas: number[] = [];
      const client: WorldFrameClient = { active: true, fps, last: 0, draw: (_, dt) => deltas.push(dt) };
      dispatchWorldFrames([client], 1000, false);
      dispatchWorldFrames([client], 2000, false);
      expect(deltas).toEqual([0, .05]);
      dispatchWorldFrames([client], 2000 + 1000 / fps, false);
      expect(deltas.at(-1)).toBeCloseTo(1 / fps);
      dispatchWorldFrames([client], 5000, false);
      dispatchWorldFrames([client], 6000, false);
      expect(deltas.slice(-2)).toEqual([.05, .05]);
    }
  });
  it("pools one browser loop and listener set and disposes them after repeated switches", () => {
    const addDocument = vi.fn(), removeDocument = vi.fn(), addWindow = vi.fn(), removeWindow = vi.fn();
    const setTimer = vi.fn(() => 11), cancelFrame = vi.fn(), clearTimer = vi.fn();
    vi.stubGlobal("document", { hidden: false, addEventListener: addDocument, removeEventListener: removeDocument });
    vi.stubGlobal("window", { addEventListener: addWindow, removeEventListener: removeWindow, setTimeout: setTimer });
    vi.stubGlobal("cancelAnimationFrame", cancelFrame); vi.stubGlobal("clearTimeout", clearTimer);
    const removeClients: Array<() => void> = [];
    try {
      for (let cycle = 0; cycle < 20; cycle++) {
        const main: WorldFrameClient = { active: true, fps: 30, last: 0, draw: () => {} };
        const preview: WorldFrameClient = { active: true, fps: 18, last: 0, draw: () => {} };
        const removeMain = registerWorldClient(main), removePreview = registerWorldClient(preview);
        removeClients.push(removeMain, removePreview);
        expect(worldLoopStats()).toEqual({ clients: 2, active: 2, loops: 1, listeners: 3 });
        expect(setTimer).toHaveBeenCalledTimes(cycle + 1);
        removeMain();
        expect(worldLoopStats().clients).toBe(1);
        removePreview();
        expect(worldLoopStats()).toEqual({ clients: 0, active: 0, loops: 0, listeners: 0 });
      }
      expect(addDocument).toHaveBeenCalledTimes(40); expect(removeDocument).toHaveBeenCalledTimes(40);
      expect(addWindow).toHaveBeenCalledTimes(20); expect(removeWindow).toHaveBeenCalledTimes(20);
      expect(clearTimer).toHaveBeenCalledTimes(20);
    } finally {
      removeClients.forEach(remove => remove());
      vi.unstubAllGlobals();
    }
  });
});
