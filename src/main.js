// Sonar Cave — main bootstrap (Phases 0-5).
//
// Cave is INVISIBLE. The only things rendered are the accreting sonar point
// cloud + the trajectory polyline. HUD overlays on top. Audio cues fire on
// sweep revolution + PING. Mobile joysticks attach into #hud-root.

import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { createScene } from './scene.js';
import { createLoop, fpsMeter } from './util/perf.js';
import { loadCave } from './cave/loadCave.js';
import { createExitZone } from './cave/exitZone.js';
import { createSub, tickPhysics, applySubToCamera } from './sub/physics.js';
import { resolveCollision, altimeter } from './sub/collision.js';
import { attachDesktopControls, readDesktopThrust } from './sub/controls.js';
import { attachMobileControls } from './sub/controlsMobile.js';
import { createPointCloud } from './sonar/pointcloud.js';
import { createSweep } from './sonar/sweep.js';
import { createHud } from './hud/hud.js';
import { unlockAudio } from './audio/unlock.js';
import { startAmbient } from './audio/ambient.js';
import { playSweepPing, playMultibeamPing } from './audio/ping.js';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

const canvas = document.getElementById('scene');
const bootEl = document.getElementById('boot');
const bootBtn = document.getElementById('boot-btn');
const hudRoot = document.getElementById('hud-root');

// ---- Boot listeners attached FIRST, before any code below that could throw.
// Without this, a top-level error (e.g. WebGL init) leaves the button visible
// but unresponsive. The whole boot overlay is also a click target so taps on
// the black background count as "tap to begin" too.
let bootClicked = false;
function onBootClick(e) {
  if (bootClicked) return;
  bootClicked = true;
  if (e) e.preventDefault();
  // Defer to next tick so any error in start() doesn't swallow the visual
  // hidden-fade that the user expects.
  bootEl.classList.add('hidden');
  setTimeout(() => { try { start(); } catch (err) { console.error('[boot] start failed', err); } }, 0);
}
bootBtn.addEventListener('click', onBootClick);
bootBtn.addEventListener('pointerdown', onBootClick);
bootEl.addEventListener('click', onBootClick);
bootEl.addEventListener('pointerdown', onBootClick);

const { renderer, scene, camera, isContextLost } = createScene(canvas);

// ---------- Two scenes: main (visible) + cave (sonar-only) ----------
const caveScene = new THREE.Scene();
caveScene.background = null;

let sub = null;
let exitZone = null;
let caveMesh = null;
let caveCollisionMesh = null;
let pointcloud = null;
let sweep = null;
let trail = null;
let hud = null;
let mobile = null;
const trailMax = 200;
let trailHead = 0;
let trailFilled = 0;

let exited = false;
let pingCooldownUntil = 0;
const PING_COOLDOWN = 3.0;

// Calibration intro — sub sits still and auto-sweeps for 30s, or until any
// joystick is touched, before player gets control.
const CALIB_SECONDS = 30;
let calibUntil = 0;
let calibActive = false;
let calibHintEl = null;

let bootStartedAt = 0; // for dive-time readout

// Sweep audio — fire once per full revolution (when angle wraps from ~2π → 0).
let lastSweepAngle = 0;

const measure = fpsMeter();
const clock = { now: 0 };

