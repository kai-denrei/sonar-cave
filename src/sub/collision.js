import * as THREE from 'three';

// Sphere-vs-mesh collision against the cave BVH. Pushes the sub out of any
// penetrating triangle along the contact normal and zeros velocity into the
// surface. Soft bump, not a brick — energy loss is partial so the player can
// always back out.
//
// Uses three-mesh-bvh's `shapecast` with a sphere bounds test + closest-point
// triangle query. Spec mandates this approach.

const SUB_RADIUS = 0.6;
const BUMP_ELASTICITY = 0.2; // velocity-into-surface retained after bump

const tmpSphere = new THREE.Sphere();
const tmpBox = new THREE.Box3();
const tmpTri = new THREE.Triangle();
const tmpClosest = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpAB = new THREE.Vector3();
const tmpAC = new THREE.Vector3();
const tmpDelta = new THREE.Vector3();

export function resolveCollision(sub, caveGeometry) {
  const bvh = caveGeometry.boundsTree;
  if (!bvh) return false;
  tmpSphere.center.copy(sub.position);
  tmpSphere.radius = SUB_RADIUS;
  tmpBox.setFromCenterAndSize(
    sub.position,
    new THREE.Vector3(SUB_RADIUS * 2, SUB_RADIUS * 2, SUB_RADIUS * 2),
  );

  let hit = false;

  bvh.shapecast({
    intersectsBounds: (box) => box.intersectsSphere(tmpSphere),
    intersectsTriangle: (tri) => {
      tmpTri.copy(tri);
      tmpTri.closestPointToPoint(sub.position, tmpClosest);
      tmpDelta.subVectors(sub.position, tmpClosest);
      const distSq = tmpDelta.lengthSq();
      if (distSq < SUB_RADIUS * SUB_RADIUS) {
        const dist = Math.sqrt(distSq);
        // Contact normal points from triangle toward sub center (push-out direction).
        // If the sub center is *exactly* on the triangle plane, fall back to face normal.
        if (dist > 1e-6) {
          tmpNormal.copy(tmpDelta).divideScalar(dist);
        } else {
          tmpAB.subVectors(tmpTri.b, tmpTri.a);
          tmpAC.subVectors(tmpTri.c, tmpTri.a);
          tmpNormal.crossVectors(tmpAB, tmpAC).normalize();
        }
        const penetration = SUB_RADIUS - dist;
        sub.position.addScaledVector(tmpNormal, penetration);
        // Velocity correction: remove the component going into the surface,
        // retain a small fraction (bump elasticity).
        const into = sub.velocity.dot(tmpNormal);
        if (into < 0) {
          sub.velocity.addScaledVector(tmpNormal, -into * (1 + BUMP_ELASTICITY));
        }
        hit = true;
      }
      return false; // continue scanning — more than one triangle can penetrate
    },
  });

  return hit;
}

// Altimeter ray — straight down. Returns distance to nearest geometry below the
// sub, or Infinity if nothing within 30m.
const ALT_MAX = 30;
const downRaycaster = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

export function altimeter(sub, caveGeometry, caveMesh) {
  downRaycaster.ray.origin.copy(sub.position);
  downRaycaster.ray.direction.copy(DOWN);
  downRaycaster.far = ALT_MAX;
  // three-mesh-bvh accelerates this when geometry.boundsTree exists and the
  // mesh's `raycast` is overridden (we do that in loadCave's caller).
  const hits = caveMesh ? downRaycaster.intersectObject(caveMesh, false) : [];
  return hits.length ? hits[0].distance : Infinity;
}

export { SUB_RADIUS };
