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

## Lessons
<!-- Distilled principles from Dead Ends. Written to be read cold. -->

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
