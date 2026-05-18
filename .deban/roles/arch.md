---
role: arch
owner: Gerald
status: active
last-updated: 2026-05-19
---

# Architecture

## Scope
Owns tech-stack choices, render pipeline architecture, performance budget, and
the "depth-buffer trick" for sonar sampling that the whole game hinges on.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-19 | Three.js r160+, WebGL2 backend, no WebGPU | Spec: WebGPU not yet safe on mobile | [[dev]] |
| 2026-05-19 | three-mesh-bvh for collision + altimeter raycasts; NOT for sonar sampling | Sonar uses depth-buffer trick instead — `raycaster.intersect()` per-pixel is too slow | [[dev]] |
| 2026-05-19 | Sonar = offscreen 64×128 depth-only render at 10Hz, readPixels → unproject → ring buffer of ~150k points | Spec mandates this exact path; raycasting is forbidden | [[dev]] |
| 2026-05-19 | Custom ~80-line Newtonian physics, no Rapier/Ammo/Cannon | Spec forbids physics engines | [[dev]] |
| 2026-05-19 | THREE.Points with additive blend + custom shader for the point cloud, single draw call | 150k pts in one draw call, age attribute drives brightness | [[dev]] |
| 2026-05-19 | Cap framerate to 30fps via rAF throttling | Spec: void doesn't need 60, device runs cooler | [[dev]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons
<!-- Distilled principles from Dead Ends. Written to be read cold. -->

## Open Questions
- [ ] Does `readRenderTargetPixels` cause a GPU sync stall on iOS Safari that breaks the 33ms frame budget? — owner: Gerald — since: 2026-05-19
- [ ] Is reading from a position-texture (fragment-shader path) materially faster on iOS than readPixels? — owner: Gerald — since: 2026-05-19

## Assumptions
- 64×128 depth target is enough horizontal/vertical resolution for the sweep wedge — status: untested — since: 2026-05-19
- 150k Float32 positions + 150k Float32 ages (2.4MB) fits within iOS Safari's WebGL memory headroom — status: untested — since: 2026-05-19
- BVH build for an 80k-tri cave completes during initial loading screen without a jank spike — status: untested — since: 2026-05-19

## Dependencies
Blocked by: [[pm]]
Feeds into: [[dev]] [[devops]]

## Session Log
- 2026-05-19 — INIT. Stack frozen per spec. Open questions are all about iOS Safari unknowns — the only real architectural risk vector.
