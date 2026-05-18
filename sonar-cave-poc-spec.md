# Sonar Cave — PoC Spec

A mobile-first PWA mini-game. The player pilots a submersible through a pitch-dark
underwater cave. The world is invisible; geometry is only ever known through what the
sonar has pinged. The accreting point cloud **is** the map. There is no fog of war
to lift — there is only the void and what you have heard back from it.

This document is the implementation brief for a Claude Code session. Build the PoC
end-to-end. Aesthetic and constraints below are non-negotiable; everything else is
judgment.

---

## Working name

`sonar-cave` (placeholder — rename freely if a better one surfaces).

## Goal of the PoC

A single playable 5-minute cave dive on a phone. The player can:

1. Hear and see a sonar sweep building a point-cloud map of the cave around them.
2. Move through the cave using touch controls and not get stuck on walls.
3. Read depth, heading, pitch, and altimeter from a HUD that looks like
   real subsea instrumentation.
4. Find an exit (a tagged region of the cave) and trigger a "surfaced" end state.
5. Install the page as a PWA on iOS/Android and play it offline.

That is the entire PoC. Everything below serves these five points or is cut.

## Non-goals (cut from PoC)

- Creatures, flocking, ecological behaviors. Defer.
- Multiple cave systems / procedural generation. One hand-authored cave.
- Tether physics. The sub is untethered for the PoC.
- Silt, currents, thermoclines, cave-ins, ping budgets. Defer.
- Multiplayer, leaderboards, persistence beyond a session.
- Settings UI. Hard-code reasonable defaults.

If a feature is not in the goal list, it is not in the PoC. Catch yourself before
adding "just a small" anything.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Module system | Vanilla ES modules | Matches existing PWA catalog pattern. No bundler config drama. |
| Dev server | Vite | Only for HMR and `vite build`. No framework plugins. |
| Renderer | Three.js (latest stable, r160+) | WebGL2 backend. WebGPU not yet safe on mobile. |
| Acceleration | `three-mesh-bvh` | CPU-side raycasts for collision + line-of-sight. Built-in raycaster is too slow. |
| Physics | Custom, ~80 lines | Newtonian sub motion. Pulling in Rapier/Ammo is overkill. |
| HUD | SVG, hand-authored, animated via direct DOM | Crisp at any DPI. Cheap. No framework. |
| Audio | Web Audio API directly | Procedural ping, ambient hum, distance-modulated cues. |
| PWA shell | Hand-rolled service worker + manifest | One file each. No Workbox. |
| Cave geometry | glTF authored in Blender, OR a generated mesh from a marching-cubes pass at build time | Either works; whichever ships faster. **Do not** generate caves at runtime. |
| Build target | ES2022, no transpilation for old browsers | Modern phones only. iOS Safari 16+, Chrome Android 110+. |

**Forbidden:** React, Vue, Svelte, any UI framework. CSS frameworks. Rapier, Ammo,
Cannon, any physics engine. Workbox. Tailwind. Lodash. Anything claiming to "make
PWAs easier."

---

## Project structure

```
sonar-cave/
├── index.html
├── manifest.webmanifest
├── sw.js                          # service worker
├── vite.config.js                 # minimal — static + base path
├── public/
│   ├── icons/                     # 192, 512, maskable
│   └── cave.glb                   # authored cave mesh (or build-generated)
├── src/
│   ├── main.js                    # bootstrap, gameloop
│   ├── scene.js                   # three.js setup, camera, lights (no visible lights — ambient = 0)
│   ├── sonar/
│   │   ├── sweep.js               # the sweep mechanic
│   │   ├── pointcloud.js          # accreting point buffer + render
│   │   └── sonarPing.js           # one-shot multibeam ping
│   ├── sub/
│   │   ├── physics.js             # Newtonian motion
│   │   ├── collision.js           # BVH sphere-vs-mesh
│   │   └── controls.js            # touch + keyboard input → forces
│   ├── cave/
│   │   ├── loadCave.js            # glTF load + BVH build
│   │   └── exitZone.js            # trigger region
│   ├── hud/
│   │   ├── hud.html               # SVG fragments
│   │   ├── hud.css
│   │   └── hud.js                 # gauge update bindings
│   ├── audio/
│   │   ├── ping.js                # procedural ping pulse
│   │   ├── ambient.js             # cave hum, drips
│   │   └── unlock.js              # AudioContext unlock on first touch
│   └── util/
│       ├── math.js
│       └── perf.js                # fps cap, thermal watch
└── README.md
```

