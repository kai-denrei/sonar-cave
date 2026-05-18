---
role: pm
owner: Gerald
status: active
last-updated: 2026-05-19
---

# PM — Product Management

## Scope
Owns scope discipline, "recommended" defaults when choices arise, and the PoC's
acceptance test. Has full authority delegated by the user for this build session.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-19 | Strictly enforce the PoC's 5-goal scope; nothing else ships in v1 | Spec is explicit: "If a feature is not in the goal list, it is not in the PoC. Catch yourself before adding 'just a small' anything." | [[dev]] [[arch]] |
| 2026-05-19 | Default to "recommended" / spec-preferred choice on every fork; do not ask user during this build | Per user instruction — full authority delegated, "recommended" everywhere | all |
| 2026-05-19 | Cave geometry built at scaffold time via marching-cubes script, not authored in Blender | Removes a human-authoring blocker; spec explicitly allows either path; "whichever ships faster" applies | [[arch]] [[dev]] |
| 2026-05-19 | Virtual joysticks ship fixed-position (not absolute-on-press) | Spec: "if uncertain, ship fixed-position" | [[ux]] |
| 2026-05-19 | Hosting: defer to v1.1, ship a working `vite build` and instructions only | Deployment is a deliverable but no host is mandated; pick after the build runs | [[devops]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons
<!-- Distilled principles from Dead Ends. Written to be read cold. -->

## Open Questions
- [ ] What is the actual non-developer acceptance-test pass rate on a real iPhone 12? — owner: Gerald — since: 2026-05-19
- [ ] Untested assumption: depth-buffer readback at 10Hz won't tank fps on iOS Safari (readRenderTargetPixels stalls the GPU pipeline) — owner: [[arch]] — since: 2026-05-19
- [ ] Untested assumption: 150k additive THREE.Points stays under 4ms on iPhone 12 (fillrate-bound on OLED) — owner: [[arch]] — since: 2026-05-19
- [ ] Untested assumption: marching-cubes-generated cave is actually navigable without hand touch-up (auto-gen tends to produce pinch points and bad collision normals) — owner: [[dev]] — since: 2026-05-19
- [ ] Untested assumption: AudioContext.resume() inside the "Tap to begin" handler reliably unlocks audio on iOS 17 Safari PWAs — owner: [[dev]] — since: 2026-05-19
- [ ] Untested assumption: a hand-rolled 40-line service worker can pass the "install, go offline, replay" acceptance test on iOS 17 — owner: [[qa]] — since: 2026-05-19

## Assumptions
- The 30 fps cap is enough for the void to feel right — status: untested — since: 2026-05-19
- 150k point cap will not run out during a 5-minute dive in the authored cave — status: untested — since: 2026-05-19
- The "calibration intro" auto-sweep makes the sonar legible to first-time players in <30s — status: untested — since: 2026-05-19

## Dependencies
Blocked by:
Feeds into: [[dev]] [[ux]] [[qa]]

## Session Log
- 2026-05-19 — INIT. Scope frozen to spec's 5 goals. Challenged spec with 5 untested assumptions above. PM has full authority for this build session per user instruction.
