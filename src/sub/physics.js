import * as THREE from 'three';
import { clamp } from '../util/math.js';

// Newtonian sub physics. Six-DOF-ish: linear (forward/lateral/vertical) + rotational
// (yaw, pitch). Roll is locked to zero — simpler to fly and reads "right way up" in
// the HUD. ~80 lines as the spec asked.
//
// Tunables per spec:
//   - Top forward speed ~2 m/s
//   - Yaw rate cap   ~45°/s
//   - Pitch rate cap ~30°/s
//   - Releasing thrust → stop within ~3s
//   - Slightly negative buoyancy → drifts up slowly

const FORWARD_THRUST  = 4.0;   // m/s²
const LATERAL_THRUST  = 2.0;
const VERTICAL_THRUST = 3.5;
const YAW_TORQUE      = 2.6;   // rad/s²
const PITCH_TORQUE    = 1.8;

const LINEAR_DRAG    = 1.2;    // quadratic
const ANGULAR_DRAG   = 3.5;    // exponential

const MAX_SPEED_FWD  = 2.0;
const MAX_SPEED_LAT  = 1.5;
const MAX_YAW_RATE   = (45 * Math.PI) / 180;
const MAX_PITCH_RATE = (30 * Math.PI) / 180;

const BUOYANCY       = 0.18;   // gentle upward bias

const PITCH_LIMIT = (60 * Math.PI) / 180;

export function createSub({ position, yaw = 0, pitch = 0 }) {
  return {
    position: new THREE.Vector3().copy(position),
    velocity: new THREE.Vector3(),
    yaw,
    pitch,
    yawRate: 0,
    pitchRate: 0,
    thrust: { fwd: 0, lateral: 0, vertical: 0, yaw: 0, pitch: 0 },
    // Cached: world-space forward & right, updated each tick from yaw/pitch
    forward: new THREE.Vector3(0, 0, 1),
    right:   new THREE.Vector3(1, 0, 0),
    up:      new THREE.Vector3(0, 1, 0),
    // Length of velocity, last frame — for HUD readout
    speed: 0,
  };
}

const tmpForce = new THREE.Vector3();

export function tickPhysics(sub, dt) {
  const { thrust } = sub;

  // ---------- Angular ----------
  sub.yawRate   += clamp(thrust.yaw,   -1, 1) * YAW_TORQUE * dt;
  sub.pitchRate += clamp(thrust.pitch, -1, 1) * PITCH_TORQUE * dt;
  // Exponential angular drag
  sub.yawRate   *= Math.exp(-ANGULAR_DRAG * dt);
  sub.pitchRate *= Math.exp(-ANGULAR_DRAG * dt);
  // Caps
  sub.yawRate   = clamp(sub.yawRate,   -MAX_YAW_RATE,   MAX_YAW_RATE);
  sub.pitchRate = clamp(sub.pitchRate, -MAX_PITCH_RATE, MAX_PITCH_RATE);

  sub.yaw   += sub.yawRate   * dt;
  sub.pitch += sub.pitchRate * dt;
  sub.pitch = clamp(sub.pitch, -PITCH_LIMIT, PITCH_LIMIT);

  // ---------- Body axes from yaw + pitch (roll locked) ----------
  const cy = Math.cos(sub.yaw),   sy = Math.sin(sub.yaw);
  const cp = Math.cos(sub.pitch), sp = Math.sin(sub.pitch);
  sub.forward.set(sy * cp, sp, cy * cp);
  sub.right.set(cy, 0, -sy);
  sub.up.set(-sy * sp, cp, -cy * sp);

  // ---------- Linear ----------
  tmpForce.set(0, 0, 0);
  tmpForce.addScaledVector(sub.forward, clamp(thrust.fwd,      -1, 1) * FORWARD_THRUST);
  tmpForce.addScaledVector(sub.right,   clamp(thrust.lateral,  -1, 1) * LATERAL_THRUST);
  tmpForce.y                          += clamp(thrust.vertical, -1, 1) * VERTICAL_THRUST;
  tmpForce.y                          += BUOYANCY;

  // Quadratic drag opposes velocity
  const speed = sub.velocity.length();
  if (speed > 0.001) {
    tmpForce.addScaledVector(sub.velocity, -LINEAR_DRAG * speed);
  }

  sub.velocity.addScaledVector(tmpForce, dt);

  // Soft speed cap — forward direction prioritized so backward/lateral motion
  // gets squeezed harder, which feels right for a sub.
  const fwdComp = sub.velocity.dot(sub.forward);
  if (Math.abs(fwdComp) > MAX_SPEED_FWD) {
    const excess = fwdComp - Math.sign(fwdComp) * MAX_SPEED_FWD;
    sub.velocity.addScaledVector(sub.forward, -excess);
  }
  const latSpeed = sub.velocity.length() - Math.abs(fwdComp);
  if (latSpeed > MAX_SPEED_LAT) {
    const scale = (Math.abs(fwdComp) + MAX_SPEED_LAT) / sub.velocity.length();
    sub.velocity.multiplyScalar(scale);
  }

  sub.position.addScaledVector(sub.velocity, dt);
  sub.speed = sub.velocity.length();
}

// Apply yaw/pitch to a Three.js camera so visuals match physics.
export function applySubToCamera(sub, camera) {
  camera.position.copy(sub.position);
  camera.quaternion.setFromEuler(new THREE.Euler(sub.pitch, sub.yaw, 0, 'YXZ'));
}
