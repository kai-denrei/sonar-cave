import * as THREE from 'three';

// Accreting point cloud. Ring buffer of (x, y, z, birthTime) entries.
// Rendered as a single THREE.Points draw call with a custom additive shader.
// Per spec: brightness fades from full → ~20% over 8s, then holds at floor.

export const MAX_POINTS = 150_000;
const FADE_SECONDS = 8;

const vertexShader = /* glsl */ `
  attribute float aBirth;
  uniform float uNow;
  uniform float uFade;
  uniform float uPixelRatio;
  uniform float uSize;
  varying float vBright;
  void main() {
    float age = uNow - aBirth;
    float t = clamp(age / uFade, 0.0, 1.0);
    // Bright fresh → dim aged. Floor at 0.2 forever.
    vBright = mix(1.0, 0.2, t);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Slight perspective size; clamp so close points don't blow up
    float dist = max(0.5, -mv.z);
    gl_PointSize = clamp(uSize * uPixelRatio / dist, 1.5, 8.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying float vBright;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c);
    if (r2 > 0.25) discard;
    // Soft round sprite, falloff toward edge
    float a = smoothstep(0.25, 0.05, r2);
    // Cyan, bias toward white when fresh
    vec3 hot  = vec3(0.85, 1.0, 1.0);
    vec3 cool = vec3(0.10, 0.55, 0.60);
    vec3 col  = mix(cool, hot, vBright);
    gl_FragColor = vec4(col * vBright * a, a * vBright);
  }
`;

export function createPointCloud() {
  const positions = new Float32Array(MAX_POINTS * 3);
  const births    = new Float32Array(MAX_POINTS);
  // Fill with a value so all initial points are "old" — invisible at floor brightness.
  // We don't render them anyway until they get overwritten because the geometry
  // draw count is bumped only when we write.
  let writeHead = 0;
  let filled = 0;

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const birAttr = new THREE.BufferAttribute(births, 1);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  birAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aBirth', birAttr);
  geo.setDrawRange(0, 0);

  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uNow: { value: 0 },
      uFade: { value: FADE_SECONDS },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uSize: { value: 22 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // we manage extent manually

  // Sub-frame dirty regions so we minimize GL uploads each frame.
  let dirtyLo = Infinity;
  let dirtyHi = 0;

  function add(x, y, z, birthTime) {
    const i = writeHead;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    births[i] = birthTime;
    if (i < dirtyLo) dirtyLo = i;
    if (i > dirtyHi) dirtyHi = i;
    writeHead = (writeHead + 1) % MAX_POINTS;
    if (filled < MAX_POINTS) filled++;
  }

  function flush(nowSeconds) {
    mat.uniforms.uNow.value = nowSeconds;
    geo.setDrawRange(0, filled);
    if (dirtyLo <= dirtyHi) {
      // r160+ partial-upload API. updateRange-the-object is deprecated.
      posAttr.clearUpdateRanges();
      birAttr.clearUpdateRanges();
      posAttr.addUpdateRange(dirtyLo * 3, (dirtyHi - dirtyLo + 1) * 3);
      birAttr.addUpdateRange(dirtyLo,     (dirtyHi - dirtyLo + 1));
      posAttr.needsUpdate = true;
      birAttr.needsUpdate = true;
      dirtyLo = Infinity;
      dirtyHi = 0;
    }
  }

  function clear() {
    writeHead = 0;
    filled = 0;
    geo.setDrawRange(0, 0);
  }

  return { object: points, add, flush, clear, get count() { return filled; } };
}
