import {
  Component,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { NoToneMapping, Vector2, type ShaderMaterial } from "three";
import type { PrismSettings } from "../../lib/schema";
import { createStarField, driftIntensity, frameDelta } from "../../lib/prism";
import {
  starFragment,
  starVertex,
  sweepFragment,
  sweepVertex,
} from "./shaders";
import { MeteorLayer } from "./MeteorLayer";
import type { VisualQualityProfile } from "../../themes/quality";

interface Props {
  settings: PrismSettings;
  motion: number;
  paused: boolean;
  visible: boolean;
  quality?: VisualQualityProfile;
  onFrameSample?: (costMs: number, intervalMs: number) => void;
}

function useCompactDisplay() {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 700px), (pointer: coarse)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px), (pointer: coarse)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}

class SkyBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function StaticSky({
  settings,
  compact,
}: {
  settings: PrismSettings;
  compact: boolean;
}) {
  const field = useMemo(
    () =>
      createStarField(settings.starfield ? settings.density : 0, 1, compact),
    [settings.starfield, settings.density, compact],
  );
  return (
    <div className="prism-static-sky" data-prism-renderer="static">
      <div className="prism-static-refraction" />
      <svg width="100%" height="100%" aria-hidden="true">
        {Array.from({ length: field.count }, (_, i) => (
          <circle
            key={i}
            cx={`${field.screen[i * 2] * 100}%`}
            cy={`${(1 - field.screen[i * 2 + 1]) * 100}%`}
            r={field.sizes[i] / 7}
            fill={`rgb(${Array.from(field.colors.slice(i * 3, i * 3 + 3), (c) => Math.round(c * 255)).join(",")})`}
            opacity={(field.luminance[i] * settings.brightness) / 100}
          />
        ))}
      </svg>
    </div>
  );
}

function PrismSpace(props: Props) {
  const compact = useCompactDisplay();
  const [lost, setLost] = useState(false);
  const fallback = <StaticSky settings={props.settings} compact={compact} />;
  const maximumDpr = (compact || navigator.hardwareConcurrency <= 4 ? 1 : 1.25) * (props.quality?.dprScale ?? 1);
  return (
    <div
      className="prism-space"
      data-prism-mode={
        !props.visible ? "hidden" : props.paused ? "static" : "animated"
      }
    >
      {lost ? (
        fallback
      ) : (
        <SkyBoundary fallback={fallback}>
          <Canvas
            camera={{ fov: 50, near: 0.1, far: 140, position: [0, 0, 8] }}
            frameloop={props.paused || !props.visible ? "never" : "demand"}
            dpr={[Math.min(1, maximumDpr), maximumDpr]}
            shadows={false}
            events={() => ({ enabled: false, priority: 0 })}
            gl={{
              alpha: true,
              antialias: false,
              depth: false,
              stencil: false,
              powerPreference: "low-power",
              preserveDrawingBuffer: false,
            }}
            resize={{ scroll: false, debounce: { resize: 120, scroll: 0 } }}
            fallback={fallback}
            onCreated={({ gl }) => {
              gl.toneMapping = NoToneMapping;
              gl.setClearColor(0x000000, 0);
              gl.domElement.setAttribute("aria-hidden", "true");
              gl.domElement.dataset.prismRenderer = "webgl";
              gl.domElement.addEventListener(
                "webglcontextlost",
                (event) => {
                  event.preventDefault();
                  setLost(true);
                },
                { once: true },
              );
            }}
          >
            <SpaceScene {...props} compact={compact} />
          </Canvas>
        </SkyBoundary>
      )}
    </div>
  );
}
export default memo(PrismSpace);

