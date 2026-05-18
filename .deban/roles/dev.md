---
role: dev
owner: Gerald
status: active
last-updated: 2026-05-19
---

# Development

## Scope
Owns implementation across all 5 phases. Builds the cave, the sub, the sonar,
the HUD, the audio, the controls, the service worker. Reports back when a phase
runs end-to-end.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-19 | Project structure follows spec exactly: src/sonar, src/sub, src/cave, src/hud, src/audio, src/util | Spec is prescriptive; flat layout, no services/ or domain/ layers | [[arch]] |
| 2026-05-19 | One-time `scripts/gen-cave.js` runs marching cubes over a 3-noise-tunnel SDF and writes `public/cave.glb`; runs as `npm run build:cave` | PM call; mesh is static at runtime per spec | [[arch]] [[pm]] |
| 2026-05-19 | Cache-busting token bumped automatically on each `npm run build` via prebuild hook | Service-worker cache invalidation needs a stable token across all references | [[devops]] |
| 2026-05-19 | Fixed sweep.js latent bug: depth pass referenced undefined `scene` instead of `caveScene` — would have produced empty render targets in production | Required for sonar to work; Phase 2 likely "ran" only because pingPending path skipped the bug | [[arch]] |
| 2026-05-19 | HUD is 5 panels in a horizontal strip: DEPTH (large), HDG (rotating SVG compass card), PITCH (ladder), ALT (numeric), SWEEP (optional dial, hidden <400px) | Spec mandated mandatory gauges; SVG keeps it crisp; 15Hz tick throttled inside hud.tick | [[ux]] |
| 2026-05-19 | Audio: AudioContext lazy-created inside boot button gesture handler; ambient hum is two detuned low oscillators through LFO-modulated lowpass | iOS requires user-gesture init; procedural drone matches spec | [[arch]] |
| 2026-05-19 | Sweep ping audio fires when sweep.angle wraps from ~2π back to 0 (delta < -1.0); multibeam audio fires on every PING button hit (cooldown gated by main) | Spec: "fired every time the sweep crosses 0°" | [[arch]] |
| 2026-05-19 | Mobile joysticks: pointer-events + per-stick pointerId tracking enables both-thumbs simultaneous control; sticks briefly visible for 3s after boot so player sees them, then fade until touched | Spec said invisible-until-touched but a first-time player needs to discover them; 3s reveal is minimal compromise | [[ux]] |
| 2026-05-19 | Mobile readThrust zeros fwd/yaw/vertical/pitch when its respective stick is inactive but `anyTouched` is true; otherwise leaves thrust alone so desktop WASD works in dev | Avoid input fighting between desktop and mobile in the same loop tick | [[arch]] |
| 2026-05-19 | Calibration intro: 30 seconds of sub-stationary auto-sweep starting from `loop.start()`; ends early if any joystick is touched. Hint text "CALIBRATING SONAR / touch to begin" centered low | Spec Phase 5 + acceptance test step 2 | [[ux]] |
| 2026-05-19 | Surfaced overlay rebuilt: large "SURFACED" title, dive time in MM:SS.s, "Dive again" button that reloads. Auto-shows install prompt after surfaced if available | Spec Phase 5; gives the player a clean restart | [[ux]] |
| 2026-05-19 | Install prompt: capture beforeinstallprompt → small top-right "Install" button; also shown on Surfaced screen | Per spec: unobtrusive, don't over-engineer | [[devops]] |
| 2026-05-19 | Loaded JetBrains Mono via Google Fonts (preconnect + display=swap); falls back to local monos cleanly | UX decision; keeps HUD legible on phones that don't have JetBrains Mono installed | [[ux]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-19 | Attaching the boot button click/touchend listeners at the END of main.js, after all top-level code | Any top-level throw (WebGL init, Three setup, top-level `new THREE.Vector3()` in dependency chain) leaves the button visible but unresponsive because the script aborts before reaching the listener-attachment line. User reported "Tap to begin doesn't respond." Fix: attach boot listeners as the FIRST executable code in main.js (right after the four getElementById calls), wrap start() invocation in try/catch + console.error so partial failure leaves a debuggable trace |
| 2026-05-19 | Using `posAttr.updateRange = { offset, count }` to drive partial buffer uploads in pointcloud.flush() | Three r160 made `BufferAttribute.updateRange` a getter-only property; the assignment throws on frame 1 and kills the entire game loop, presenting to the user as "the click doesn't do anything" (boot does fade, but the render loop dies before any point cloud renders). Fix: use the new `clearUpdateRanges()` + `addUpdateRange(start, count)` API instead. Caught with a headless puppeteer smoke test (`/tmp/sonar-smoke.mjs`); the smoke test should be made permanent if we add more frame-loop systems |

## Lessons
- In a single-page-app bootstrap, attach the first-interaction listener BEFORE any top-level code that can throw (renderer init, expensive Three.js objects, anything that touches WebGL). Otherwise the page "looks loaded" but is dead. Wrap the click handler's body in try/catch + console.error so a downstream failure leaves a breadcrumb. — from dead end on 2026-05-19
- A frame-loop error (Three.js, custom physics, anything inside rAF) silently kills all subsequent frames because rAF is only re-scheduled at the end of the callback. From the user's perspective this reads as "nothing happens" — indistinguishable from a click that didn't fire. Diagnose by capturing `window.onerror` AND `unhandledrejection` AND running the page in a headless browser that logs `pageerror`. Visual symptoms are unreliable. — from dead end on 2026-05-19
- When migrating between Three.js versions, every property that became a getter (updateRange, etc.) silently breaks any code that assigned to it. Build-time tooling won't catch this; it only manifests at first runtime call. A 5-line headless smoke test that clicks past the boot screen catches this in seconds. — from dead end on 2026-05-19

## Open Questions
- [ ] What's the safe `MeshBVH` build option set for an auto-generated marching-cubes mesh? (lazyGeneration off, maxLeafTris ~10?) — owner: Gerald — since: 2026-05-19

## Assumptions
- Vite 5+ static asset handling is enough; no custom plugin needed except for the service-worker precache manifest — status: untested — since: 2026-05-19

## Dependencies
Blocked by: [[arch]] [[pm]]
Feeds into: [[qa]]

## Session Log
- 2026-05-19 — INIT. Project layout matches spec. Cave generation deferred to a build-time script. Will dispatch implementation agent per phase.
- 2026-05-19 — Phase 3 complete: HUD + audio. New files: `src/hud/hud.js`, `src/audio/{unlock,ping,ambient}.js`. Fixed latent sweep.js bug (`scene` → `caveScene`). Build clean.
- 2026-05-19 — Phase 4 complete: mobile joysticks + PING button via Pointer Events. New file: `src/sub/controlsMobile.js`. Both thumbs work simultaneously (per-stick pointerId capture).
- 2026-05-19 — Phase 5 complete: 30s calibration intro, rebuilt surfaced overlay (dive time + reload button), install prompt capture. fps cap remains via existing `createLoop`. Final `dist/` is 1.0M; service-worker precache is 0.67 MB.
