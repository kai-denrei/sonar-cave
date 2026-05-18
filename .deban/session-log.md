# sonar-cave — Session Log

2026-05-19 17:00 — INIT — mode: solo, roles: pm, arch, dev, ux, qa, devops
2026-05-19 17:00 — DECISION — cache-busting toolkit installed at scaffold (devops)
2026-05-19 17:00 — DECISION — cave geometry via build-time marching cubes, not Blender (arch, dev)
2026-05-19 18:30 — PHASE 3 — HUD (SVG, 15Hz) + procedural audio (unlock/ping/ambient) shipped; latent sweep.js scene/caveScene bug fixed (dev, ux)
2026-05-19 18:30 — PHASE 4 — mobile fixed-position joysticks + PING button via Pointer Events; multitouch via per-stick pointerId capture (dev)
2026-05-19 18:30 — PHASE 5 — 30s calibration intro, surfaced overlay with dive time + reload, install prompt capture; final dist 1.0M (dev)
2026-05-19 19:00 — FIX — boot button listener attached first (before top-level throws), entire boot overlay clickable. New build token 83f4fc9f. (dev)
2026-05-19 19:30 — FIX — pointcloud.flush() threw on first frame because Three r160 made BufferAttribute.updateRange a getter; switched to addUpdateRange() API. The 'click does nothing' bug was actually 'render loop crashes on frame 1 after cave loads'. Headless smoke test in /tmp/sonar-smoke.mjs verified end-to-end. (dev, qa)
