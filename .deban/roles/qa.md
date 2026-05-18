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

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Acceptance test step 7 (install, go offline, re-open) on iOS 17 — does it actually work? Needs a real device. — owner: Gerald — since: 2026-05-19
- [ ] How do we know the dive is "fun for 5 minutes" without playtesting? — owner: Gerald — since: 2026-05-19

## Assumptions
- A successful Vite build + manual desktop dev test in Chrome is a reasonable v1 ship gate; mobile testing happens post-build on Gerald's device — status: untested — since: 2026-05-19

## Dependencies
Blocked by: [[dev]]
Feeds into: [[pm]]

## Session Log
- 2026-05-19 — INIT. Acceptance test established as DoD. Mobile testing is a post-build human step.