Keep it flat. Do not invent a `services/` or `domain/` layer. This is a game,
not an enterprise app.

---

## Core systems — what to build

### 1. The sonar sweep (the heart of the game)

This is the single most important system. If this feels right, the game works. If
not, nothing else matters.

**Mechanic:**

- A sweep line rotates clockwise around the sub at a fixed rate (e.g. 6 seconds per
  full revolution).
- The sweep is conical, narrow horizontally (~15° wedge), wide vertically
  (~60°), pointed forward-down by default (the sub is looking ahead and slightly
  down).
- Each frame, the slice of the sweep currently active produces new point-cloud
  samples. Each sample's brightness fades over time (samples decay from full to
  ~20% over 8 seconds, then hold at floor brightness indefinitely).
- The player can press / tap a "PING" button to fire a one-shot wide-cone
  multibeam ping that produces a dense burst of points in the forward cone. Has
  a cooldown of 3s.

**Implementation — use the depth-buffer trick, not raycasting:**

Each sweep tick:

1. Position an offscreen camera at the sub, oriented along the current sweep
   azimuth. Narrow FOV horizontally, wider vertically. Near clip at sub radius,
   far clip at sonar max range (e.g. 25m).
2. Render the cave into a small depth-only render target (e.g. 64×128 px is enough
   for the sweep wedge; do not waste fillrate).
3. Read back the depth texture (use `renderer.readRenderTargetPixels` or sample
   in a compute-style fragment shader writing to a position texture; the
   readPixels path is fine for 64×128 at 10 Hz).
4. For each depth sample, unproject to world space → add to a ring buffer of
   point-cloud positions (cap at ~150k points; oldest evicted).
5. Render the buffer as `THREE.Points` with a custom shader: additive blending,
   round soft sprite, color = cyan with brightness from per-point age attribute.

**Do not** call `raycaster.intersect()` per pixel. Do not generate samples on
the CPU by walking rays.

The multibeam PING is the same idea with a wider FOV camera and higher resolution
target (e.g. 256×256), fired once.

### 2. Cave geometry

For the PoC, prefer a hand-authored Blender mesh exported as `.glb`. If authoring
is the blocker, generate one offline with marching cubes from a SDF (a few
intersecting noise-displaced tunnels with one branching chamber) and commit the
output `.glb`. Either way, **the mesh is static at runtime**.

Requirements:

- Total scene under ~80k triangles. The renderer will be fine; the BVH build
  needs to stay fast.
- Watertight enough that collision works. Small leaks are OK if collision uses
  sphere casts with margin.
- One mesh tagged or positioned as the "exit zone" — a small chamber at the end
  of the cave system, ~5m radius. Reaching it ends the dive.

On load:

```
const geometry = mergeGeometries(allMeshGeometries);
geometry.boundsTree = new MeshBVH(geometry);
```

This BVH is used for **collision and game logic only**, not for sonar sampling
(see system 1).

### 3. Sub physics

Newtonian, six-DOF-ish, second-order. ~80 lines.

State per frame:

```
sub = {
  position: Vec3,
  velocity: Vec3,
  orientation: Quat,        // current orientation
  angularVelocity: Vec3,
  thrustInput: { fwd, lateral, vertical, yaw, pitch }
}
```

Each tick:

- Apply thrust as force in body-local frame, transform to world.
- Apply linear drag proportional to `velocity * |velocity|` (quadratic — water).
- Apply angular drag.
- Buoyancy: small constant upward bias so neutral input drifts up slowly.
  Counteracts with held-down vertical thrust to hover. (Slightly negative
  buoyancy plays better than perfectly neutral — gives the void a feeling of
  pulling you up toward the surface you cannot see.)
