import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { seededRandom } from "./prism";
import {
  defaultPrismSettings,
  defaultSettings,
  settingsSchema,
} from "./schema";
import {
  createMeteorPool,
  frustumAtDepth,
  meteorBounds,
  meteorHasExited,
  meteorIntersects,
  MeteorShower,
  showerConfig,
  spawnMeteor,
  METEOR_CAPACITY,
  type ShowerMode,
} from "./meteors";

const camera = (aspect = 1.6) => new PerspectiveCamera(50, aspect, 0.1, 140);
const projection = camera().projectionMatrix.elements;

describe("Camera-derived meteor bounds", () => {
  it("matches the actual camera's clip planes at every depth, aspect, zoom and view offset", () => {
    for (const aspect of [0.45, 1, 1.6, 2.4]) {
      const c = camera(aspect);
      c.zoom = 1.3;
      c.setViewOffset(1600, 1000, 120, 80, 1100, 760);
      c.updateProjectionMatrix();
      for (const depth of [18, 38, 80]) {
        const b = frustumAtDepth(c.projectionMatrix.elements, depth);
        const low = new Vector3(b.left, b.bottom, -depth).project(c);
        const high = new Vector3(b.right, b.top, -depth).project(c);
        expect(low.x).toBeCloseTo(-1);
        expect(low.y).toBeCloseTo(-1);
        expect(high.x).toBeCloseTo(1);
        expect(high.y).toBeCloseTo(1);
      }
    }
  });
  it("retains a head beyond each edge until its complete tail and halo have cleared", () => {
    const sky = { left: -1, right: 1, bottom: -1, top: 1 };
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const m = createMeteorPool()[0];
      Object.assign(m, {
        active: true,
        dx,
        dy,
        length: 0.8,
        width: 0.02,
        x: dx * 1.2,
        y: dy * 1.2,
      });
      expect(meteorIntersects(m, sky)).toBe(true);
      expect(meteorHasExited(m, sky)).toBe(false);
      m.x = dx * 1.9;
      m.y = dy * 1.9;
      expect(meteorHasExited(m, sky)).toBe(true);
      expect(meteorIntersects(m, sky)).toBe(false);
    }
  });
  it("keeps upstream spawns and accounts for the full diagonal quad width", () => {
    const m = createMeteorPool()[0];
    Object.assign(m, {
      active: true,
      x: -1.5,
      y: 1.4,
      dx: 0.8,
      dy: -0.6,
      length: 0.7,
      width: 0.06,
    });
    const sky = { left: -1, right: 1, bottom: -1, top: 1 };
    expect(meteorHasExited(m, sky)).toBe(false);
    const b = meteorBounds(m);
    expect(b.left).toBeCloseTo(
      m.x - m.dx * m.length - Math.abs(m.dy) * m.width * 4,
    );
    expect(b.top).toBeCloseTo(
      m.y - m.dy * m.length + Math.abs(m.dx) * m.width * 4,
    );
  });
  it("uses current bounds after a resize rather than cached spawn bounds", () => {
    const m = createMeteorPool()[0];
    Object.assign(m, {
      active: true,
      x: 22,
      y: 0,
      dx: 1,
      dy: 0,
      length: 4,
      width: 0.1,
      depth: 38,
    });
    expect(
      meteorHasExited(
        m,
        frustumAtDepth(camera(1.6).projectionMatrix.elements, m.depth),
      ),
    ).toBe(false);
    expect(
      meteorHasExited(
        m,
        frustumAtDepth(camera(0.5).projectionMatrix.elements, m.depth),
      ),
    ).toBe(true);
  });
});

