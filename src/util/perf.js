// 30 fps cap + lightweight thermal/throttle watcher.
// rAF is throttled by the browser already when the page is hidden.

const TARGET_DT = 1 / 30;

export function createLoop(tickFn) {
  let last = performance.now() / 1000;
  let acc = 0;
  let running = false;
  let raf = 0;

  function frame(now) {
    if (!running) return;
    const t = now / 1000;
    let dt = t - last;
    last = t;
    if (dt > 0.25) dt = 0.25; // freeze guard
    acc += dt;
    if (acc >= TARGET_DT) {
      tickFn(Math.min(acc, 0.1));
      acc = 0;
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now() / 1000;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}

// FPS meter (dev-only; logs once per ~2s)
export function fpsMeter() {
  let frames = 0;
  let t0 = performance.now();
  return function tick() {
    frames++;
    const now = performance.now();
    if (now - t0 >= 2000) {
      const fps = (frames * 1000) / (now - t0);
      // eslint-disable-next-line no-console
      console.debug(`[fps] ${fps.toFixed(1)}`);
      frames = 0;
      t0 = now;
    }
  };
}