// The app clock updates its context every second. Fiber bridges that context;
// memoize this independent scene so a static sky does not render on each tick.
const SpaceScene = memo(function SpaceScene({
  settings,
  motion,
  paused,
  visible,
  compact,
  quality,
  onFrameSample,
}: Props & { compact: boolean }) {
  const { size, gl, invalidate, advance, setDpr } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const field = useMemo(
    () =>
      createStarField(
        settings.starfield ? settings.density : 0,
        aspect,
        compact,
      ),
    [settings.starfield, settings.density, aspect, compact],
  );
  const starMaterial = useRef<ShaderMaterial>(null);
  const sweepMaterial = useRef<ShaderMaterial>(null);
  const pointer = useRef(new Vector2());
  const smoothPointer = useRef(new Vector2());
  const runtime = useRef({
    time: 0,
    drift: 0,
    resume: true,
    slowFrames: 0,
    lastFrame: 0,
  });
  const stars = useMemo(
    () => ({
      uTime: { value: 0 },
      uTwinkle: { value: 0 },
      uBrightness: { value: 0 },
      uPixelRatio: { value: 1 },
      uShift: { value: new Vector2() },
      uDrift: { value: 0 },
      uAspect: { value: 1 },
    }),
    [],
  );
  const sweep = useMemo(
    () => ({ uTime: { value: 0 }, uAspect: { value: 1 } }),
    [],
  );

  // Fiber preserves and merges the material's uniform targets. Bind those
  // actual targets before effects/frame updates, rather than a detached copy.
  useLayoutEffect(() => {
    if (starMaterial.current)
      Object.assign(stars, starMaterial.current.uniforms);
    if (sweepMaterial.current)
      Object.assign(sweep, sweepMaterial.current.uniforms);
  }, [stars, sweep]);

  useEffect(() => {
    stars.uBrightness.value = settings.brightness / 100;
    stars.uTwinkle.value = paused ? 0 : settings.twinkle / 100;
    stars.uPixelRatio.value = gl.getPixelRatio();
    stars.uAspect.value = aspect;
    sweep.uAspect.value = aspect;
    if (visible && !paused) invalidate();
  }, [
    settings.brightness,
    settings.twinkle,
    paused,
    visible,
    size.width,
    size.height,
    aspect,
    gl,
    invalidate,
    stars,
    sweep,
  ]);

  useEffect(() => {
    const state = runtime.current;
    state.resume = true;
    pointer.current.set(0, 0);
    if (paused) {
      smoothPointer.current.set(0, 0);
      stars.uShift.value.set(0, 0);
    }
  }, [paused, visible, stars]);

  // Demand rendering stays entirely idle for static/hidden scenes. Never drive a
  // full-refresh-rate loop for a distant ambient background.
  useEffect(() => {
    if (!visible) return;
    if (paused) {
      // A single explicit draw applies edits/resizes to a static sky. "never"
      // also blocks incidental invalidations from the bridged dashboard clock.
      advance(performance.now() / 1000);
      return;
    }
    invalidate();
    const interval = window.setInterval(
      () => {
        if (!document.hidden) invalidate();
      },
      1000 / (quality?.fps ?? (compact ? 30 : 36)),
    );
    return () => window.clearInterval(interval);
  }, [paused, visible, compact, settings, aspect, advance, invalidate, quality?.fps]);

  useEffect(() => {
    if (paused || !visible || compact || settings.parallax === 0) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointer.current.set(
        event.clientX / window.innerWidth - 0.5,
        0.5 - event.clientY / window.innerHeight,
      );
    };
    const leave = () => pointer.current.set(0, 0);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [paused, visible, compact, settings.parallax]);

  useFrame((_, delta) => {
    const state = runtime.current;
    if (import.meta.env.DEV) {
      gl.domElement.dataset.prismFrames = String(++state.lastFrame);
      gl.domElement.dataset.prismDrawCalls = String(gl.info.render.calls);
      gl.domElement.dataset.prismStars = String(field.count);
      gl.domElement.dataset.prismGeometries = String(gl.info.memory.geometries);
      gl.domElement.dataset.prismTextures = String(gl.info.memory.textures);
      gl.domElement.dataset.prismPrograms = String(gl.info.programs?.length ?? 0);
      gl.domElement.dataset.prismTime = String(state.time);
      gl.domElement.dataset.prismDrift = String(state.drift);
    }
    if (paused || !visible || document.hidden) return;
    // The first restored frame must never consume the time spent hidden.
    const dt = state.resume ? 0 : frameDelta(delta);
    if (!state.resume) onFrameSample?.(0, delta * 1000);
    state.resume = false;
    state.time += dt;
    state.drift += dt * driftIntensity(settings.drift, motion);
    stars.uTime.value = state.time;
    stars.uDrift.value = state.drift;
    sweep.uTime.value += dt * (0.15 + (motion / 100) * 0.85);
    // Lower the GPU pixel budget on sustained slow devices, without adding
    // bloom or changing the scheduler's real-time event intervals.
    if (delta > 0.065 && delta < 0.25) state.slowFrames++;
    else state.slowFrames = Math.max(0, state.slowFrames - 1);
    if (!quality && state.slowFrames > 90 && gl.getPixelRatio() > 1.05) {
      setDpr(1);
      state.slowFrames = 0;
    }
    stars.uPixelRatio.value = gl.getPixelRatio();
    smoothPointer.current.lerp(pointer.current, 1 - Math.exp(-dt * 0.85));
    const strength = ((settings.parallax / 100) * motion) / 100;
    stars.uShift.value.set(
      (smoothPointer.current.x * 2.4 +
        (compact ? Math.sin(state.time * 0.12) * 0.25 : 0)) *
        strength,
      (smoothPointer.current.y * 1.8 +
        (compact ? Math.sin(state.time * 0.09) * 0.16 : 0)) *
        strength,
    );
  });
  return (
    <>
      <mesh frustumCulled={false} renderOrder={3}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={sweepMaterial}
          vertexShader={sweepVertex}
          fragmentShader={sweepFragment}
          uniforms={sweep}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <points frustumCulled={false} renderOrder={1}>
        {/* Replacing the geometry disposes its old GPU buffers on resize/density edits. */}
        <bufferGeometry key={`${field.count}:${aspect}:${compact}`}>
          <bufferAttribute
            attach="attributes-position"
            args={[field.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-aColor"
            args={[field.colors, 3]}
          />
          <bufferAttribute attach="attributes-aSize" args={[field.sizes, 1]} />
          <bufferAttribute
            attach="attributes-aPhase"
            args={[field.phases, 1]}
          />
          <bufferAttribute
            attach="attributes-aLuminance"
            args={[field.luminance, 1]}
          />
          <bufferAttribute
            attach="attributes-aLayer"
            args={[field.layers, 1]}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={starMaterial}
          vertexShader={starVertex}
          fragmentShader={starFragment}
          uniforms={stars}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      <MeteorLayer
        settings={settings}
        paused={paused}
        visible={visible}
        compact={compact}
      />
    </>
  );
});
