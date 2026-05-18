#!/usr/bin/env node
// Sonar Cave — build-time cave geometry generator.
//
// Produces a hand-stitched tube-and-chamber mesh in a tiny custom binary format
// (public/cave.bin) plus metadata (public/cave.json: spawn point + exit zone center).
//
// Why not glTF? GLTFExporter is browser-centric, and the loader code we save by
// using glTF (one extra binary header) isn't worth the build complexity.
// Why not marching cubes? Tube generation is watertight by construction and
// avoids the "auto-gen produces pinch points / bad collision normals" risk.
//
// Layout (single connected cave system):
//
//                            [chamber] ←── EXIT
//                              ↑
//                  branch C ──┘
//                  ↑
//   spawn → entrance A → JUNCTION → side passage B
//                                    (dead end after ~25m)
//
// Triangles wind so outward-facing normals point INTO the cave (we'll render with
// THREE.BackSide). Collision push-out direction is computed by sphere-vs-triangle
// closest-point at runtime, so winding doesn't break collision either way.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNoise3D } from 'simplex-noise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
mkdirSync(PUBLIC, { recursive: true });

// ---------- Vec3 helpers (no Three.js dep needed for build) ----------
const v = (x, y, z) => ({ x, y, z });
const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a, s) => v(a.x * s, a.y * s, a.z * s);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1; return scale(a, 1 / l); };
const cross = (a, b) => v(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x,
);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// ---------- Tube path generation ----------
// A Catmull-Rom-ish smooth path through a list of control points, sampled at
// `samples` total positions. Returns: { points: Vec3[], tangents: Vec3[] }.
function samplePath(controls, samples) {
  const points = [];
  const tangents = [];
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const segCount = controls.length - 1;
    const idx = Math.min(Math.floor(t * segCount), segCount - 1);
    const localT = t * segCount - idx;
    const p0 = controls[Math.max(0, idx - 1)];
    const p1 = controls[idx];
    const p2 = controls[idx + 1];
    const p3 = controls[Math.min(controls.length - 1, idx + 2)];
    points.push(catmullRom(p0, p1, p2, p3, localT));
    // Forward-difference tangent
    const ahead = catmullRom(p0, p1, p2, p3, Math.min(1, localT + 0.01));
    tangents.push(norm(sub(ahead, points[points.length - 1])));
  }
  return { points, tangents };
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2*p0.z - 5*p1.z + 4*p2.z - p3.z) * t2 + (-p0.z + 3*p1.z - 3*p2.z + p3.z) * t3),
  };
}

// ---------- Frenet-ish frame (parallel transport) ----------
function buildFrames(points, tangents) {
  const normals = [];
  const binormals = [];
  // Pick an initial normal perpendicular to the first tangent.
  let n0;
  if (Math.abs(tangents[0].y) < 0.9) n0 = norm(cross(tangents[0], v(0, 1, 0)));
  else n0 = norm(cross(tangents[0], v(1, 0, 0)));
  normals.push(n0);
  binormals.push(norm(cross(tangents[0], n0)));
  // Parallel-transport along the path
  for (let i = 1; i < points.length; i++) {
    const prev = normals[i - 1];
    const t = tangents[i];
    // Reproject prev normal onto plane perpendicular to t
    const proj = sub(prev, scale(t, dot(prev, t)));
    const n = norm(proj);
    normals.push(n);
    binormals.push(norm(cross(t, n)));
  }
  return { normals, binormals };
}

// ---------- Tube mesh builder ----------
// Builds a tube as concentric rings along the path, with per-ring radius and
// per-vertex noise displacement for organic wall texture.
function buildTube({
  controls, samples, radialSegments, radiusFn, noise, noiseAmp, noiseFreq, seed = 0,
}, accum) {
  const { points, tangents } = samplePath(controls, samples);
  const { normals, binormals } = buildFrames(points, tangents);

  const startVert = accum.positions.length / 3;

  for (let i = 0; i < samples; i++) {
    const p = points[i];
    const n = normals[i];
    const b = binormals[i];
    const r0 = radiusFn(i / (samples - 1));
    for (let j = 0; j < radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const cosA = Math.cos(a), sinA = Math.sin(a);
      // Base ring position
      let px = p.x + (n.x * cosA + b.x * sinA) * r0;
      let py = p.y + (n.y * cosA + b.y * sinA) * r0;
      let pz = p.z + (n.z * cosA + b.z * sinA) * r0;
      // 3D noise displacement (radial bumps), capped so we don't collapse the tube
      const noiseSample = noise(px * noiseFreq + seed, py * noiseFreq + seed, pz * noiseFreq + seed);
      const disp = noiseSample * noiseAmp;
      const dispClamped = Math.max(-r0 * 0.6, Math.min(r0 * 0.6, disp));
      px += (n.x * cosA + b.x * sinA) * dispClamped;
      py += (n.y * cosA + b.y * sinA) * dispClamped;
      pz += (n.z * cosA + b.z * sinA) * dispClamped;
      accum.positions.push(px, py, pz);
    }
  }

  // Triangles between adjacent rings.
  for (let i = 0; i < samples - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const j2 = (j + 1) % radialSegments;
      const a = startVert + i * radialSegments + j;
      const b = startVert + i * radialSegments + j2;
      const c = startVert + (i + 1) * radialSegments + j;
      const d = startVert + (i + 1) * radialSegments + j2;
      // Outward-facing normals (winding consistent with right-hand rule
      // around the tangent direction). Rendered with BackSide.
      accum.indices.push(a, c, b, b, c, d);
    }
  }
  return { firstVert: startVert, lastVert: accum.positions.length / 3 };
}

