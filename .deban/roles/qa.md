---
role: qa
owner: Gerald
status: active
last-updated: 2026-05-19
---

# QA — Acceptance & Validation

## Scope
Owns the 7-step acceptance test from the spec, the "5 minutes of fun" qualitative
gate, and device-specific risk tracking (iOS Safari, mid-range Android).

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-19 | The 7-step acceptance test from spec is the v1 definition-of-done | Spec: "If any of these fail, the PoC is not done." | [[pm]] |
| 2026-05-19 | No automated tests for v1 — the failure modes are visual/feel, not logical | This is a game PoC, not a CRUD app; TDD doesn't fit | [[dev]] |
| 2026-05-19 | Headless puppeteer smoke test (`/tmp/sonar-smoke.mjs`) added ad-hoc to catch boot-path runtime errors. NOT yet checked into the repo. | The "click does nothing" bug (pointcloud.flush throwing on frame 1) was completely invisible to build-time checks; required an actual click + console capture to surface. Alternatives considered: (a) full Playwright e2e suite — too heavy for a PoC; (b) Vitest with jsdom — can't drive WebGL; (c) manual desktop check — already failed once. Smoke test is 60 lines, runs in under 5 seconds, and catches all rAF-loop crashes. | [[dev]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-19 | Treating "Build passes, dev server returns 200, no syntax errors" as a v1 ship gate | Gerald booted the page and clicks did nothing. The build was clean and serving correctly. The failure was an r160 API change (`BufferAttribute.updateRange` became getter-only) that only manifested inside the rAF callback on frame 1. A 60-line headless puppeteer test that clicks the boot button + tails `pageerror` caught it in 5 seconds. Pre-runtime checks were structurally incapable of seeing it. |

## Lessons
- For interactive apps with a render loop, "the build is clean" is not a ship signal. The minimum viable QA gate is: load the page in a real browser, fire the primary interaction, and tail console + `pageerror` for ≥1 second. Headless puppeteer scripts this in well under a minute. — from dead end on 2026-05-19
- A thrown error inside a `requestAnimationFrame` callback silently stops the loop because rAF is only re-scheduled at the END of the callback. Symptoms read identically to "input not registered." Diagnose via `pageerror` capture, never via what the user *sees*. — from dead end on 2026-05-19

## Open Questions
- [ ] Acceptance test step 7 (install, go offline, re-open) on iOS 17 — does it actually work? Needs a real device. — owner: Gerald — since: 2026-05-19
- [ ] How do we know the dive is "fun for 5 minutes" without playtesting? — owner: Gerald — since: 2026-05-19
- [ ] Should the puppeteer smoke test be moved from `/tmp/` into the repo as `scripts/smoke.mjs` and run pre-push? Cost: another dev dependency (~270 MB Chromium download). Benefit: catches every rAF-loop regression instantly. — owner: Gerald — since: 2026-05-19
- [ ] Gerald's perceived disorientation feedback ("darkness and sonar only is a bit disorienting") needs a falsifiable test: at what point does a first-time player give up vs. learn the navigation? Currently we have N=1. — owner: Gerald — since: 2026-05-19

## Assumptions
- A successful Vite build + manual desktop dev test in Chrome is a reasonable v1 ship gate; mobile testing happens post-build on Gerald's device — status: invalidated — since: 2026-05-19 (the click-does-nothing bug ships through this gate; smoke test is now part of the gate)

## Dependencies
Blocked by: [[dev]]
Feeds into: [[pm]]

## Session Log
- 2026-05-19 — v1 acceptance: headless smoke test PASSES (page loads, click registers, cave loads, render loop steady). Real-device acceptance steps 1–7 still pending Gerald's manual verification on phone hardware. The "5 minutes of fun" gate is unverified — N=1 playtester reports disorientation (see ux.md ## Open Questions).
- 2026-05-19 — Added smoke test ad-hoc, caught r160 updateRange API regression that desktop manual testing missed. Existing v1-ship-gate assumption invalidated.
- 2026-05-19 — INIT. Acceptance test established as DoD. Mobile testing is a post-build human step.
