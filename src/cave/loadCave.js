import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

// Loads cave.bin (custom binary: [u32 numVerts][u32 numTris][f32 positions][u32 indices])
// and cave.json (spawn point, exit zone). Builds a BufferGeometry with a precomputed
// MeshBVH attached as `geometry.boundsTree`. Used for collision and altimeter
// raycasts. The sonar does NOT raycast — it uses the depth-buffer trick (Phase 2).

export async function loadCave(binUrl = 'cave.bin', metaUrl = 'cave.json') {
  const [binRes, metaRes] = await Promise.all([
    fetch(binUrl, { cache: 'force-cache' }),
    fetch(metaUrl, { cache: 'force-cache' }),
  ]);
  if (!binRes.ok) throw new Error(`[cave] failed to fetch ${binUrl}: ${binRes.status}`);
  if (!metaRes.ok) throw new Error(`[cave] failed to fetch ${metaUrl}: ${metaRes.status}`);

  const buf = await binRes.arrayBuffer();
  const meta = await metaRes.json();
  const dv = new DataView(buf);
  const numVerts = dv.getUint32(0, true);
  const numTris  = dv.getUint32(4, true);
  const posBytes = numVerts * 3 * 4;
  const positions = new Float32Array(buf, 8, numVerts * 3);
  const indices   = new Uint32Array(buf, 8 + posBytes, numTris * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.boundsTree = new MeshBVH(geometry, { maxLeafTris: 10 });

  console.log(`[cave] loaded ${numVerts} verts / ${numTris} tris, BVH ready`);

  return { geometry, meta };
}