// ---------- Chamber (icosphere subdivided) ----------
function buildChamber({ center, radius, subdivisions, noise, noiseAmp, noiseFreq, seed }, accum) {
  // Start with icosahedron
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    v(-1,  t,  0), v( 1,  t,  0), v(-1, -t,  0), v( 1, -t,  0),
    v( 0, -1,  t), v( 0,  1,  t), v( 0, -1, -t), v( 0,  1, -t),
    v( t,  0, -1), v( t,  0,  1), v(-t,  0, -1), v(-t,  0,  1),
  ].map(p => norm(p));
  let faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];

  // Subdivide
  for (let s = 0; s < subdivisions; s++) {
    const midCache = new Map();
    const midpoint = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (midCache.has(key)) return midCache.get(key);
      const m = norm(scale(add(verts[a], verts[b]), 0.5));
      verts.push(m);
      const idx = verts.length - 1;
      midCache.set(key, idx);
      return idx;
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }

  const startVert = accum.positions.length / 3;
  for (const p of verts) {
    let px = center.x + p.x * radius;
    let py = center.y + p.y * radius;
    let pz = center.z + p.z * radius;
    const noiseSample = noise(px * noiseFreq + seed, py * noiseFreq + seed, pz * noiseFreq + seed);
    const disp = noiseSample * noiseAmp;
    px += p.x * disp;
    py += p.y * disp;
    pz += p.z * disp;
    accum.positions.push(px, py, pz);
  }
  for (const [a, b, c] of faces) {
    accum.indices.push(startVert + a, startVert + c, startVert + b); // reverse winding → inward normal
  }
}

// ---------- Build the whole cave ----------
const noise = createNoise3D(() => 0.137);
const accum = { positions: [], indices: [] };

// Entrance tunnel (along -Z, player spawns at end)
buildTube({
  controls: [v(0, 0, -55), v(0, 0, -45), v(0.5, -1, -30), v(0, -0.5, -15), v(0, 0, 0)],
  samples: 80,
  radialSegments: 16,
  radiusFn: (t) => 2.8 + Math.sin(t * 5) * 0.3,
  noise, noiseAmp: 0.6, noiseFreq: 0.35, seed: 17,
}, accum);

// Side passage (along +X, dead end)
buildTube({
  controls: [v(0, 0, 0), v(10, -1, 1), v(20, -2, 0), v(25, -3, 2)],
  samples: 60,
  radialSegments: 14,
  radiusFn: (t) => 2.4 - t * 0.5,
  noise, noiseAmp: 0.5, noiseFreq: 0.4, seed: 41,
}, accum);

// Exit branch (curls up and forward to the chamber)
const chamberCenter = v(-8, 6, 35);
buildTube({
  controls: [v(0, 0, 0), v(-2, 2, 10), v(-4, 4, 18), v(-6, 5, 26), v(-8, 6, 32), chamberCenter],
  samples: 90,
  radialSegments: 16,
  radiusFn: (t) => 2.6 + t * 0.8,        // widens toward the chamber
  noise, noiseAmp: 0.7, noiseFreq: 0.32, seed: 73,
}, accum);

// Chamber (icosphere)
buildChamber({
  center: chamberCenter,
  radius: 5.5,
  subdivisions: 3,
  noise, noiseAmp: 1.1, noiseFreq: 0.28, seed: 91,
}, accum);

// ---------- Write binary cave file ----------
// Format: [u32 numVerts][u32 numTris][float32 positions...][uint32 indices...]
const numVerts = accum.positions.length / 3;
const numTris = accum.indices.length / 3;
const posBuf = new Float32Array(accum.positions);
const idxBuf = new Uint32Array(accum.indices);

const header = new ArrayBuffer(8);
new DataView(header).setUint32(0, numVerts, true);
new DataView(header).setUint32(4, numTris, true);

const out = Buffer.concat([
  Buffer.from(header),
  Buffer.from(posBuf.buffer),
  Buffer.from(idxBuf.buffer),
]);

writeFileSync(join(PUBLIC, 'cave.bin'), out);

// ---------- Metadata ----------
const meta = {
  version: 1,
  spawn: { x: 0, y: 0, z: -50, yaw: 0, pitch: 0 }, // facing toward the junction at +Z
  exitZone: {
    center: chamberCenter,
    radius: 4.0,                                   // trigger radius inside the chamber
  },
  bounds: { min: v(-20, -10, -60), max: v(35, 15, 45) },
  stats: { verts: numVerts, tris: numTris, bytes: out.length },
};
writeFileSync(join(PUBLIC, 'cave.json'), JSON.stringify(meta, null, 2));

console.log(`[gen-cave] verts=${numVerts}, tris=${numTris}, bin=${(out.length / 1024).toFixed(1)} KB`);
console.log(`[gen-cave] spawn=(${meta.spawn.x}, ${meta.spawn.y}, ${meta.spawn.z}) → exit=(${chamberCenter.x}, ${chamberCenter.y}, ${chamberCenter.z})`);
