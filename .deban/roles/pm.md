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
- [ ] **Mini-map for v1.1 — directly conflicts with the spec's design pillar.** Gerald raised this in response to N=1 disorientation feedback. The spec says: "the accreting point cloud IS the map. There is no fog of war to lift — there is only the void and what you have heard back from it." A mini-map gives the player knowledge they didn't earn through sonar, which is the central inversion the game is built on. Before adding one: (a) decide whether the design pillar is being explicitly relaxed (and document that), (b) try the cheaper alternatives listed in `ux.md ## Open Questions` first (brighter trajectory; higher floor brightness; faster sweep; audio echo cue), (c) consider whether the disorientation is the *point* of the game and not a bug. Recommend running (a)+(b) before committing to (c). — owner: Gerald — since: 2026-05-19
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
- 2026-05-19 — v1 scope **closed**. All 5 spec goals implemented and shipped to GitHub. Two post-ship bugs found and fixed (boot-listener attachment timing; r160 BufferAttribute.updateRange API). Real-device acceptance still pending Gerald.
- 2026-05-19 — Mini-map raised as a v1.1 candidate. Flagged the explicit conflict with the spec's "no fog of war to lift" design pillar. NOT a decision; logged as Open Question with alternatives. Recommend trying cheaper non-UI fixes first before relaxing the pillar.
- 2026-05-19 — INIT. Scope frozen to spec's 5 goals. Challenged spec with 5 untested assumptions above. PM has full authority for this build session per user instruction.
