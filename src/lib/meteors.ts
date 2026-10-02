import { frameDelta, type RandomSource } from "./prism";

export type ShowerMode = "off" | "sparse" | "shower" | "storm";
export type MeteorSpeed = "slow" | "normal" | "fast";
export const METEOR_CAPACITY = 64;
export interface SkyBounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}
export interface Meteor {
  active: boolean;
  id: number;
  depth: number;
  layer: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  length: number;
  width: number;
  pixelWidth: number;
  brightness: number;
}

// Meteors live in camera space. These are the exact intersections of the
// current perspective camera's side planes with the meteor's depth plane.
// Supports aspect/zoom changes and asymmetric camera view offsets.
export function frustumAtDepth(
  projection: ArrayLike<number>,
  depth: number,
): SkyBounds {
  return {
    left: (depth * (projection[8] - 1)) / projection[0],
    right: (depth * (projection[8] + 1)) / projection[0],
    bottom: (depth * (projection[9] - 1)) / projection[5],
    top: (depth * (projection[9] + 1)) / projection[5],
  };
}

export function showerConfig(mode: ShowerMode, compact = false) {
  const config = {
    off: { min: Infinity, max: Infinity, limit: 0 },
    sparse: { min: 1.8, max: 3.5, limit: 5 },
    shower: {
      min: compact ? 0.55 : 0.35,
      max: compact ? 1.05 : 0.85,
      limit: compact ? 14 : 15,
    },
    storm: {
      min: compact ? 0.18 : 0.12,
      max: compact ? 0.38 : 0.28,
      limit: compact ? 30 : 40,
    },
  };
  return config[mode];
}
export const meteorSpeedScale = (speed: MeteorSpeed) =>
  speed === "slow" ? 1 : speed === "normal" ? 1.4 : 1.9;

// Covers the COMPLETE rendered quad, including the head halo and tail width.
// Keep this geometry in sync with meteorVertex, not with an arbitrary lifespan.
export function meteorBounds(m: Meteor): SkyBounds {
  const pad = m.width * 4;
  const headX = m.x + m.dx * pad,
    headY = m.y + m.dy * pad;
  const tailX = m.x - m.dx * m.length,
    tailY = m.y - m.dy * m.length;
  const normalX = Math.abs(m.dy) * pad,
    normalY = Math.abs(m.dx) * pad;
  return {
    left: Math.min(headX, tailX) - normalX,
    right: Math.max(headX, tailX) + normalX,
    bottom: Math.min(headY, tailY) - normalY,
    top: Math.max(headY, tailY) + normalY,
  };
}

export function meteorIntersects(m: Meteor, sky: SkyBounds) {
  const b = meteorBounds(m);
  return (
    b.right >= sky.left &&
    b.left <= sky.right &&
    b.top >= sky.bottom &&
    b.bottom <= sky.top
  );
}

export function meteorHasExited(m: Meteor, sky: SkyBounds) {
  const b = meteorBounds(m);
  // An offscreen spawn is upstream. Only downstream half-planes recycle it.
  return (
    (m.dx > 0 && b.left > sky.right) ||
    (m.dx < 0 && b.right < sky.left) ||
    (m.dy > 0 && b.bottom > sky.top) ||
    (m.dy < 0 && b.top < sky.bottom)
  );
}

export function createMeteorPool(): Meteor[] {
  return Array.from({ length: METEOR_CAPACITY }, () => ({
    active: false,
    id: 0,
    depth: 38,
    layer: 1,
    x: 0,
    y: 0,
    dx: 1,
    dy: 0,
    vx: 0,
    vy: 0,
    length: 0,
    width: 0,
    pixelWidth: 1,
    brightness: 0,
  }));
}