const loop = createLoop((dt) => {
  if (isContextLost()) return;
  if (!sub) return;
  clock.now += dt;

  // Input. Desktop reads always; mobile overwrites if any stick is touched.
  // During calibration we suppress all input.
  if (calibActive && clock.now < calibUntil) {
    // Skip cal if any joystick touched
    if (mobile && mobile.anyTouched) endCalibration();
    else zeroThrust(sub);
  } else {
    if (calibActive) endCalibration();
    readDesktopThrust(sub);
    if (mobile) mobile.readThrust(sub);
  }

  tickPhysics(sub, dt);
  resolveCollision(sub, caveCollisionMesh.geometry);
  applySubToCamera(sub, camera);

  sweep.tick(dt, clock.now);
  pointcloud.flush(clock.now);

  // Sweep audio — angle wraps when it crosses 2π → 0 (current < previous).
  const a = sweep.angle;
  if (a < lastSweepAngle - 1.0) playSweepPing();
  lastSweepAngle = a;

  appendTrail(sub.position);

  if (!exited && exitZone.contains(sub.position)) {
    exited = true;
    onSurfaced();
  }

  if (hud) hud.tick(clock.now);

  // PING button cooldown indicator
  if (mobile) mobile.setPingCooldown(clock.now < pingCooldownUntil);

  renderer.setClearColor(0x000000, 1);
  renderer.render(scene, camera);
  measure();
});

function zeroThrust(s) {
  s.thrust.fwd = 0;
  s.thrust.lateral = 0;
  s.thrust.vertical = 0;
  s.thrust.yaw = 0;
  s.thrust.pitch = 0;
}

function appendTrail(pos) {
  if (!trail) return;
  if (trailFilled > 0) {
    const lastIdx = (trailHead - 1 + trailMax) % trailMax;
    const li = lastIdx * 3;
    const dx = trail.geometry.attributes.position.array[li] - pos.x;
    const dy = trail.geometry.attributes.position.array[li + 1] - pos.y;
    const dz = trail.geometry.attributes.position.array[li + 2] - pos.z;
    if (dx * dx + dy * dy + dz * dz < 0.25) return;
  }
  const a = trail.geometry.attributes.position.array;
  a[trailHead * 3 + 0] = pos.x;
  a[trailHead * 3 + 1] = pos.y;
  a[trailHead * 3 + 2] = pos.z;
  trail.geometry.attributes.position.needsUpdate = true;
  trailHead = (trailHead + 1) % trailMax;
  if (trailFilled < trailMax) trailFilled++;
  trail.geometry.setDrawRange(0, trailFilled);
}

async function start() {
  // Boot already faded by onBootClick. Remove the overlay after the transition.
  setTimeout(() => bootEl.remove(), 700);

  // Audio MUST unlock from inside the user-gesture handler. onBootClick fires
  // start() via setTimeout(…, 0), which keeps us within the user-activation
  // window on every browser we care about.
  unlockAudio();
  startAmbient();

  const { geometry, meta } = await loadCave('./cave.bin', './cave.json');

  caveMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }),
  );
  caveScene.add(caveMesh);

  caveCollisionMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ visible: false }),
  );

  exitZone = createExitZone(meta);
  sub = createSub({
    position: new THREE.Vector3(meta.spawn.x, meta.spawn.y, meta.spawn.z),
    yaw: meta.spawn.yaw,
    pitch: meta.spawn.pitch,
  });
  applySubToCamera(sub, camera);

  pointcloud = createPointCloud();
  scene.add(pointcloud.object);

  sweep = createSweep({
    renderer,
    caveScene,
    pointcloud,
    getSub: () => sub,
  });

  // Trajectory polyline — amber-green
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailMax * 3), 3));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.LineBasicMaterial({
    color: 0x9eff5a,
    transparent: true,
    opacity: 0.55,
    depthTest: false,
    depthWrite: false,
  });
  trail = new THREE.Line(trailGeo, trailMat);
  trail.frustumCulled = false;
  scene.add(trail);

  // ---- HUD
  hud = createHud({
    sub,
    getAltimeter: () => altimeter(sub, geometry, caveCollisionMesh),
    getSweepAngle: () => sweep.angle,
  });

  // ---- Desktop input
  attachDesktopControls(window, canvas, () => firePingAttempt());

  // ---- Mobile input (joysticks + PING button)
  mobile = attachMobileControls({
    container: hudRoot,
    onPing: () => firePingAttempt(),
  });

  // ---- Calibration intro
  calibUntil = CALIB_SECONDS;     // measured against clock.now
  calibActive = true;
  showCalibHint();

  bootStartedAt = performance.now();

  loop.start();
  requestWakeLock();
  lockOrientation();

  // Expose for dev console
  window.__game = {
    get sub() { return sub; },
    get pointcloud() { return pointcloud; },
    get sweep() { return sweep; },
    altimeter: () => altimeter(sub, geometry, caveCollisionMesh),
    scene, caveScene, camera, renderer,
  };
}