- Integrate.

Tunables — get these right before adding anything else:

- Top forward speed: ~2 m/s. Cave passages are 3–5m wide. You want to feel
  *slow*.
- Yaw rate cap: ~45°/s. Avoid disorienting spin.
- Pitch rate cap: ~30°/s.
- Linear damping coefficient: high enough that releasing thrust stops you within
  ~3 seconds.

### 4. Collision

Sphere-vs-mesh against the cave BVH. The sub has a collision radius of ~0.6m.

Each physics tick:

1. Predict next position.
2. Query the BVH for triangles within `predictedPos + radius`.
3. For each penetrating triangle, push the sub out along the contact normal and
   zero the velocity component into the surface.

`three-mesh-bvh` has `shapecast` and `closestPointToPoint` — use those. Do not
roll your own broadphase.

Touching a wall should feel like a soft bump, not a brick. Allow some velocity
loss but not total stop. The player must always be able to back out.

Reaching the exit zone: simple sphere-vs-sphere distance check each frame against
the exit region.

### 5. Controls

**Mobile (primary):**

- Left thumb: virtual joystick (bottom-left of screen, draggable thumb on
  semitransparent ring). Up/down = forward/back thrust. Left/right = yaw.
- Right thumb: virtual joystick (bottom-right). Up/down = vertical thrust
  (ascend / descend). Left/right = pitch.
- A circular PING button above the right stick.

The joysticks should be invisible until first touched, then fade in around the
finger. Released → drift back to neutral, fade out after 1s. Allow either
absolute-position-on-press or fixed-position styles; if uncertain, ship
fixed-position.

**Desktop (secondary, for dev):**

- WASD: forward/back/strafe-as-yaw. Actually: W/S forward/back, A/D yaw, Q/E
  vertical, mouse drag for pitch, Space for PING.
- Pointer lock optional. Don't bother for PoC.

Both input paths feed `sub.thrustInput`. Keep input → forces clean.

### 6. HUD

SVG overlay, absolutely positioned over the canvas. Updates at 15 Hz (not 60 Hz —
gauges twitching every frame is noise).

Mandatory gauges (mobile-readable size):

- **Depth**: numeric, large, monospace. Format: `XX.X m` and below it `X.XX Bar`
  (1 Bar per 10m, plus 1 surface atm).
- **Heading**: compass card, rotating. Show current heading numeric below.
- **Pitch**: artificial horizon style, simplified. Show numeric ±degrees.
- **Altimeter**: bottom distance to nearest geometry directly below the sub.
  Compute with a single downward BVH ray each frame. Show numeric `X.XX m`.

Optional (nice-to-have, ship if cheap):

- A small thumbnail "sweep indicator" — a top-down dial showing the sweep
  position relative to the sub.
- A "Pressure" warning that turns red below e.g. 20m.

Layout: a thin strip at top of screen on mobile, all gauges in a row. Joysticks
own the bottom. The full middle of the screen is the void.

Style: see Aesthetic section below.

### 7. Audio

Procedural where possible. No sample files larger than a few hundred KB.

- **Sweep ping**: a short pitched sine burst (800Hz, 80ms, fade out), fired
  every time the sweep crosses 0° (i.e. once per revolution). Pan slightly to
  match where the sweep is.
- **Multibeam PING (the button)**: a denser, lower chord (200Hz + 400Hz, 250ms,
  resonant tail).
- **Ambient cave hum**: a low-frequency drone (50–80Hz) with very slow
  modulation. Web Audio `OscillatorNode` + biquad filter is enough.
- **Distant returns**: when the sweep finds a wall close to the sub, layer a
  faint clicky echo. (Optional for PoC. Cut if tricky.)
- **Surfaced/exit**: a single sustained chord on triggering the exit zone.

**Critical for mobile**: AudioContext must be created or resumed on the first
user touch. The unlock module handles this. Do not start audio in `main.js`
init.

### 8. PWA shell

`manifest.webmanifest`:

