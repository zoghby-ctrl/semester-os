import { memo, useEffect, useRef } from "react";
import type { Settings } from "../../lib/schema";
import { mix, type ThemeDefinition } from "../../themes/definitions";
import { cloudNoise, createWorldParticles, daylightAt, daylightPatches, distantEvent, focusBreath, gridPoint, midnightTwinkle, particlePosition, ribbonHeight, worldKind, worldParticleCount, wrap, type WorldKind, type WorldParticle } from "../../themes/worlds";
import { registerWorldClient, worldLoopStats, worldPointer, type WorldFrameClient } from "../../themes/worldLoop";

export interface WorldQualityProfile {
  particleScale: number; effectScale: number; detailScale: number;
  dprScale: number; distantScale: number; fps: number;
}
interface Props {
  theme: ThemeDefinition; settings: Settings; paused: boolean; visible: boolean;
  preview?: boolean; quality?: WorldQualityProfile;
  onFrameSample?: (costMs: number, intervalMs: number) => void;
}
const fallbackQuality: WorldQualityProfile = { particleScale: 1, effectScale: 1, detailScale: 1, dprScale: 1, distantScale: 1, fps: 30 };
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const tint = (color: string, alpha: number) => { const c = rgb(color); return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`; };
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

interface WorldResources {
  texture: HTMLCanvasElement;
  textureContext: CanvasRenderingContext2D;
  pixels: ImageData;
  colors: [number, number, number][];
  particles: WorldParticle[];
}
interface WorldFrame {
  context: CanvasRenderingContext2D; width: number; height: number;
  time: number; kind: WorldKind; theme: ThemeDefinition; settings: Settings;
  quality: WorldQualityProfile; resources: WorldResources; paused: boolean; preview: boolean;
  offsetX: number; offsetY: number;
}

// The tiny software noise texture is an inexpensive shader approximation. Each
// pixel combines independently advected cloud layers; it is never a CSS loop.
function updateAtmosphere(frame: WorldFrame) {
  const { resources: r, kind, time: t, quality: q, theme } = frame;
  const w = r.pixels.width, h = r.pixels.height, bytes = r.pixels.data;
  const glow = frame.settings.atmosphere.glow / 100;
  const light = theme.palette.light;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      let a: number, blend: number, warmth = 0;
      if (kind === "caustics" || kind === "pearl") {
        const n = cloudNoise(u * 1.1, v * 1.1, t, 3);
        const distortion = n * 3.5;
        const ridges = Math.pow(1 - Math.abs(Math.sin(u * 11 + v * 7 + distortion + t * .025) * Math.cos(v * 9 - u * 4 + distortion - t * .019)), 8);
        a = .09 + n * .14 + ridges * .26;
        blend = .5 + Math.sin(u * 3 + v * 2 + t * .014) * .35;
        warmth = .2 + ridges * .45;
      } else if (kind === "dappled") {
        const n = cloudNoise(u * 1.35 + t * .005, v * 1.1, t * .7, 2);
        const shade = clamp((n - .39) * 2.8);
        a = .08 + shade * .36;
        blend = .3 + Math.sin(t * .012) * .06;
        warmth = .32 * (1 - shade);
      } else if (kind === "nebula" || kind === "space") {
        const angle = t * .006, dx = u - .5, dy = v - .5;
        const nx = dx * Math.cos(angle) - dy * Math.sin(angle), ny = dx * Math.sin(angle) + dy * Math.cos(angle);
        const first = cloudNoise(nx * 1.45, ny * 1.5, t, 0);
        const second = cloudNoise(nx * 1.1 + 8, ny * 1.3 - 3, t * .81, 1);
        const third = cloudNoise(nx + 5, ny + 9, t * .53, 2);
        a = clamp((first * .55 + second * .3 + third * .15 - .3) * 1.3) * .85;
        blend = clamp((second - .3) * 2.7);
        warmth = clamp((third - .45) * 2.4) * .5;
      } else if (kind === "night" || kind === "stars") {
        a = clamp((cloudNoise(u * 1.2, v * .7, t * .45, 3) - .33) * .36) * Math.exp(-Math.pow((v - .2) * 3, 2));
        blend = .7;
      } else if (kind === "veil" || kind === "aurora") {
        a = cloudNoise(u * .9, v * .8, t * .7, 1) * .2;
        blend = v;
      } else if (kind === "grid") {
        a = Math.exp(-Math.pow((v - .39) * 8, 2)) * (.04 + cloudNoise(u, v, t * .5, 2) * .14);
        blend = u;
      } else {
        const first = cloudNoise(u * 1.25, v * .95, t, 0);
        const second = cloudNoise(u * .8 + 5, v * 1.2, t * .67, 2);
        a = clamp((first * .65 + second * .35 - .25) * 1.2) * (kind === "cherry" ? .32 : kind === "mist" ? .54 : .63);
        blend = second;
      }
      const at = (x + y * w) * 4;
      for (let c = 0; c < 3; c++) {
        const color = r.colors[0][c] * (1 - blend) + r.colors[1][c] * blend;
        bytes[at + c] = color * (1 - warmth) + r.colors[2][c] * warmth;
      }
      bytes[at + 3] = clamp(a * (.55 + glow * .75) * (.55 + q.effectScale * .45) * (light ? 1 : .82)) * 255;
    }
  }
  r.textureContext.putImageData(r.pixels, 0, 0);
}

function lightOrb(f: WorldFrame, x: number, y: number, radius: number, color: string, opacity: number) {
  const { context: ctx } = f;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
  gradient.addColorStop(0, tint(color, opacity)); gradient.addColorStop(.3, tint(color, opacity * .65)); gradient.addColorStop(1, tint(color, 0));
  ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawMoon(f: WorldFrame) {
  const { context: ctx, width: w, height: h } = f;
  const radius = f.preview ? Math.min(w, h) * .047 : clamp(Math.min(w, h) * .03, 17, 30);
  const x = w * (w < 700 ? .86 : .81), y = h * (f.preview ? .17 : w < 700 ? .23 : .22);
  lightOrb(f, x, y, radius * 5.5, "#829ebf", .09);
  lightOrb(f, x, y, radius * 2.2, "#c2d1df", .065);
  const moon = ctx.createRadialGradient(x + radius * .4, y - radius * .35, radius * .08, x, y, radius);
  moon.addColorStop(0, "#e2e8ed"); moon.addColorStop(.75, "#bacbd8"); moon.addColorStop(1, "#8ea5b9");
  ctx.save(); ctx.globalAlpha = .66; ctx.fillStyle = moon;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.clip();
  ctx.fillStyle = "#607b94"; ctx.globalAlpha = .09;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.3) * radius * .5, y + Math.cos(i * 1.7) * radius * .48, radius * (.1 + i * .025), 0, Math.PI * 2); ctx.fill();
  }
  // A subdued earthlit side leaves a readable crescent rather than a bright disc.
  ctx.globalAlpha = .87; ctx.fillStyle = "#0b111a";
  ctx.beginPath(); ctx.ellipse(x - radius * .49, y - radius * .16, radius * .95, radius * 1.02, -.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMoonHaze(f: WorldFrame) {
  const { context: ctx, width: w, height: h, time } = f;
  for (let i = 0; i < 2; i++) {
    const progress = wrap(time / (97 + i * 43) + .63 + i * .37);
    const x = (-.32 + progress * 1.64) * w;
    const y = h * ((f.preview ? .17 : w < 700 ? .23 : .22) + (i - .5) * .035 + Math.sin(time * .019 + i) * .014);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .13 + i * .035);
    lightOrb(f, 0, 0, w * (.26 + i * .08), "#152031", .19);
    lightOrb(f, 0, -h * .035, w * .23, "#a3b8cc", .035 * f.quality.effectScale);
    ctx.restore();
  }
}

function drawDaylight(f: WorldFrame) {
  const { context: ctx, width: w, height: h, time, quality } = f;
  const warmth = .5 + Math.sin(time * .012) * .3;
  const color = mix("#fff7da", "#efd39a", warmth);
  const strength = .65 + quality.effectScale * .35;
  for (const patch of daylightPatches(time)) {
    ctx.save(); ctx.translate(patch.x * w, patch.y * h); ctx.rotate(-.27); ctx.scale(1, .65);
    lightOrb(f, 0, 0, Math.max(w, h) * patch.radius, color, .26 * strength);
    ctx.restore();
  }
  // Soft oblique window divisions and independently swaying leaf-like shadows.
  // Everything is procedural; no photographs, downloads or extra frame loop.
  ctx.save(); ctx.translate(w * (.7 + Math.sin(time * .017) * .035), h * .26); ctx.rotate(-.28 + Math.sin(time * .011) * .018);
  for (let i = -1; i <= 1; i++) {
    const x = i * w * .15;
    const shade = ctx.createLinearGradient(x - w * .035, 0, x + w * .035, 0);
    shade.addColorStop(0, "#65745400"); shade.addColorStop(.5, tint("#657454", .085 * strength)); shade.addColorStop(1, "#65745400");
    ctx.fillStyle = shade; ctx.fillRect(x - w * .035, -h * .26, w * .07, h * .76);
  }
  ctx.restore();
  for (let i = 0; i < 7; i++) {
    const x = (.58 + Math.sin(i * 2.1 + time * .018) * .28) * w;
    const y = (.13 + i * .062 + Math.cos(time * .023 + i) * .025) * h;
    ctx.save(); ctx.translate(x, y); ctx.rotate(i * .71 + Math.sin(time * .04 + i) * .12); ctx.scale(1, .23);
    lightOrb(f, 0, 0, Math.min(w, h) * (.08 + i % 3 * .02), "#647451", .07 * strength);
    ctx.restore();
  }
}

function drawRibbons(f: WorldFrame) {
  const { context: ctx, width: w, height: h, time, theme, kind, quality } = f;
  const aurora = kind === "aurora";
  const layers = Math.max(2, Math.round((aurora ? 5 : 3) * (.55 + quality.detailScale * .45)));
  const colors = [theme.palette.secondary, theme.palette.primary, aurora ? "#8aafd2" : theme.palette.accent];
  for (let layer = layers - 1; layer >= 0; layer--) {
    const top = (.13 + layer * .09) * h;
    const gradient = ctx.createLinearGradient(0, top, 0, top + h * .46);
    const alpha = (aurora ? .13 : .09) * (.5 + f.settings.atmosphere.glow / 100) * quality.effectScale;
    gradient.addColorStop(0, tint(colors[layer % 3], 0));
    gradient.addColorStop(.13, tint(colors[layer % 3], alpha));
    gradient.addColorStop(.55, tint(colors[(layer + 1) % 3], alpha * .5)); gradient.addColorStop(1, tint(colors[layer % 3], 0));
    ctx.fillStyle = gradient; ctx.beginPath();
    const segments = Math.max(18, Math.round(48 * quality.detailScale));
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const y = ribbonHeight(u, time, layer, aurora) * h + f.offsetY * (layer + 1) / 4;
      if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(u * w, y);
    }
    for (let i = segments; i >= 0; i--) {
      const u = i / segments;
      const fold = Math.sin(u * 6 + layer * 2.1 + time * (.027 + layer * .007)) * h * .04;
      ctx.lineTo(u * w, ribbonHeight(u, time, layer, aurora) * h + h * (aurora ? .24 : .16) + fold);
    }
    ctx.closePath(); ctx.fill();
  }
  if (!aurora && quality.distantScale > .5) {
    const shaft = .15 + wrap(time * .002 + .53) * .75;
    const gradient = ctx.createLinearGradient(shaft * w - w * .07, 0, shaft * w + w * .07, 0);
    gradient.addColorStop(0, tint(theme.palette.accent, 0)); gradient.addColorStop(.5, tint(theme.palette.accent, .025)); gradient.addColorStop(1, tint(theme.palette.accent, 0));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h * .65);
  }
}

function drawParticles(f: WorldFrame) {
  const { context: ctx, width: w, height: h, resources: r, time, theme, kind } = f;
  const isStars = kind === "stars" || kind === "space" || kind === "night" || kind === "nebula" || kind === "veil" || kind === "aurora";
  const glow = f.settings.atmosphere.glow / 100;
  for (let layer = 1; layer <= 3; layer++) {
    const color = isStars ? (theme.palette.light ? theme.palette.secondary : "#cfdae9") : layer === 1 ? theme.palette.primary : layer === 2 ? theme.palette.secondary : theme.palette.accent;
    ctx.fillStyle = color; ctx.strokeStyle = color;
    for (let i = 0; i < r.particles.length; i++) {
      const p = r.particles[i];
      if (Math.round(p.depth * 3) !== layer) continue;
      const position = particlePosition(p, kind, time, f.settings.atmosphere.depth);
      const x = position.x * w + f.offsetX * p.depth, y = position.y * h + f.offsetY * p.depth;
      const sparkle = kind === "night" ? midnightTwinkle(p, time, f.paused) : f.paused ? .8 : .72 + Math.sin(time * .24 + p.phase) * .18;
      ctx.globalAlpha = (kind === "night" ? .65 : theme.palette.light ? .25 : .33) * sparkle * (kind === "night" ? .35 + p.depth * .65 : .5 + p.depth * .5) * (.6 + glow * .7);
      if (kind === "dappled") {
        const lit = daylightAt(position.x, position.y, time);
        ctx.fillStyle = theme.palette.light ? "#8d744d" : "#ead8ae";
        ctx.globalAlpha = (.045 + lit * .42) * sparkle * (.4 + p.depth * .6);
      }
      if (kind === "fragments" && i % 3 === 0) {
        const size = p.size * (2 + p.depth * 5) * (f.preview ? .65 : 1);
        ctx.save(); ctx.translate(x, y); ctx.rotate(position.angle);
        ctx.scale(1, .7 + Math.sin(time * .035 + p.phase) * .22);
        ctx.beginPath(); ctx.moveTo(-size, 0);
        ctx.bezierCurveTo(-size * .4, -size * .85, size * .85, -size * .25, size, size * .18);
        ctx.bezierCurveTo(size * .25, size * .45, -size * .8, size * .65, -size, 0);
        ctx.fill(); ctx.restore();
      } else if (kind === "orbit") {
        // Partial trails imply opposing elliptical systems rather than diagrams.
        ctx.lineWidth = .65 + p.depth * .45;
        for (let segment = 3; segment > 0; segment--) {
          const earlier = particlePosition(p, kind, time, f.settings.atmosphere.depth, -(p.group % 2 ? -1 : 1) * segment * .026);
          const nearer = particlePosition(p, kind, time, f.settings.atmosphere.depth, -(p.group % 2 ? -1 : 1) * (segment - 1) * .026);
          ctx.globalAlpha *= .8; ctx.beginPath(); ctx.moveTo(earlier.x * w + f.offsetX * p.depth, earlier.y * h + f.offsetY * p.depth); ctx.lineTo(nearer.x * w + f.offsetX * p.depth, nearer.y * h + f.offsetY * p.depth); ctx.stroke();
        }
        ctx.globalAlpha = .36 + glow * .2;
        ctx.beginPath(); ctx.arc(x, y, .9 + p.depth * .9, 0, Math.PI * 2); ctx.fill();
      } else if (kind === "orbs" || kind === "cherry" && i % 9 === 0) {
        const opacity = ctx.globalAlpha; ctx.globalAlpha = 1;
        lightOrb(f, x, y, p.size * (kind === "orbs" ? 18 : 9) * p.depth, color, opacity * .4);
      } else {
        const radius = p.size * (kind === "night" ? .38 + p.depth * .45 : isStars ? .62 : kind === "dappled" ? .65 : .45) * (f.preview ? .75 : 1);
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
        if (kind === "dappled" && i % 4 === 0) {
          ctx.globalAlpha = 1; lightOrb(f, x, y, 4, "#fff7d9", .12 * sparkle * daylightAt(position.x, position.y, time));
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawWorldEvents(f: WorldFrame) {
  const { context: ctx, width: w, height: h, kind, theme, time, quality } = f;
  if ((kind === "pearl" || kind === "caustics") && quality.effectScale > .25) {
    for (let i = 0; i < 3; i++) {
      const phase = wrap((time + i * 37) / 117);
      const x = w * (.25 + i * .22), y = h * (.28 + (i % 2) * .35);
      const radius = Math.min(w, h) * (.07 + phase * .42);
      ctx.strokeStyle = tint(i % 2 ? theme.palette.secondary : "#fff9ed", Math.sin(phase * Math.PI) * .07 * quality.effectScale);
      ctx.lineWidth = Math.max(1, radius * .045); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
      lightOrb(f, x, y, radius * .85, "#fffaf1", Math.sin(phase * Math.PI) * .035);
    }
  }
  if (kind === "orbit" || kind === "orbs" || kind === "nebula") {
    for (let i = 0; i < (quality.distantScale > .5 ? 3 : 1); i++) {
      const x = (.22 + i * .3 + Math.sin(time * (.014 + i * .003) + i * 2) * .05) * w;
      const y = (.23 + i % 2 * .43 + Math.cos(time * .018 + i) * .04) * h;
      lightOrb(f, x, y, Math.min(w, h) * (.055 + i * .012), i % 2 ? theme.palette.secondary : theme.palette.primary, .09 * quality.effectScale);
    }
  }
  if (f.paused || quality.distantScale < .25) return;
  if (kind === "cherry") {
    // Blurred, broad lights pass through fog at different depths. These have no
    // point head, sharp tapered meteor trail, or Prism event-engine dependency.
    for (let i = 0; i < (quality.distantScale > .6 ? 4 : 2); i++) {
      const progress = wrap(time / (61 + i * 17) + i * .263);
      const x = (-.2 + progress * 1.4) * w, y = (.19 + i * .18 + progress * .09) * h;
      const length = w * (.065 + i * .013);
      const alpha = Math.sin(progress * Math.PI) * (i === 3 ? .1 : .055) * quality.effectScale;
      const gradient = ctx.createLinearGradient(x - length, y, x + length, y);
      gradient.addColorStop(0, tint(theme.palette.primary, 0)); gradient.addColorStop(.5, tint(theme.palette.secondary, alpha)); gradient.addColorStop(1, tint(theme.palette.primary, 0));
      ctx.strokeStyle = gradient; ctx.lineWidth = (i === 3 ? 7 : 3 + i) * (f.preview ? .65 : 1);
      ctx.save(); ctx.shadowBlur = 8 * quality.effectScale; ctx.shadowColor = tint(theme.palette.primary, .25);
      ctx.beginPath(); ctx.moveTo(x - length, y - h * .014); ctx.lineTo(x + length, y + h * .014); ctx.stroke(); ctx.restore();
    }
  }
  const event = distantEvent(kind, time, false);
  if (!event) return;
  const x = (-.08 + event.progress * 1.16) * w, y = (.16 + event.progress * .13) * h;
  if (kind === "night") {
    ctx.globalAlpha = event.alpha * .34; ctx.fillStyle = "#a9b8cc"; ctx.beginPath(); ctx.arc(x, y, .85, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  } else {
    const gradient = ctx.createLinearGradient(x - w * .13, y, x + w * .02, y);
    gradient.addColorStop(0, tint(theme.palette.primary, 0)); gradient.addColorStop(.65, tint(theme.palette.primary, event.alpha * (kind === "cherry" ? .14 : .055))); gradient.addColorStop(1, tint(theme.palette.primary, 0));
    ctx.strokeStyle = gradient; ctx.lineWidth = kind === "cherry" ? 8 : 1.2;
    ctx.beginPath(); ctx.moveTo(x - w * .13, y - h * .02); ctx.lineTo(x + w * .02, y); ctx.stroke();
  }
}

function drawGrid(f: WorldFrame) {
  const { context: ctx, width: w, height: h, time, theme, quality } = f;
  ctx.lineWidth = .65; ctx.strokeStyle = tint(theme.palette.primary, .13);
  for (let column = 0; column <= 12; column++) {
    const horizon = gridPoint(column, 0, time), near = gridPoint(column, 12, time);
    ctx.beginPath(); ctx.moveTo(horizon.x * w, .39 * h); ctx.lineTo(near.x * w, near.y * h); ctx.stroke();
  }
  for (let row = 0; row <= 12; row++) {
    const start = gridPoint(0, row, time), end = gridPoint(12, row, time);
    ctx.strokeStyle = tint(theme.palette.secondary, .03 + start.depth * .13);
    ctx.beginPath(); ctx.moveTo(start.x * w, start.y * h); ctx.lineTo(end.x * w, end.y * h); ctx.stroke();
    for (let column = 0; column <= 12; column++) {
      if ((column + row) % 3 !== 0) continue;
      const point = gridPoint(column, row, time);
      ctx.fillStyle = tint(theme.palette.accent, .11 + point.depth * .14);
      ctx.beginPath(); ctx.arc(point.x * w, point.y * h, .7 + point.depth * .5, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (f.paused || quality.distantScale < .3) return;
  for (let route = 0; route < 2; route++) {
    const phase = (time + route * 14) % 29;
    if (phase > 8) continue;
    const progress = phase / 8;
    const from = gridPoint(3 + route * 4, 4 + route * 3, time), to = gridPoint(6 + route * 3, 4 + route * 3, time);
    const x = (from.x + (to.x - from.x) * progress) * w, y = from.y * h;
    const alpha = Math.sin(progress * Math.PI) * .32;
    ctx.strokeStyle = tint(theme.palette.accent, alpha); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(from.x * w, y); ctx.lineTo(x, y); ctx.stroke();
    lightOrb(f, x, y, 7, theme.palette.accent, alpha * .35);
  }
}

export const WorldCanvas = memo(function WorldCanvas({ theme, settings, paused, visible, preview = false, quality = fallbackQuality, onFrameSample }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ identity: "", time: 0 });
  const samples = useRef(onFrameSample);
  useEffect(() => { samples.current = onFrameSample; }, [onFrameSample]);
  useEffect(() => {
    const element = canvas.current, context = element?.getContext("2d", { alpha: true });
    if (!element || !context) return;
    const compact = matchMedia("(max-width: 700px), (pointer: coarse)").matches;
    const kind = worldKind(theme, settings.customTheme);
    const texture = document.createElement("canvas"), textureContext = texture.getContext("2d", { alpha: true });
    if (!textureContext) return;
    texture.width = Math.max(32, Math.round((preview ? 64 : compact ? 96 : 144) * quality.detailScale));
    texture.height = Math.max(24, Math.round(texture.width * .63));
    const resources: WorldResources = {
      texture, textureContext, pixels: textureContext.createImageData(texture.width, texture.height),
      colors: [rgb(theme.palette.primary), rgb(theme.palette.secondary), rgb(kind === "nebula" ? "#e8bca4" : theme.palette.light ? "#fff7e6" : theme.palette.accent)],
      particles: createWorldParticles(worldParticleCount(theme, kind, settings.atmosphere.particleDensity, compact, preview, quality.particleScale)),
    };
    const identity = `${theme.id}:${kind}`;
    if (clock.current.identity !== identity) clock.current = { identity, time: 0 };
    let width = 1, height = 1, time = clock.current.time, frames = 0, noiseAt = -Infinity;
    let pointerX = 0, pointerY = 0;
    const dpr = Math.max(.65, Math.min(window.devicePixelRatio || 1, compact || preview ? 1 : 1.5) * quality.dprScale);
    const speed = (.35 + settings.atmosphere.speed / 100 * 1.3) * (.3 + settings.motion / 100 * .7) * (.25 + settings.atmosphere.intensity / 100 * .75) * (theme.id === "focus" ? 1 : .65 + theme.motionProfile.speed * .6);
    const hasNoise = kind !== "none" && kind !== "focus" && kind !== "dust" && kind !== "orbs" && kind !== "orbit";
    const draw = (stamp: number, delta: number, interval: number) => {
      if (!visible || document.hidden) return;
      const start = performance.now();
      if (!paused) { time += delta * speed; clock.current.time = time; }
      const parallax = !paused && !preview && !compact && theme.motionProfile.parallax && kind !== "focus" ? settings.atmosphere.parallax / 50 : 0;
      pointerX += ((parallax ? worldPointer.x : 0) - pointerX) * (paused ? 1 : 1 - Math.exp(-delta * .8));
      pointerY += ((parallax ? worldPointer.y : 0) - pointerY) * (paused ? 1 : 1 - Math.exp(-delta * .8));
      const worldFrame: WorldFrame = { context, width, height, time, kind, theme, settings, quality, resources, paused, preview, offsetX: pointerX * parallax * 10, offsetY: pointerY * parallax * 8 };
      context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
      if (kind === "night") drawMoon(worldFrame);
      if (hasNoise) {
        if (stamp - noiseAt >= 1000 / (preview ? 5 : compact ? 7 : 9)) { updateAtmosphere(worldFrame); noiseAt = stamp; }
        context.imageSmoothingEnabled = true;
        context.drawImage(texture, -width * .03 + worldFrame.offsetX, -height * .03 + worldFrame.offsetY, width * 1.06, height * 1.06);
      }
      if (kind === "focus") {
        const breath = paused ? focusBreath(0) : focusBreath(time);
        const x = width * (.61 + Math.sin(time * .013) * .022), y = height * (.37 + Math.sin(time * .009) * .018);
        lightOrb(worldFrame, x, y, Math.max(width, height) * (.48 + Math.sin(time * .017) * .015), mix(theme.palette.primary, theme.palette.accent, .32), breath);
        lightOrb(worldFrame, width * (.36 + Math.sin(time * .011) * .035), height * .7, Math.max(width, height) * .3, theme.palette.primary, .04);
      } else if (kind !== "none") {
        if (kind === "orbit") {
          lightOrb(worldFrame, width * .48, height * .4, Math.min(width, height) * .5, theme.palette.primary, .07);
        }
        if (kind === "aurora" || kind === "veil") drawRibbons(worldFrame);
        if (kind === "grid") drawGrid(worldFrame);
        if (kind === "dappled") drawDaylight(worldFrame);
        drawWorldEvents(worldFrame); drawParticles(worldFrame);
        if (kind === "night") drawMoonHaze(worldFrame);
      }
      context.globalAlpha = 1;
      if (import.meta.env.DEV) {
        const stats = worldLoopStats();
        element.dataset.worldFrames = String(++frames); element.dataset.worldTime = time.toFixed(4);
        element.dataset.worldParticles = String(resources.particles.length);
        element.dataset.worldClients = String(stats.clients); element.dataset.worldActive = String(stats.active);
        element.dataset.worldLoops = String(stats.loops); element.dataset.worldListeners = String(stats.listeners);
        element.dataset.worldTexturePixels = String(texture.width * texture.height);
      }
      // Simulation pauses across long gaps, but repeated visible missed frames
      // must still reach Auto quality. Hidden and initial frames are excluded.
      if (!preview && !paused && kind !== "focus" && interval > 0) samples.current?.(performance.now() - start, interval);
    };
    const client: WorldFrameClient = { active: visible && !paused && kind !== "none", fps: kind === "focus" ? 3 : Math.min(quality.fps, preview ? 18 : compact ? 28 : 36), last: 0, draw };
    const unsubscribe = registerWorldClient(client);
    const resize = () => {
      const box = element.getBoundingClientRect(); width = Math.max(1, box.width); height = Math.max(1, box.height);
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
      noiseAt = -Infinity; client.last = 0; draw(performance.now(), 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    return () => {
      unsubscribe(); observer.disconnect(); resources.particles.length = 0;
      texture.width = texture.height = 0;
      element.width = element.height = 0;
    };
  }, [theme, settings.atmosphere, settings.motion, settings.customTheme, paused, visible, preview, quality]);
  return <canvas ref={canvas} className="ambient-particles world-canvas" data-world-kind={worldKind(theme, settings.customTheme)} data-world-mode={!visible ? "hidden" : paused ? "static" : "animated"} aria-hidden="true" />;
});