function firePingAttempt() {
  if (!sweep) return;
  if (clock.now < pingCooldownUntil) return;
  pingCooldownUntil = clock.now + PING_COOLDOWN;
  sweep.firePing();
  playMultibeamPing();
}

function showCalibHint() {
  calibHintEl = document.createElement('div');
  calibHintEl.className = 'calib-hint';
  calibHintEl.innerHTML = 'CALIBRATING SONAR<span class="calib-sub">touch to begin</span>';
  hudRoot.appendChild(calibHintEl);
}

function endCalibration() {
  calibActive = false;
  if (calibHintEl && calibHintEl.parentNode) calibHintEl.parentNode.removeChild(calibHintEl);
  calibHintEl = null;
}

function onSurfaced() {
  console.log('[exit] surfaced');
  const elapsed = (performance.now() - bootStartedAt) / 1000;
  const mins = Math.floor(elapsed / 60);
  const secs = (elapsed - mins * 60).toFixed(1);
  const overlay = document.createElement('div');
  overlay.id = 'surfaced';

  const title = document.createElement('div');
  title.className = 'surfaced-title';
  title.textContent = 'SURFACED';
  overlay.appendChild(title);

  const time = document.createElement('div');
  time.className = 'surfaced-time';
  time.textContent = `DIVE TIME  ${String(mins).padStart(2, '0')}:${secs.padStart(4, '0')}`;
  overlay.appendChild(time);

  const again = document.createElement('button');
  again.className = 'surfaced-again';
  again.textContent = 'Dive again';
  again.addEventListener('click', () => location.reload());
  again.addEventListener('pointerdown', () => location.reload());
  overlay.appendChild(again);

  document.body.appendChild(overlay);

  // Show install prompt after surfaced if we have one cached.
  maybeShowInstall();
}

// (Boot listeners attached at top of file — before anything that can throw.)

document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else if (sub && (!bootEl.isConnected || bootEl.classList.contains('hidden'))) loop.start();
});

let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.warn('[wake] request failed', err);
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !wakeLock) requestWakeLock();
});

function lockOrientation() {
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch { /* iOS rejects */ }
}

// ---- Install prompt — capture beforeinstallprompt and offer a small button
let deferredInstallEvent = null;
let installBtn = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallEvent = e;
  ensureInstallButton();
});

function ensureInstallButton() {
  if (installBtn) return;
  installBtn = document.createElement('button');
  installBtn.id = 'install-btn';
  installBtn.textContent = 'Install';
  installBtn.addEventListener('click', async () => {
    if (!deferredInstallEvent) return;
    deferredInstallEvent.prompt();
    try { await deferredInstallEvent.userChoice; } catch { /* ignore */ }
    deferredInstallEvent = null;
    installBtn.classList.remove('show');
  });
  document.body.appendChild(installBtn);
  installBtn.classList.add('show');
}

function maybeShowInstall() {
  if (deferredInstallEvent) ensureInstallButton();
}

// Service worker is production-only. In dev (Vite's dev server) a stale SW
// from a previous `npm run preview` would intercept and serve cached HTML
// forever; only PROD builds have a token-keyed SW that invalidates correctly.
// In dev, also unregister any SW that's somehow still around — recovers users
// who hit the stale-SW trap before this fix landed.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
        console.warn('[sw] register failed', err);
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      if (regs.length) {
        console.info('[sw] dev mode — unregistering', regs.length, 'leftover worker(s)');
        regs.forEach((r) => r.unregister());
        caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
      }
    }).catch(() => {});
  }
}