export function spawnMeteor(
  m: Meteor,
  projection: ArrayLike<number>,
  height: number,
  random: RandomSource = Math.random,
) {
  const depthRoll = random();
  m.layer = depthRoll < 0.4 ? 0 : depthRoll < 0.9 ? 1 : 2;
  m.depth =
    m.layer === 0
      ? 70 + random() * 15
      : m.layer === 1
        ? 33 + random() * 12
        : 17 + random() * 7;
  const sky = frustumAtDepth(projection, m.depth);
  const w = sky.right - sky.left,
    h = sky.top - sky.bottom;
  // Leave room for the complete head glow, even on a very small viewport.
  const outsideX = Math.max(0.025, 12 / Math.max(1, (height * w) / h));
  const outsideY = Math.max(0.025, 12 / Math.max(1, height));
  const right = random() < 0.8;
  const fromTop = random() < 0.3;
  // A coherent diagonal bias with both lateral and top entry families.
  const x0 = fromTop ? 0.1 + random() * 0.55 : -outsideX;
  const y0 = fromTop ? 1 + outsideY : 0.4 + random() * 0.57;
  const x1 = 1 + outsideX;
  const y1 = fromTop
    ? 0.45 + random() * 0.4
    : Math.max(0.06, y0 - (0.16 + random() * 0.42));
  m.x = sky.left + (right ? x0 : 1 - x0) * w;
  m.y = sky.bottom + y0 * h;
  const travelX = (right ? x1 - x0 : x0 - x1) * w;
  const travelY = (y1 - y0) * h;
  const distance = Math.hypot(travelX, travelY);
  m.dx = travelX / distance;
  m.dy = travelY / distance;
  const smallFast = m.layer === 1 && random() < 0.08;
  const crossingSeconds =
    m.layer === 0
      ? 8 + random() * 4
      : m.layer === 2
        ? 6 + random() * 4
        : smallFast
          ? 3 + random() * 1.5
          : 4.5 + random() * 3.5;
  // Seconds define velocity only. They are never an expiry condition.
  m.vx = travelX / crossingSeconds;
  m.vy = travelY / crossingSeconds;
  m.pixelWidth =
    m.layer === 0
      ? 0.32 + random() * 0.22
      : m.layer === 1
        ? 0.6 + random() * 0.4
        : 1.05 + random() * 0.6;
  m.width = (m.pixelWidth * h) / Math.max(1, height);
  m.length =
    Math.min(w, h) *
    (m.layer === 0
      ? 0.08 + random() * 0.1
      : m.layer === 1
        ? 0.16 + random() * 0.18
        : 0.32 + random() * 0.25) *
    (0.85 + crossingSeconds / 30);
  m.brightness =
    m.layer === 0
      ? 0.2 + random() * 0.14
      : m.layer === 1
        ? 0.5 + random() * 0.3
        : 0.9 + random() * 0.35;
  m.active = true;
}

export class MeteorShower {
  readonly pool = createMeteorPool();
  spawned = 0;
  recycled = 0;
  visibleCount = 0;
  activeCount = 0;
  private remaining = 0.08;
  private mode: ShowerMode = "shower";
  constructor(private random: RandomSource = Math.random) {}
  clear() {
    this.pool.forEach((m) => {
      m.active = false;
    });
    this.visibleCount = this.activeCount = 0;
    this.remaining = 0.08;
  }
  step(
    delta: number,
    mode: ShowerMode,
    speed: MeteorSpeed,
    compact: boolean,
    projection: ArrayLike<number>,
    height: number,
  ) {
    const dt = frameDelta(delta);
    const config = showerConfig(mode, compact);
    if (mode !== this.mode) {
      this.mode = mode;
      this.remaining = 0.08;
    }
    if (mode === "off") {
      this.clear();
      return;
    }
    const velocityScale = meteorSpeedScale(speed);
    this.activeCount = this.visibleCount = 0;
    for (const m of this.pool) {
      if (!m.active) continue;
      m.x += m.vx * dt * velocityScale;
      m.y += m.vy * dt * velocityScale;
      const sky = frustumAtDepth(projection, m.depth);
      m.width = (m.pixelWidth * (sky.top - sky.bottom)) / Math.max(1, height);
      if (meteorHasExited(m, sky)) {
        m.active = false;
        this.recycled++;
        continue;
      }
      this.activeCount++;
      if (meteorIntersects(m, sky)) this.visibleCount++;
    }
    this.remaining -= dt;
    if (this.remaining <= 0) {
      // Never steal an occupied slot or clear flights when reducing density.
      if (this.activeCount < config.limit) {
        const slot = this.pool.find((m) => !m.active);
        if (slot) {
          spawnMeteor(slot, projection, height, this.random);
          slot.id = ++this.spawned;
          this.activeCount++;
        }
      }
      this.remaining = config.min + this.random() * (config.max - config.min);
    }
  }
}
