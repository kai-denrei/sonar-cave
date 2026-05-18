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
- [ ] **Disorientation feedback (N=1 playtest):** Gerald reports "darkness and sonar only is a bit disorienting." Candidate solutions, *ordered by smallest violation of the design pillar* ("the accreting point cloud IS the map; there is no fog of war to lift"):
    1. Brighten the existing trajectory polyline; raise its opacity from 0.55 → 0.85 and uncap the point count (currently 200) for one dive. The breadcrumb back out is already in the spec and already feels diegetic.
    2. Raise the floor brightness of aged sonar points from 20% → ~35% so the player retains more of the "already seen" wall context. Aged points becoming nearly invisible is what makes spaces re-feel-strange after each loop.
    3. Reduce the sweep period from 6s → 4s so the cloud refreshes more often (more sonar information, no UI added).
    4. Add a directional audio cue when the sweep finds a wall close to the sub (already in the spec's audio section, marked "optional / cut if tricky" — was cut).
    5. **Mini-map** — Gerald's stated candidate. Direct conflict with the spec's design pillar. A mini-map adds knowledge the player did NOT earn via sonar. If chosen, the spec line "the accreting point cloud is the map" should be edited or explicitly relaxed in `pm.md` first.
  Owner: Gerald — since: 2026-05-19. Recommend trying (1)+(2) first since they cost nothing and stay inside the design; reserve (5) for when 1–4 are proven insufficient.

## Assumptions
- The aesthetic spec's color palette (#3fdcef-#5af0ff cyan, #9eff5a trajectory, #0a0e12 panels) renders identically on iOS OLED and mid-range Android LCD — status: untested — since: 2026-05-19

## Dependencies
Blocked by: [[pm]]
Feeds into: [[dev]]

## Session Log
- 2026-05-19 — N=1 playtest reports disorientation. Mini-map raised as a candidate for v1.1; recorded with explicit design-pillar tension + 4 lower-cost alternatives. Decision deferred to next session.
- 2026-05-19 — INIT. Aesthetic frozen per spec. Joystick style chosen.
- 2026-05-19 — HUD shipped: SVG gauges at 15Hz, single-decimal precision, monospace tabular numerics, amber accents on live values, pressure warning state when depth > 20m.
- 2026-05-19 — Calibration intro + surfaced screen shipped. "Dive again" reloads.
