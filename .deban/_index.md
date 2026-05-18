---
project: sonar-cave
created: 2026-05-19
status: active
mode: solo
stale_threshold_days: 30
---

# sonar-cave — Index

## Brief

A mobile-first PWA mini-game where the player pilots a submersible through a pitch-dark
underwater cave. Geometry is invisible; the world is only ever known through what the
sonar has pinged. The accreting point cloud **is** the map. PoC target: a single
playable 5-minute cave dive on a phone, installable as a PWA, playable offline.

Stack: vanilla ES modules + Vite + Three.js + three-mesh-bvh + ~80 lines of custom
Newtonian physics + SVG HUD + Web Audio API + hand-rolled service worker. No
frameworks, no Workbox, no physics engine.

## Active Roles
- [[pm]] — owner: Gerald
- [[arch]] — owner: Gerald
- [[dev]] — owner: Gerald
- [[ux]] — owner: Gerald
- [[qa]] — owner: Gerald
- [[devops]] — owner: Gerald

## Key Decisions
<!-- Cross-role summary, maintained by COMPACT -->
- 2026-05-19 — Cache-busting toolkit installed at scaffold time (see [[devops]]) — versioning is a first-class concern given offline service worker
- 2026-05-19 — Cave geometry hand-stitched at build time (3 tubes + chamber, 8.3k tri), NOT Blender or marching cubes (see [[arch]], [[dev]]) — watertight by construction, no pinch points
- 2026-05-19 — Virtual joysticks fixed-position (see [[ux]]) — spec said "if uncertain, ship fixed-position"
- 2026-05-19 — Sonar via depth-buffer trick: MeshDepthMaterial → RGBA-packed depth into 64×128 RT @ 10Hz → CPU unproject → 150k point ring buffer (see [[arch]], [[dev]]) — raycasting explicitly forbidden by spec, this is the only path
- 2026-05-19 — Service worker registered PROD-only; dev path actively unregisters leftovers (see [[devops]]) — same-origin SW poisons later dev sessions otherwise
- 2026-05-19 — Headless puppeteer smoke test now considered part of the ship gate (see [[qa]]) — clean build alone shipped a frame-1 crash through

## Open Questions (cross-role)
- [ ] **Mini-map for v1.1** — Gerald raised it, but it directly violates the spec's "no fog of war" design pillar. See [[ux]] for ordered alternatives and [[pm]] for the scope-vs-design tension. Pre-decision: try cheaper non-UI fixes first (brighter trail, higher aged-point floor, faster sweep, audio echo) before adding a second map surface. — owner: Gerald — since: 2026-05-19
- [ ] Hosting target for v1 still unchosen — `dist/` is portable, GitHub Pages is the cheapest path since the repo already exists at kai-denrei/sonar-cave — owner: [[devops]] — since: 2026-05-19
- [ ] Whether the depth-buffer readback path will hold 10Hz on iPhone 12 Safari — owner: [[arch]] — since: 2026-05-19
- [ ] iOS PWA reliability — does the offline-after-install acceptance test actually pass on iOS 17 Safari? — owner: [[qa]] — since: 2026-05-19
- [ ] Real-device manual playtest of the spec's 7 acceptance steps still pending — owner: [[qa]] — since: 2026-05-19
