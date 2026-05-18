# sonar-cave

A mobile-first PWA mini-game. Pilot a submersible through a pitch-dark underwater cave.
The world is invisible; geometry is only ever known through what the sonar has pinged.
The accreting point cloud **is** the map.

See [sonar-cave-poc-spec.md](./sonar-cave-poc-spec.md) for the full implementation brief.

## Quickstart

```bash
npm install
npm run build:cave      # one-time: generate public/cave.glb
npm run dev             # http://localhost:5173
```

## Build

```bash
npm run build
npm run preview         # serve dist/ at http://localhost:4173
```

## Cache busting

The cache-busting toolkit is wired in. Every `npm run build` runs `bust.sh` as a
prebuild and post-build step, bumping the token across:

- URL fingerprints on same-origin asset references
- The service worker cache name
- The visual confirmation badge favicon

To bump manually during dev: `npm run bust`.

## Controls

Mobile:
- Left thumb stick: forward/back (up/down), yaw (left/right)
- Right thumb stick: vertical thrust (up/down), pitch (left/right)
- PING button above the right stick: fires a wide multibeam ping (3s cooldown)

Desktop (dev):
- W/S — forward/back
- A/D — yaw left/right
- Q/E — vertical thrust
- Mouse drag — pitch
- Space — PING

## Stack

- Vanilla ES modules, no framework
- Vite for HMR + build
- Three.js r160+
- three-mesh-bvh for collision + altimeter
- Web Audio API for procedural sonar pings and ambient hum
- Hand-rolled service worker + manifest, no Workbox

## Project memory

Decisions, dead ends, and assumptions are tracked under `.deban/`.
Run `/deban query "why X"` to retrieve the rationale for a specific choice.

## Status

PoC, single-player, single hand-authored cave, 5-minute target dive.
