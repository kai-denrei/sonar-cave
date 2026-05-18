// Desktop controls — WASD, QE, Space, mouse. Mobile virtual joysticks live in
// Phase 4 (separate module) but write to the same `sub.thrust` shape so either
// input path is interchangeable.
//
// Mapping (per spec):
//   W/S       — forward / back
//   A/D       — yaw left / right
//   Q/E       — vertical down / up
//   Mouse     — drag for pitch (when pointer held inside the canvas)
//   Space     — fire multibeam PING
//   Esc       — release pointer

const keys = new Set();
let pitchAccum = 0;
let mouseDown = false;
let lastMouseY = 0;

let pingHandler = () => {};

export function attachDesktopControls(target = window, canvas = null, onPing = null) {
  if (onPing) pingHandler = onPing;

  target.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Space') {
      e.preventDefault();
      pingHandler();
    }
  });
  target.addEventListener('keyup', (e) => keys.delete(e.code));

  // Pointer-drag pitch
  const c = canvas || document;
  c.addEventListener('mousedown', (e) => {
    mouseDown = true;
    lastMouseY = e.clientY;
  });
  c.addEventListener('mouseup', () => { mouseDown = false; });
  c.addEventListener('mouseleave', () => { mouseDown = false; });
  c.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    const dy = e.clientY - lastMouseY;
    lastMouseY = e.clientY;
    pitchAccum -= dy * 0.012; // mouse-up = nose-up (inverted); negative because we sub
  });
}

export function readDesktopThrust(sub) {
  const t = sub.thrust;
  t.fwd      = (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
  t.yaw      = (keys.has('KeyA') ? 1 : 0) + (keys.has('KeyD') ? -1 : 0);
  t.vertical = (keys.has('KeyE') ? 1 : 0) + (keys.has('KeyQ') ? -1 : 0);
  t.lateral  = 0;
  // Pitch from mouse drag, decays after release
  t.pitch = pitchAccum;
  pitchAccum *= 0.85;
}
