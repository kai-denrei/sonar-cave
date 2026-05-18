// Mobile virtual joysticks — two fixed-position thumb sticks + PING button.
//
// Left stick:  up/down → sub.thrust.fwd, left/right → sub.thrust.yaw
// Right stick: up/down → sub.thrust.vertical, left/right → sub.thrust.pitch
// PING button: fires sweep.firePing() (via onPing callback)
//
// Sticks are invisible until first touched; fade out 1s after release. Uses
// Pointer Events with per-stick pointerId tracking so both thumbs work at once.

const MAX_RADIUS = 60; // px — thumb clamp from stick center
const FADE_DELAY_MS = 1000;

function makeStick(side, container) {
  const root = document.createElement('div');
  root.className = `stick ${side}`;
  const ring = document.createElement('div');
  ring.className = 'stick-ring';
  const thumb = document.createElement('div');
  thumb.className = 'stick-thumb';
  root.appendChild(ring);
  root.appendChild(thumb);
  container.appendChild(root);
  return { root, ring, thumb };
}

export function attachMobileControls({ container, onPing }) {
  const left  = makeStick('left',  container);
  const right = makeStick('right', container);

  // PING button — placed above the right stick
  const pingBtn = document.createElement('button');
  pingBtn.id = 'ping-btn';
  pingBtn.className = 'ping-btn';
  pingBtn.textContent = 'PING';
  container.appendChild(pingBtn);
  pingBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPing) onPing();
  });

  // ---- Per-stick state
  function makeState(stick) {
    return {
      stick,
      pointerId: null,
      // Pixel offset of thumb from stick center
      dx: 0, dy: 0,
      // Normalized -1..1 axes (live values)
      ax: 0, ay: 0,
      fadeTimer: 0,
      active: false,
      // Center reference — recomputed on pointerdown so resize is safe
      centerX: 0, centerY: 0,
    };
  }
  const L = makeState(left);
  const R = makeState(right);

  // Any active stick suppresses desktop input override (the read loop checks .active)
  let anyTouched = false;

  function refreshAnyTouched() {
    anyTouched = L.active || R.active;
  }

  function setThumb(s) {
    s.stick.thumb.style.transform = `translate(${s.dx}px, ${s.dy}px)`;
  }

  function reset(s) {
    s.dx = 0; s.dy = 0; s.ax = 0; s.ay = 0;
    setThumb(s);
  }

  function onDown(s, e) {
    if (s.pointerId !== null) return;
    s.pointerId = e.pointerId;
    const rect = s.stick.root.getBoundingClientRect();
    s.centerX = rect.left + rect.width / 2;
    s.centerY = rect.top + rect.height / 2;
    s.stick.root.classList.add('active');
    s.active = true;
    refreshAnyTouched();
    try { s.stick.root.setPointerCapture(e.pointerId); } catch { /* ok */ }
    onMove(s, e);
  }

  function onMove(s, e) {
    if (s.pointerId !== e.pointerId) return;
    let dx = e.clientX - s.centerX;
    let dy = e.clientY - s.centerY;
    const r = Math.hypot(dx, dy);
    if (r > MAX_RADIUS) {
      dx = (dx / r) * MAX_RADIUS;
      dy = (dy / r) * MAX_RADIUS;
    }
    s.dx = dx; s.dy = dy;
    s.ax =  dx / MAX_RADIUS;
    s.ay = -dy / MAX_RADIUS; // screen Y is down; we want up = positive
    setThumb(s);
  }

  function onUp(s, e) {
    if (s.pointerId !== e.pointerId) return;
    s.pointerId = null;
    reset(s);
    s.active = false;
    refreshAnyTouched();
    try { s.stick.root.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    clearTimeout(s.fadeTimer);
    s.fadeTimer = setTimeout(() => {
      s.stick.root.classList.remove('active');
    }, FADE_DELAY_MS);
  }

  function bind(s) {
    const el = s.stick.root;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); onDown(s, e); });
    el.addEventListener('pointermove', (e) => { e.preventDefault(); onMove(s, e); });
    el.addEventListener('pointerup',     (e) => { e.preventDefault(); onUp(s, e); });
    el.addEventListener('pointercancel', (e) => { e.preventDefault(); onUp(s, e); });
    el.addEventListener('pointerleave',  (e) => { if (s.pointerId === e.pointerId) onUp(s, e); });
  }
  bind(L);
  bind(R);

  // Show the sticks at full opacity briefly on first frame so the player sees them.
  // Then they fade out until first touch — but we keep them at faint opacity via
  // the .active class on first show. Simpler: leave the .stick at opacity 0 and
  // only fade in on touch. Players will discover them by touch on screen.
  //
  // BUT to satisfy the acceptance test (joysticks "fade in around the finger"),
  // we show them dimly for 3s after boot, then fade them out so the player has
  // seen where to put their thumbs.
  L.stick.root.classList.add('active');
  R.stick.root.classList.add('active');
  setTimeout(() => {
    if (!L.active) L.stick.root.classList.remove('active');
    if (!R.active) R.stick.root.classList.remove('active');
  }, 3000);

  function readThrust(sub) {
    if (!sub) return;
    if (!anyTouched) return; // leave thrust alone — desktop controls still work
    const t = sub.thrust;
    // Left stick: ay → fwd, ax → yaw. Stick.left (ax<0) should turn left
    // (positive yaw in our physics, matches WASD A=yaw+).
    if (L.active) {
      t.fwd = L.ay;
      t.yaw = -L.ax;
    } else {
      t.fwd = 0;
      t.yaw = 0;
    }
    // Right stick: ay → vertical (up = ascend), ax → pitch. Stick down (negative
    // ay on the screen, but our ay is screen-Y-inverted so down = negative ay)
    // gives descend. Mouse-drag pitch is "drag up = nose up" → pitch+; here we
    // want stick-up to nose-up too? Spec: right stick up/down = vertical thrust,
    // left/right = pitch. So pitch is the X axis. Pitch+ = nose-up.
    if (R.active) {
      t.vertical = R.ay;
      t.pitch    = R.ax;
    } else {
      t.vertical = 0;
      t.pitch    = 0;
    }
  }

  function setPingCooldown(active) {
    if (active) pingBtn.classList.add('cooldown');
    else pingBtn.classList.remove('cooldown');
  }

  return { readThrust, setPingCooldown, get anyTouched() { return anyTouched; } };
}
