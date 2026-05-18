import * as THREE from 'three';

// Sphere-vs-sphere exit trigger. Spec: "Reaching the exit zone: simple sphere-vs-sphere
// distance check each frame against the exit region."
export function createExitZone(meta) {
  const center = new THREE.Vector3(meta.exitZone.center.x, meta.exitZone.center.y, meta.exitZone.center.z);
  const radius = meta.exitZone.radius;
  return {
    center,
    radius,
    contains(subPos) {
      return subPos.distanceTo(center) <= radius;
    },
  };
}
