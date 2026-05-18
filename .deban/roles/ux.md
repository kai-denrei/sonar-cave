---
role: ux
owner: Gerald
status: active
last-updated: 2026-05-19
---

# UX — Game Feel & Interface

## Scope
Owns the aesthetic spec, joystick feel, HUD legibility, calibration intro, and
"does the void do its work" qualitative judgment.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-19 | Fixed-position joysticks, not absolute-on-press | Spec: "if uncertain, ship fixed-position" | [[dev]] |
| 2026-05-19 | Monospace HUD font — JetBrains Mono via Google Fonts (precached by SW) | Spec lists JetBrains Mono or IBM Plex Mono; pick first | [[dev]] |
| 2026-05-19 | Single-decimal precision on all numeric readouts | Spec: round "11.406 m" to "11.4 m" | [[dev]] |
| 2026-05-19 | Trajectory polyline cap: 200 points, color `#9eff5a` | Spec exact | [[dev]] |
| 2026-05-19 | HUD strip uses 5 panels in a single top row; SVG compass + horizon ladder + sweep dial. Sweep dial hides below 400px width to protect the strip on narrow phones | Spec mandates a thin top strip with all gauges in a row | [[dev]] |
| 2026-05-19 | Joysticks show dimmed for 3s at game start, then fade out until touched. Active opacity 0.85 | Pure invisible-until-touched is a discoverability hole for first-time players; 3s reveal threads the needle | [[dev]] |
| 2026-05-19 | Calibration intro: 30s, hint text "CALIBRATING SONAR / touch to begin" centered at 18% from bottom; ends early on any joystick touch | Spec Phase 5; gives a passive reveal of how the sonar works before the player has to do anything | [[dev]] |
| 2026-05-19 | Surfaced screen: large monospace SURFACED title, dive time in `MM:SS.s` amber accent, "Dive again" button reloads the page | Acceptance step 6 + Phase 5 polish | [[dev]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Does the calibration intro need a skip option for repeat players, or does scope discipline say no? — owner: Gerald — since: 2026-05-19

## Assumptions
- The aesthetic spec's color palette (#3fdcef-#5af0ff cyan, #9eff5a trajectory, #0a0e12 panels) renders identically on iOS OLED and mid-range Android LCD — status: untested — since: 2026-05-19

## Dependencies
Blocked by: [[pm]]
Feeds into: [[dev]]

## Session Log
- 2026-05-19 — INIT. Aesthetic frozen per spec. Joystick style chosen.
- 2026-05-19 — HUD shipped: SVG gauges at 15Hz, single-decimal precision, monospace tabular numerics, amber accents on live values, pressure warning state when depth > 20m.
- 2026-05-19 — Calibration intro + surfaced screen shipped. "Dive again" reloads.