```json
{
  "name": "Sonar Cave",
  "short_name": "Sonar",
  "start_url": "/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png",
      "purpose": "maskable" }
  ]
}
```

Service worker (`sw.js`): cache-first for all built assets. On first install,
cache the full asset list (precompute at build, inject the list via a small
Vite plugin or hand-write the manifest of files). On fetch, serve from cache,
fall back to network. No fancy strategies needed for a fully offline game.

Wake lock: request `navigator.wakeLock.request('screen')` on game start. Release
on visibilitychange to hidden. Re-request on visible.

Orientation lock: request landscape via the Screen Orientation API after
fullscreen / install. iOS PWAs ignore this — accept it and design the landscape
HUD to also degrade decently in portrait.

---

## Implementation order

Do not build everything in parallel. Each phase has a runnable end state. Do not
move to phase N+1 until phase N runs.

### Phase 0 — Skeleton (target: 1 evening)

- Vite project, ES modules, blank page.
- Three.js renders a black canvas with a single point cloud of 1000 random cyan
  points. Confirm it shows on phone.
- PWA manifest + minimal service worker. Confirm install on iOS + Android.

### Phase 1 — Geometry & physics, no sonar (target: 1 evening)

- Load `cave.glb`, build BVH.
- Sub physics + WASD desktop controls.
- Collision against cave with sphere cast.
- Visual debug: render the cave mesh as a wireframe so you can see what you're
  flying through. **This wireframe gets removed before phase 2.**

### Phase 2 — Sonar (target: 1–2 evenings)

- Build the depth-buffer sweep with offscreen render target.
- Accreting point cloud with age-based fade.
- PING button.
- **Remove the wireframe.** From now on the cave is invisible. Everything you
  see is what the sonar has discovered.
- This is the moment of truth. Spend time tuning sweep rate, point density,
  fade curve, color. Get this right before adding HUD.

### Phase 3 — HUD + audio (target: 1 evening)

- SVG gauge layer.
- Sweep ping audio + PING button audio + ambient hum.
- AudioContext unlock on first touch.

### Phase 4 — Mobile controls (target: 1 evening)

- Virtual joysticks.
- Touch + pointer event handling. Hammer.js is not needed — pointer events are
  enough.
- Test on actual hardware. Emulator is not enough.

### Phase 5 — Exit + polish (target: 1 evening)

- Exit zone trigger + win state screen.
- Wake lock, orientation lock, install prompt handling.
- Performance pass: cap to 30 fps if needed, monitor thermal throttle, ensure
  point cloud caps work.
- A 30-second "calibration" intro: sub auto-sweeps in place so the first thing
  the player sees is the sonar actually working before they have to do anything.

That's the whole PoC.

---

## Aesthetic spec

The screenshots in the design conversation are the canon. Match them.

- **Background**: pure `#000000`. No gradients. No vignette. No fog. The void
  must be absolute.
- **Sonar points**: a single cyan, roughly `#3fdcef` to `#5af0ff` range. Additive
  blend. Soft round sprite ~3–5px on phone. Fresh returns brighter
  (`#aaffff`-ish), aged returns dim (`#1a8a99`-ish).
- **Trajectory**: thin amber-green polyline trailing behind the sub
  (`#9eff5a`-ish). Up to ~200 points of history. This is the breadcrumb back
  out.
- **HUD**: dark grey panels (`#0a0e12`) with thin `#1e2630` borders. Monospace
  typography — `JetBrains Mono` or `IBM Plex Mono`. Gauge needles in white
  with amber accent for active value. Warning state in `#ff4530`.
- **Numbers**: large, monospace, single-decimal precision for most readings.
  The "11.406 m" precision in the reference screenshot is over-precise for a
  game; round to `11.4 m`.
- **No gradients anywhere.** No drop shadows. No glass-morphism. No rounded
  corners larger than 2px. Editorial dark, not iOS-default.

The whole game should look like a real instrument port, not a videogame UI.

---

## Performance budget

Mobile target: a 2023 mid-range Android or iPhone 12+. Budget assumes 30 fps cap.

- Frame budget: 33ms.
- Point cloud render: 150k points max. Single draw call. Custom shader. Should
  take <4ms on target hardware.
