import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DynamicDrawUsage, type InstancedBufferGeometry } from "three";
import type { PrismSettings } from "../../lib/schema";
import { METEOR_CAPACITY, MeteorShower } from "../../lib/meteors";
import { meteorFragment, meteorVertex } from "./shaders";

export function MeteorLayer({
  settings,
  paused,
  visible,
  compact,
}: {
  settings: PrismSettings;
  paused: boolean;
  visible: boolean;
  compact: boolean;
}) {
  const { camera, size, gl } = useThree();
  const shower = useMemo(() => new MeteorShower(), []);
  const geometry = useRef<InstancedBufferGeometry>(null);
  const resume = useRef(true);
  const buffers = useMemo(
    () => ({
      head: new Float32Array(METEOR_CAPACITY * 3),
      shape: new Float32Array(METEOR_CAPACITY * 4),
      brightness: new Float32Array(METEOR_CAPACITY),
      position: new Float32Array([
        -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0,
        -0.5, 0.5, 0,
      ]),
      uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]),
    }),
    [],
  );

  useLayoutEffect(() => {
    resume.current = true;
    if (paused || settings.meteorShower === "off") {
      shower.clear();
      buffers.brightness.fill(0);
      if (geometry.current)
        geometry.current.attributes.aBrightness.needsUpdate = true;
    }
  }, [paused, visible, settings.meteorShower, buffers, shower]);

  useFrame((_, delta) => {
    if (!paused && visible && !document.hidden) {
      shower.step(
        resume.current ? 0 : delta,
        settings.meteorShower,
        settings.meteorSpeed,
        compact,
        camera.projectionMatrix.elements,
        size.height,
      );
      resume.current = false;
      for (let i = 0; i < METEOR_CAPACITY; i++) {
        const m = shower.pool[i];
        buffers.brightness[i] = m.active ? m.brightness : 0;
        if (!m.active) continue;
        buffers.head[i * 3] = m.x;
        buffers.head[i * 3 + 1] = m.y;
        buffers.head[i * 3 + 2] = -m.depth;
        buffers.shape[i * 4] = m.dx;
        buffers.shape[i * 4 + 1] = m.dy;
        buffers.shape[i * 4 + 2] = m.length;
        buffers.shape[i * 4 + 3] = m.width;
      }
      if (geometry.current) {
        geometry.current.attributes.aHead.needsUpdate = true;
        geometry.current.attributes.aShape.needsUpdate = true;
        geometry.current.attributes.aBrightness.needsUpdate = true;
      }
    }
    if (import.meta.env.DEV) {
      gl.domElement.dataset.prismEvents = String(shower.spawned);
      gl.domElement.dataset.prismRecycled = String(shower.recycled);
      gl.domElement.dataset.prismMeteors = String(shower.visibleCount);
      gl.domElement.dataset.prismActiveMeteors = String(shower.activeCount);
      gl.domElement.dataset.prismMeteor = String(shower.visibleCount > 0);
    }
  });

  return (
    <mesh frustumCulled={false} renderOrder={2}>
      <instancedBufferGeometry ref={geometry} instanceCount={METEOR_CAPACITY}>
        <bufferAttribute
          attach="attributes-position"
          args={[buffers.position, 3]}
        />
        <bufferAttribute attach="attributes-uv" args={[buffers.uv, 2]} />
        <instancedBufferAttribute
          attach="attributes-aHead"
          args={[buffers.head, 3]}
          usage={DynamicDrawUsage}
        />
        <instancedBufferAttribute
          attach="attributes-aShape"
          args={[buffers.shape, 4]}
          usage={DynamicDrawUsage}
        />
        <instancedBufferAttribute
          attach="attributes-aBrightness"
          args={[buffers.brightness, 1]}
          usage={DynamicDrawUsage}
        />
      </instancedBufferGeometry>
      <shaderMaterial
        vertexShader={meteorVertex}
        fragmentShader={meteorFragment}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
