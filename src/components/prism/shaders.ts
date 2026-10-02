export const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uPixelRatio;
  uniform vec2 uShift;
  uniform float uDrift;
  uniform float uAspect;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  attribute float aLuminance;
  attribute float aLayer;
  varying vec3 vColor;
  varying float vLight;
  void main() {
    vec3 p = position;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    float halfHeight = -view.z * 0.46630766;
    vec2 extent = vec2(halfHeight * uAspect, halfHeight);
    float speed = aLayer < 0.5 ? 0.00014 : aLayer < 1.5 ? 0.00072 : 0.0024;
    vec2 direction = aLayer < 0.5 ? vec2(0.8, -0.3) : aLayer < 1.5 ? vec2(1.0, 0.22) : vec2(0.85, -0.38);
    // Wrap beyond the viewport, not at its edge; preserve the real depth and
    // give each layer its own continuous, independent screen-space drift.
    vec2 sky = view.xy / extent + direction * speed * uDrift;
    view.xy = (mod(sky + 1.09, 2.18) - 1.09) * extent + uShift;
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(aSize * 24.0 / -view.z, 2.0, 8.0) * uPixelRatio;
    float twinkle = sin(uTime * (0.18 + aLuminance * 0.12) + aPhase) * 0.20
                  + sin(uTime * 0.13 + aPhase * 2.7) * 0.10;
    vLight = aLuminance * (1.0 + uTwinkle * twinkle * step(4.7, aPhase));
    vColor = aColor;
  }
`;
export const starFragment = /* glsl */ `
  uniform float uBrightness;
  varying vec3 vColor;
  varying float vLight;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r2 = dot(p, p);
    float core = exp(-r2 * 38.0);
    float halo = exp(-r2 * 10.0) * 0.045;
    float alpha = (core + halo) * vLight * uBrightness;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
    #include <colorspace_fragment>
  }
`;
export const sweepVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.99, 1.0);
  }
`;
export const sweepFragment = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  varying vec2 vUv;
  void main() {
    vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y);
    float travel = sin(uTime * 0.028) * 0.095;
    float axis = p.y - (0.43 + p.x * 0.23 + travel);
    float veil = exp(-axis * axis * 24.0);
    float beam = exp(-axis * axis * 720.0);
    float split = 0.018;
    vec3 refraction = vec3(
      exp(-pow(axis + split, 2.0) * 1500.0),
      exp(-axis * axis * 1500.0),
      exp(-pow(axis - split, 2.0) * 1500.0)
    );
    float falloff = smoothstep(-0.7, 0.7, p.x) * (0.7 + 0.3 * sin(uTime * 0.012 + p.x));
    vec3 light = vec3(0.18, 0.26, 0.48) * veil * 0.4
               + vec3(0.59, 0.66, 0.82) * beam * 0.17
               + refraction * vec3(0.55, 0.71, 0.95) * 0.18;
    gl_FragColor = vec4(light, min(0.23, (veil * 0.1 + beam * 0.05) * falloff));
    #include <colorspace_fragment>
  }
`;
export const meteorVertex = /* glsl */ `
  attribute vec3 aHead;
  attribute vec4 aShape;
  attribute float aBrightness;
  varying vec2 vUv;
  varying float vLength;
  varying float vWidth;
  varying float vBrightness;
  void main() {
    vUv = uv;
    vLength = aShape.z;
    vWidth = aShape.w;
    vBrightness = aBrightness;
    if (aBrightness <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vec2 direction = aShape.xy;
    vec2 normal = vec2(-direction.y, direction.x);
    float pad = vWidth * 4.0;
    vec2 offset = direction * ((position.x - 0.5) * (vLength + pad) + pad)
                + normal * position.y * vWidth * 8.0;
    // Camera-space geometry uses the active projection, at three real depths.
    gl_Position = projectionMatrix * vec4(aHead.xy + offset, aHead.z, 1.0);
  }
`;
export const meteorFragment = /* glsl */ `
  varying vec2 vUv;
  varying float vLength;
  varying float vWidth;
  varying float vBrightness;
  void main() {
    float cross = vUv.y - 0.5;
    float behind = (1.0 - vUv.x) * (vLength + vWidth * 4.0) - vWidth * 4.0;
    float taper = mix(0.04, 0.16, pow(vUv.x, 0.7));
    float tail = pow(vUv.x, 1.8) * exp(-pow(cross / taper, 2.0) * 2.0) * step(0.0, behind);
    float head = exp(-pow(behind / (vWidth * 1.3), 2.0) - cross * cross * 95.0);
    float halo = exp(-pow(behind / (vWidth * 3.0), 2.0) - cross * cross * 24.0) * 0.17;
    // Stable flight opacity. Only the trail's spatial gradient fades.
    float alpha = (tail * 0.65 + head + halo) * vBrightness;
    if (alpha < 0.003) discard;
    vec3 color = mix(vec3(0.65, 0.78, 1.0), vec3(0.96, 0.98, 1.0), vUv.x);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;