- Sweep depth-buffer pass: 64×128 px target, run at 10 Hz (every 3rd frame).
  Budget 2ms per pass.
- BVH collision query: <1ms per tick (one sphere cast against ~80k triangle
  BVH is trivial).
- HUD SVG update: 15Hz, budget 1ms.
- Audio: handled on the audio thread. Budget zero from main.

Cap framerate to 30 with `requestAnimationFrame` throttling. The void doesn't
need 60 fps and the device will run cooler.

Watch for:

- iOS Safari WebGL context loss after backgrounding. Handle the `webglcontextlost`
  event. Re-init scene on `webglcontextrestored`.
- Memory: a `Float32Array(150000 * 4)` = 2.4MB for positions+age. Fine.
- Service worker cache size: should be well under 5MB total. Print the precache
  manifest size at build and warn if it exceeds 10MB.

---

## Acceptance test

A non-developer with the URL on their phone can:

1. Open the page. See "Tap to begin."
2. Tap. Hear the ambient hum start. See the calibration sweep build a partial
   point cloud around them.
3. Use the joysticks to move forward into the cave. See more cloud accrete as
   they advance.
4. Hit a wall by accident. The sub bumps and stops. They back up.
5. Tap PING in a chamber. See a dense burst of points reveal the chamber
   shape.
6. Navigate to the exit. See a "Surfaced" message and the dive time.
7. Install the page to home screen. Re-open it offline. It works.

If any of these fail, the PoC is not done.

If the agent finishes phases 0–5 but the playthrough above feels confusing,
boring, or technically rough, the next iteration is *tuning*, not new features.
Tune sweep rate, point density, sub speed, collision feel, sound levels. Do not
add creatures, do not add tether, do not add silt.

---

## Known traps for the agent

- **Do not** use Three.js' built-in raycaster for sonar sampling. It will be
  slow and CPU-bound. Depth-buffer trick is the only path.
- **Do not** add a navmesh or "AI pathfinding" abstraction. There are no
  creatures.
- **Do not** install React, Vue, or any UI framework "just for the HUD."
- **Do not** use a physics engine. Eighty lines of Newton beats 50KB of Ammo.
- **Do not** generate caves at runtime with marching cubes. Author once,
  ship `.glb`.
- **Do not** transpile for legacy browsers. Modern phones only.
- **Do not** auto-start audio on page load. iOS will block it and the game
  will ship silent. Unlock on first touch, always.
- **Do not** use Workbox. The service worker is 40 lines hand-written.
- **Do not** start adding gauges from the reference screenshot that aren't
  in the mandatory list. The reference is desktop-dense; phones get less.
- **Do not** spend effort on a settings menu. Hard-code everything.
- **Do not** make the cave pretty when wireframed. It's debug-only and gets
  removed in phase 2. If you find yourself UV-mapping it, stop.

---

## Stretch ideas (only after PoC ships)

In rough order of "would meaningfully improve the game":

1. One creature species — sonar-visible, idle drift, flees thrust noise. Single
   boid implementation, ~10 individuals max.
2. Tether as a soft range limit with audible warning, no rope sim.
3. Silt plume when thrusting near floor: corrupts sonar locally for ~10s.
4. A second cave system, hand-authored.
5. Ping budget (battery) — turns sonar use into a tactical choice.
6. Bioluminescent flora visible only on camera (a real video camera output
   below the sonar, like the reference screenshot).

Do not start any of these until the base game is *fun for 5 minutes*.

---

## Deliverables

- A working repo at `sonar-cave/`.
- Deployed to a static host (GitHub Pages, Vercel, Netlify, or local NAS —
  agent's choice; prefer the simplest).
- A README with: install instructions, controls reference, performance notes,
  known issues.
- A short loom-or-similar capture of a phone playthrough. Optional but
  appreciated.

---

## What done looks like

The player puts headphones on, dims the room, opens the site on their phone,
and forgets for five minutes that they are looking at a 4-inch screen. The
void does its work.

That is the whole point. Everything in this document serves that.