describe("Continuous pooled meteor shower", () => {
  it("spawns outside the frustum, crosses it, and exits with diverse diagonal paths and three depths", () => {
    const random = seededRandom(421);
    const layers = new Set<number>(),
      sides = new Set<number>();
    for (const aspect of [0.45, 1.6, 2.4]) {
      const p = camera(aspect).projectionMatrix.elements;
      for (let i = 0; i < 100; i++) {
        const m = createMeteorPool()[0];
        spawnMeteor(m, p, 900, random);
        layers.add(m.layer);
        sides.add(Math.sign(m.dx));
        const sky = frustumAtDepth(p, m.depth);
        expect(meteorHasExited(m, sky)).toBe(false);
        expect(meteorIntersects(m, sky)).toBe(false);
        expect(Math.abs(m.dx)).toBeGreaterThan(0.25);
        const brightness = m.brightness;
        let entered = false,
          tailAfterHead = false;
        for (let f = 0; f < 2500 && !meteorHasExited(m, sky); f++) {
          m.x += m.vx / 60;
          m.y += m.vy / 60;
          entered ||= meteorIntersects(m, sky);
          if (
            (m.x > sky.right || m.x < sky.left || m.y < sky.bottom) &&
            meteorIntersects(m, sky)
          )
            tailAfterHead = true;
        }
        expect(entered).toBe(true);
        expect(tailAfterHead).toBe(true);
        expect(meteorHasExited(m, sky)).toBe(true);
        expect(meteorIntersects(m, sky)).toBe(false);
        expect(m.brightness).toBe(brightness);
      }
    }
    expect(layers).toEqual(new Set([0, 1, 2]));
    expect(sides).toEqual(new Set([-1, 1]));
  });
  it("never expires an in-frustum meteor just because time has passed", () => {
    const shower = new MeteorShower(seededRandom(7));
    const held = shower.pool[0];
    Object.assign(held, {
      active: true,
      id: 500,
      x: 0,
      y: 0,
      dx: 1,
      dy: 0,
      vx: 0,
      vy: 0,
      length: 3,
      pixelWidth: 1,
      brightness: 0.7,
    });
    for (let i = 0; i < 6000; i++)
      shower.step(0.05, "sparse", "slow", false, projection, 900);
    expect(held.active).toBe(true);
    expect(held.id).toBe(500);
  });
  it("keeps the complete spawn geometry outside even a small phone or landscape viewport", () => {
    const random = seededRandom(23);
    for (const [width, height] of [
      [280, 600],
      [320, 480],
      [600, 240],
    ]) {
      const p = camera(width / height).projectionMatrix.elements;
      for (let i = 0; i < 150; i++) {
        const m = createMeteorPool()[0];
        spawnMeteor(m, p, height, random);
        expect(meteorIntersects(m, frustumAtDepth(p, m.depth))).toBe(false);
        expect(meteorHasExited(m, frustumAtDepth(p, m.depth))).toBe(false);
      }
    }
  });
  it("starts promptly and has distinct bounded steady densities on desktop and mobile", () => {
    for (const compact of [false, true])
      for (const mode of ["sparse", "shower", "storm"] as ShowerMode[]) {
        const shower = new MeteorShower(seededRandom(40));
        const identities = [...shower.pool];
        let total = 0,
          samples = 0,
          peak = 0;
        for (let f = 0; f < 7200; f++) {
          shower.step(1 / 60, mode, "slow", compact, projection, 900);
          if (f === 15) expect(shower.spawned).toBeGreaterThan(0);
          peak = Math.max(peak, shower.activeCount);
          if (f > 1200) {
            total += shower.visibleCount;
            samples++;
          }
        }
        const mean = total / samples;
        if (mode === "sparse") expect(mean).toBeGreaterThan(1);
        if (mode === "shower") {
          expect(mean).toBeGreaterThan(5);
          expect(mean).toBeLessThan(16);
        }
        if (mode === "storm") {
          expect(mean).toBeGreaterThan(15);
          expect(mean).toBeLessThan(41);
        }
        expect(peak).toBeLessThanOrEqual(showerConfig(mode, compact).limit);
        expect(shower.pool).toHaveLength(METEOR_CAPACITY);
        identities.forEach((m, i) => expect(shower.pool[i]).toBe(m));
        expect(shower.spawned).toBeGreaterThan(30);
        expect(shower.recycled).toBeGreaterThan(20);
      }
  });
  it("keeps delta-time movement consistent at 30, 60 and 120 fps and clamps stalls", () => {
    const positions = [];
    for (const fps of [30, 60, 120]) {
      const shower = new MeteorShower(() => 0.5);
      const m = shower.pool[0];
      Object.assign(m, {
        active: true,
        x: 0,
        y: 0,
        dx: 1,
        dy: -0.1,
        vx: 0.3,
        vy: -0.04,
        length: 3,
        brightness: 0.6,
      });
      for (let f = 0; f < fps * 3; f++)
        shower.step(1 / fps, "sparse", "slow", false, projection, 900);
      positions.push(m.x);
      const x = m.x;
      shower.step(3600, "sparse", "slow", false, projection, 900);
      expect(m.x - x).toBeCloseTo(0.3 * 0.075);
    }
    positions.forEach((x) => expect(x).toBeCloseTo(0.9));
  });
  it("does not steal visible slots when reducing density, and Off clears the effect", () => {
    const shower = new MeteorShower(seededRandom(11));
    for (let i = 0; i < 300; i++)
      shower.step(0.05, "storm", "slow", false, projection, 900);
    const occupied = shower.pool
      .filter((m) => m.active)
      .map((m) => ({ m, id: m.id }));
    shower.step(0, "sparse", "slow", false, projection, 900);
    occupied.forEach(({ m, id }) => {
      expect(m.active).toBe(true);
      expect(m.id).toBe(id);
    });
    shower.step(0, "off", "slow", false, projection, 900);
    expect(shower.pool.every((m) => !m.active)).toBe(true);
    expect(shower.visibleCount).toBe(0);
  });
});

describe("Meteor preference migration", () => {
  it("defaults to Shower / Slow and preserves legacy Off, Low and High intent", () => {
    expect(defaultPrismSettings.meteorShower).toBe("shower");
    expect(defaultPrismSettings.meteorSpeed).toBe("slow");
    const {
      meteorShower: _,
      meteorSpeed: __,
      ...legacy
    } = defaultPrismSettings;
    for (const [patch, mode] of [
      [{ shootingStars: false }, "off"],
      [{ shootingFrequency: 50 }, "sparse"],
      [{ shootingFrequency: 100 }, "shower"],
      [{ shootingFrequency: 150 }, "storm"],
    ] as const) {
      const s = settingsSchema.parse({
        ...defaultSettings,
        prism: { ...legacy, ...patch },
      });
      expect(s.prism.meteorShower).toBe(mode);
      expect(s.prism.meteorSpeed).toBe("slow");
    }
  });
});
