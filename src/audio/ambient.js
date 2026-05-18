// Ambient cave hum — low-frequency drone (50–80Hz) with slow LFO modulation.
// Stops on visibility hidden, restarts on visible.

import { getCtx, getMaster } from './unlock.js';

let nodes = null;
let running = false;

export function startAmbient() {
  if (running) return;
  const ctx = getCtx();
  if (!ctx) return;
  running = true;

  // Two slightly detuned low oscillators through a lowpass for warmth.
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc1.frequency.value = 55;
  osc2.frequency.value = 62;

  // LFO modulates filter cutoff — very slow.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.06; // ~16s per cycle
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 35;
  lfo.connect(lfoGain);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 140;
  lp.Q.value = 0.7;
  lfoGain.connect(lp.frequency);

  const g = ctx.createGain();
  g.gain.value = 0.08;

  osc1.connect(lp);
  osc2.connect(lp);
  lp.connect(g).connect(getMaster() || ctx.destination);

  const t = ctx.currentTime;
  osc1.start(t);
  osc2.start(t);
  lfo.start(t);

  nodes = { osc1, osc2, lfo, g };
}

export function stopAmbient() {
  if (!running || !nodes) return;
  const ctx = getCtx();
  const t = ctx ? ctx.currentTime : 0;
  try {
    nodes.g.gain.cancelScheduledValues(t);
    nodes.g.gain.setValueAtTime(nodes.g.gain.value, t);
    nodes.g.gain.linearRampToValueAtTime(0.0001, t + 0.2);
    nodes.osc1.stop(t + 0.25);
    nodes.osc2.stop(t + 0.25);
    nodes.lfo.stop(t + 0.25);
  } catch { /* ignore */ }
  nodes = null;
  running = false;
}

// Auto pause on tab hide; resume on visible (but only if audio was unlocked).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAmbient();
    else if (getCtx()) startAmbient();
  });
}
