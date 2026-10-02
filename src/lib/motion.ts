import { useEffect, useState, type PointerEvent } from "react";

// Subscribe directly: motion/react's useReducedMotion captures its initial
// value and does not rerender this app when the OS preference changes.
export function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Capture only the entry into an interactive surface. This gives the rose
// bloom a pointer origin without a mousemove listener or a DOM animation loop.
export function surfaceMotionOrigin(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === "touch") return;
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    ".course-card, .agenda-item, .schedule-block, .mobile-session, .theme-choice, .button",
  );
  if (!target || target.contains(event.relatedTarget as Node | null)) return;
  const bounds = target.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  target.style.setProperty("--motion-origin-x", `${Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100))}%`);
  target.style.setProperty("--motion-origin-y", `${Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100))}%`);
}
