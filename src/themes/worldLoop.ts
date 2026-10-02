import { worldDelta } from "./worlds";

export interface WorldFrameClient {
  active: boolean;
  fps: number;
  last: number;
  draw: (time: number, delta: number, interval: number) => void;
}

// Pure dispatch is shared by the browser scheduler and tests. Inactive clients
// forget their clock so restoring a scene never integrates hidden time.
export function dispatchWorldFrames(clients: Iterable<WorldFrameClient>, stamp: number, hidden: boolean): void {
  for (const client of clients) {
    if (hidden || !client.active) { client.last = 0; continue; }
    const interval = client.last ? stamp - client.last : 0;
    if (client.last && interval < 1000 / client.fps - 1) continue;
    // Execution can be suspended without a visibility event (OS sleep, debugger,
    // or browser lifecycle freezing). Bound a long gap to a small step rather
    // than freeze the world on every frame of a continuously slow device.
    // Focus's intentionally slow cadence still receives its normal full delta.
    const suspended = interval > Math.max(250, 2000 / client.fps);
    const delta = client.last ? worldDelta(interval / 1000, suspended ? .05 : Math.max(.05, 1.5 / client.fps)) : 0;
    client.last = stamp;
    client.draw(stamp, delta, interval);
  }
}

const clients = new Set<WorldFrameClient>();
let frame = 0;
let timer = 0;
let listening = false;
let drawing = false;
export const worldPointer = { x: 0, y: 0 };

export function worldLoopStats() {
  return { clients: clients.size, active: [...clients].filter(client => client.active).length, loops: frame || timer || drawing ? 1 : 0, listeners: listening ? 3 : 0 };
}

const move = (event: PointerEvent) => {
  if (event.pointerType !== "mouse") return;
  worldPointer.x = event.clientX / window.innerWidth - .5;
  worldPointer.y = event.clientY / window.innerHeight - .5;
};
const leave = () => { worldPointer.x = worldPointer.y = 0; };
const cancel = () => { cancelAnimationFrame(frame); clearTimeout(timer); frame = timer = 0; };
function schedule() {
  if (frame || timer || document.hidden) return;
  const active = [...clients].filter(client => client.active);
  if (!active.length) return;
  const delay = nextWorldFrameDelay(active, performance.now());
  timer = window.setTimeout(() => { timer = 0; frame = requestAnimationFrame(tick); }, Math.max(0, delay - 8));
}

// An early RAF should retry its remaining deadline, rather than wait another
// entire period. This matters for Focus's deliberately low three-Hz cadence.
export function nextWorldFrameDelay(clients: Iterable<WorldFrameClient>, stamp: number): number {
  let delay = Infinity;
  for (const client of clients) {
    if (!client.active) continue;
    delay = Math.min(delay, client.last ? Math.max(0, 1000 / Math.min(36, client.fps) - (stamp - client.last)) : 0);
  }
  return delay;
}
function tick(stamp: number) {
  frame = 0;
  drawing = true;
  dispatchWorldFrames(clients, stamp, document.hidden);
  drawing = false;
  schedule();
}
function visibility() {
  for (const client of clients) client.last = 0;
  leave();
  if (document.hidden) cancel(); else schedule();
}

export function registerWorldClient(client: WorldFrameClient): () => void {
  clients.add(client);
  if (!listening) {
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    listening = true;
  }
  schedule();
  return () => {
    if (!clients.delete(client)) return;
    if (!clients.size) {
      cancel(); leave();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      listening = false;
    } else if (![...clients].some(item => item.active)) cancel();
  };
}
