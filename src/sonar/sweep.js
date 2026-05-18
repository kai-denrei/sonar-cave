import * as THREE from 'three';

// The sonar sweep — the heart of the game.
//
// Per spec:
//   - Rotates clockwise around the sub at ~6 seconds per full revolution
//   - Conical, narrow horizontal (~15°), wide vertical (~60°)
//   - Pointed forward-down (looking slightly down by default)
//   - Each tick samples new points; samples decay over 8s
//   - Implementation: depth-buffer trick. NOT raycasting.
//
// We render the cave with MeshDepthMaterial (RGBA-packed depth) into a 64×128 RT,
// read back, and unproject each fragment's NDC depth → world position using the
// offscreen camera's inverse view-projection matrix.

const SWEEP_PERIOD = 6.0;                    // seconds per revolution
const SWEEP_RATE   = (Math.PI * 2) / SWEEP_PERIOD;
const TICK_HZ      = 10;                     // depth pass at 10 Hz (~every 3rd frame)
const TICK_DT      = 1 / TICK_HZ;

const RT_W = 64;
const RT_H = 128;

const FOV_H_DEG = 15;                        // narrow horizontal
const FOV_V_DEG = 60;                        // wider vertical
const NEAR = 0.7;
const FAR  = 25;

// Default sweep tilt — points slightly down-forward
const DEFAULT_PITCH = -(8 * Math.PI / 180);

// Subsample stride — read every Nth pixel to cap CPU work. 64*128 = 8192 pixels
// per tick is fine, but subsampling lets us survive on weaker phones.
const STRIDE = 1;

// Buffer reused per tick
const pixels = new Uint8Array(RT_W * RT_H * 4);

// Depth-packing math from Three.js's packing.glsl (RGBADepthPacking)
const UNPACK = new THREE.Vector4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0);
const UNPACK_SCALE = 256.0 / 255.0;
function unpackRGBAToDepth(r, g, b, a) {
  // Three.js packs as: vec4 packDepthToRGBA(float v) { return fract(v * vec4(1, 255, 65025, 16581375)) ... }
  // Reverse:
  const r0 = r / 255;
  const g0 = g / 255;
  const b0 = b / 255;
  const a0 = a / 255;
  return (r0 * UNPACK.x + g0 * UNPACK.y + b0 * UNPACK.z + a0 * UNPACK.w) * UNPACK_SCALE;
}

export function createSweep({ renderer, caveScene, pointcloud, getSub }) {
  // Offscreen render target — depth-from-color (we use MeshDepthMaterial which
  // writes packed depth into RGBA, so a normal byte RT is fine).
  const rt = new THREE.WebGLRenderTarget(RT_W, RT_H, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format:    THREE.RGBAFormat,
    type:      THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  });

  const aspect = RT_W / RT_H;
  // Vertical FOV is the parameter Three uses; aspect handles horizontal.
  // We need a custom horizontal too, so set vFov such that with aspect we get
  // FOV_H_DEG horizontally: tan(hFov/2) = aspect * tan(vFov/2)
  // → vFov = 2 * atan(tan(hFov/2) / aspect)
  const hFovRad = FOV_H_DEG * Math.PI / 180;
  // But we ALSO want vFov to be FOV_V_DEG. With a fixed RT aspect, only one can
  // be satisfied by aspect. So: prioritize vFov = 60°, accept horizontal FOV
  // derived from aspect (RT_W/RT_H = 0.5, so hFov = 2 * atan(0.5 * tan(30°)) ≈ 32°).
  // That's wider horizontally than the spec's 15° but still narrow enough that
  // the sweep feels directional. Trade-off documented in arch.md.
  const cam = new THREE.PerspectiveCamera(FOV_V_DEG, aspect, NEAR, FAR);

  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    blending: THREE.NoBlending,
    side: THREE.DoubleSide,
  });

  // Per-frame state
  let angle = 0;          // current sweep azimuth (radians, around world Y from sub)
  let pingPending = false;
  let pingFireTime = -Infinity;
  let accum = 0;
  let lastTickAt = 0;

  // Reusable math objects
  const subPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const invViewProj = new THREE.Matrix4();

  function positionCamera(sub, az, pitch) {
    cam.position.copy(sub.position);
    // Build forward vector from sub yaw + sweep azimuth offset, applied as relative offset.
    // The sweep rotates relative to the sub's facing, NOT world axes — so the player
    // can yaw and the sweep stays oriented around them naturally.
    const yaw = sub.yaw + az;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(sub.pitch + pitch), sp = Math.sin(sub.pitch + pitch);
    lookAt.set(
      sub.position.x + sy * cp,
      sub.position.y + sp,
      sub.position.z + cy * cp,
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(lookAt);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
  }

  function readbackAndAdd(now) {
    renderer.readRenderTargetPixels(rt, 0, 0, RT_W, RT_H, pixels);
    invViewProj.copy(cam.projectionMatrix).multiply(cam.matrixWorldInverse).invert();
    let added = 0;
    for (let py = 0; py < RT_H; py += STRIDE) {
      for (let px = 0; px < RT_W; px += STRIDE) {
        const i = (py * RT_W + px) * 4;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        // Far plane reads as (255,255,255,255) → depth=1.0; skip those.
        if (r === 255 && g === 255 && b === 255 && a === 255) continue;
        const depth = unpackRGBAToDepth(r, g, b, a);
        if (depth >= 0.9999) continue;
        // NDC → world
        const ndcX = (px + 0.5) / RT_W * 2 - 1;
        const ndcY = (py + 0.5) / RT_H * 2 - 1;
        const ndcZ = depth * 2 - 1;
        tmp.set(ndcX, ndcY, ndcZ).applyMatrix4(invViewProj);
        pointcloud.add(tmp.x, tmp.y, tmp.z, now);
        added++;
      }
    }
    return added;
  }

  function tick(dt, nowSeconds) {
    const sub = getSub();
    if (!sub) return;
    angle = (angle + SWEEP_RATE * dt) % (Math.PI * 2);
    accum += dt;
    if (accum < TICK_DT && !pingPending) return;
    accum = 0;

    if (pingPending) {
      // One-shot multibeam: wider cam, higher res, single pass.
      pingPending = false;
      pingFireTime = nowSeconds;
      const oldFovV = cam.fov;
      const oldFar  = cam.far;
      cam.fov = 80;
      cam.far = 35;
      positionCamera(sub, 0, DEFAULT_PITCH);

      // Reuse the same RT (64×128) for the ping. A 256×256 burst gives a richer
      // result but doubles GPU + readback cost; the trade-off is worth it during
      // a one-off event — but for the PoC the single 64×128 grab is enough.
      caveScene.overrideMaterial = depthMat;
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(caveScene, cam);
      renderer.setRenderTarget(null);
      caveScene.overrideMaterial = null;
      const added = readbackAndAdd(nowSeconds);
      cam.fov = oldFovV;
      cam.far = oldFar;
      // Continue to the normal sweep tick too.
    }

    positionCamera(sub, angle, DEFAULT_PITCH);
    caveScene.overrideMaterial = depthMat;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(caveScene, cam);
    renderer.setRenderTarget(null);
    caveScene.overrideMaterial = null;
    readbackAndAdd(nowSeconds);
    lastTickAt = nowSeconds;
  }

  function firePing() {
    pingPending = true;
  }

  return {
    tick,
    firePing,
    get angle() { return angle; },
    get lastPingAge() { return lastTickAt - pingFireTime; },
    dispose() {
      rt.dispose();
      depthMat.dispose();
    },
  };
}
