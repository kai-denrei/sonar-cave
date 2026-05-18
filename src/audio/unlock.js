// AudioContext unlock — must run from inside a user-gesture handler.
// iOS Safari will reject any AudioContext created at module-load time, so we
// lazy-init here on the first call.

let ctx = null;
let masterGain = null;

export function unlockAudio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function getCtx() { return ctx; }

export function getMaster() { return masterGain; }
