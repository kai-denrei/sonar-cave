// Sonar audio cues.
//   playSweepPing()      — short 800Hz sine, 80ms, fade out. Fired once per
//                          sweep revolution (when the angle wraps).
//   playMultibeamPing()  — 200Hz + 400Hz chord, 250ms, resonant tail via biquad.
//                          Fired on PING button.
// Both are no-ops if audio hasn't been unlocked yet.

import { getCtx, getMaster } from './unlock.js';

export function playSweepPing() {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
  osc.connect(g).connect(getMaster() || ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.1);
}

export function playMultibeamPing() {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  // Chord: 200 + 400 Hz, plus a low resonant tail via bandpass biquad
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.32, t0 + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
  out.connect(getMaster() || ctx.destination);

  for (const freq of [200, 400]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.27);
  }

  // Resonant tail — narrow bandpass on white noise, modulated freq sweep
  const bufSize = Math.floor(ctx.sampleRate * 0.5);
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(600, t0);
  bp.frequency.exponentialRampToValueAtTime(180, t0 + 0.5);
  bp.Q.value = 18;
  const tailGain = ctx.createGain();
  tailGain.gain.setValueAtTime(0.0001, t0);
  tailGain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
  tailGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  noise.connect(bp).connect(tailGain).connect(getMaster() || ctx.destination);
  noise.start(t0);
  noise.stop(t0 + 0.55);
}
