import * as THREE from 'three';

export const TMP_V1 = new THREE.Vector3();
export const TMP_V2 = new THREE.Vector3();
export const TMP_V3 = new THREE.Vector3();
export const TMP_Q1 = new THREE.Quaternion();
export const TMP_Q2 = new THREE.Quaternion();

export const FORWARD = new THREE.Vector3(0, 0, 1);
export const UP = new THREE.Vector3(0, 1, 0);
export const RIGHT = new THREE.Vector3(1, 0, 0);

export function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

export function lerp(a, b, t) { return a + (b - a) * t; }

export function damp(a, b, lambda, dt) {
  // Frame-rate-independent exponential damping (Lengyel / Game Programming Gems).
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}
