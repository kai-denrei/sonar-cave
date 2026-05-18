// HUD — SVG gauges injected into #hud-root. Updates at 15 Hz (not every frame).
// Mandatory gauges: depth (m + Bar), heading (compass), pitch (numeric), altimeter.
// Optional: tiny top-down sweep dial; pressure warning red when depth > 20m.
//
// Aesthetic: editorial dark. Dark grey panels, thin borders, monospace numerics,
// single-decimal precision, amber accent for live values, no gradients/shadows/round.

const SVG_NS = 'http://www.w3.org/2000/svg';
const TICK_PERIOD = 1 / 15; // 15 Hz update rate

function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  for (const c of children) e.appendChild(c);
  return e;
}

function div(cls, html = '') {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (html) d.innerHTML = html;
  return d;
}

export function createHud({ sub, getAltimeter, getSweepAngle }) {
  const root = document.getElementById('hud-root');
  if (!root) throw new Error('hud-root missing');

  // ---- Strip container at top
  const strip = div('hud-strip');
  root.appendChild(strip);

  // ---- Depth gauge
  const depthPanel = div('hud-panel hud-depth');
  depthPanel.appendChild(div('hud-label', 'DEPTH'));
  const depthVal = div('hud-val hud-val-lg');
  depthVal.textContent = '0.0 m';
  depthPanel.appendChild(depthVal);
  const barVal = div('hud-sub');
  barVal.textContent = '1.00 Bar';
  depthPanel.appendChild(barVal);
  strip.appendChild(depthPanel);

  // ---- Heading compass (SVG rotating card)
  const hdgPanel = div('hud-panel hud-heading');
  hdgPanel.appendChild(div('hud-label', 'HDG'));
  const hdgSvg = el('svg', { viewBox: '-50 -50 100 100', class: 'hud-compass' });
  // Outer ring
  hdgSvg.appendChild(el('circle', { cx: 0, cy: 0, r: 42, class: 'hud-ring' }));
  // Rotating tick group — N/E/S/W marks
  const hdgGroup = el('g', { class: 'hud-compass-card' });
  for (let i = 0; i < 36; i++) {
    const deg = i * 10;
    const major = i % 9 === 0;
    const len = major ? 8 : 4;
    const rad = (deg - 90) * Math.PI / 180;
    const x1 = Math.cos(rad) * 42, y1 = Math.sin(rad) * 42;
    const x2 = Math.cos(rad) * (42 - len), y2 = Math.sin(rad) * (42 - len);
    hdgGroup.appendChild(el('line', {
      x1, y1, x2, y2, class: major ? 'hud-tick-maj' : 'hud-tick-min',
    }));
  }
  const labels = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
  for (const [t, deg] of labels) {
    const rad = (deg - 90) * Math.PI / 180;
    const x = Math.cos(rad) * 28, y = Math.sin(rad) * 28;
    const txt = el('text', { x, y, class: 'hud-card-letter', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    txt.textContent = t;
    hdgGroup.appendChild(txt);
  }
  hdgSvg.appendChild(hdgGroup);
  // Static lubber line (pointer at top)
  hdgSvg.appendChild(el('line', { x1: 0, y1: -46, x2: 0, y2: -38, class: 'hud-lubber' }));
  hdgPanel.appendChild(hdgSvg);
  const hdgNum = div('hud-sub hud-mono');
  hdgNum.textContent = '000';
  hdgPanel.appendChild(hdgNum);
  strip.appendChild(hdgPanel);

  // ---- Pitch (artificial-horizon-ish, simplified — numeric only with a tilt bar)
  const pitchPanel = div('hud-panel hud-pitch');
  pitchPanel.appendChild(div('hud-label', 'PITCH'));
  const pitchSvg = el('svg', { viewBox: '-40 -30 80 60', class: 'hud-horizon' });
  pitchSvg.appendChild(el('rect', { x: -38, y: -28, width: 76, height: 56, class: 'hud-horizon-bg' }));
  const horizon = el('g', { class: 'hud-horizon-card' });
  // The line (horizon) — rises/falls with pitch
  horizon.appendChild(el('line', { x1: -34, y1: 0, x2: 34, y2: 0, class: 'hud-horizon-line' }));
  // Pitch ladder ticks every 10°
  for (let p = -30; p <= 30; p += 10) {
    if (p === 0) continue;
    const y = p; // 1px per degree
    const w = Math.abs(p) === 30 ? 8 : 16;
    horizon.appendChild(el('line', { x1: -w, y1: y, x2: w, y2: y, class: 'hud-horizon-tick' }));
  }
  pitchSvg.appendChild(horizon);
  // Center cross (static)
  pitchSvg.appendChild(el('line', { x1: -6, y1: 0, x2: -2, y2: 0, class: 'hud-cross' }));
  pitchSvg.appendChild(el('line', { x1: 2, y1: 0, x2: 6, y2: 0, class: 'hud-cross' }));
  pitchSvg.appendChild(el('circle', { cx: 0, cy: 0, r: 1, class: 'hud-cross' }));
  pitchPanel.appendChild(pitchSvg);
  const pitchNum = div('hud-sub hud-mono');
  pitchNum.textContent = '+00';
  pitchPanel.appendChild(pitchNum);
  strip.appendChild(pitchPanel);

  // ---- Altimeter
  const altPanel = div('hud-panel hud-alt');
  altPanel.appendChild(div('hud-label', 'ALT'));
  const altVal = div('hud-val');
  altVal.textContent = '—';
  altPanel.appendChild(altVal);
  altPanel.appendChild(div('hud-sub', 'BELOW'));
  strip.appendChild(altPanel);

  // ---- Sweep dial (small top-down, optional)
  const sweepPanel = div('hud-panel hud-sweep');
  sweepPanel.appendChild(div('hud-label', 'SWEEP'));
  const sweepSvg = el('svg', { viewBox: '-50 -50 100 100', class: 'hud-sweep-dial' });
  sweepSvg.appendChild(el('circle', { cx: 0, cy: 0, r: 42, class: 'hud-ring' }));
  sweepSvg.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: -3, class: 'hud-sweep-ctr' }));
  const sweepArm = el('line', { x1: 0, y1: 0, x2: 0, y2: -40, class: 'hud-sweep-arm' });
  sweepSvg.appendChild(sweepArm);
  sweepPanel.appendChild(sweepSvg);
  strip.appendChild(sweepPanel);

  // ---- 15Hz throttle
  let accum = 0;
  let lastNow = 0;

  function tick(now) {
    if (lastNow === 0) { lastNow = now; return; }
    const dt = now - lastNow;
    lastNow = now;
    accum += dt;
    if (accum < TICK_PERIOD) return;
    accum = 0;

    // ---- Depth (sub at y=0 → 0m. Below → positive m)
    const depth = -sub.position.y;
    const bar = 1 + Math.max(0, depth) / 10;
    depthVal.textContent = `${depth.toFixed(1)} m`;
    barVal.textContent   = `${bar.toFixed(2)} Bar`;
    if (depth > 20) depthPanel.classList.add('warn');
    else depthPanel.classList.remove('warn');

    // ---- Heading: +Z = North (0°), +X = East (90°). yaw radians around Y axis.
    // sub.forward at yaw=0 → (0, 0, 1) which is +Z = North. yaw rotates clockwise
    // viewed from above (positive yaw rotates +Z toward +X for our right-handed
    // setup with the existing physics math).
    let headingDeg = (sub.yaw * 180 / Math.PI) % 360;
    if (headingDeg < 0) headingDeg += 360;
    hdgNum.textContent = headingDeg.toFixed(0).padStart(3, '0');
    // Rotate compass card opposite to heading (so the current heading sits at top).
    hdgGroup.setAttribute('transform', `rotate(${(-headingDeg).toFixed(1)})`);

    // ---- Pitch
    const pitchDeg = sub.pitch * 180 / Math.PI;
    const pAbs = Math.abs(pitchDeg).toFixed(0).padStart(2, '0');
    pitchNum.textContent = (pitchDeg >= 0 ? '+' : '-') + pAbs;
    // Horizon ladder slides opposite the pitch
    horizon.setAttribute('transform', `translate(0, ${pitchDeg.toFixed(1)})`);

    // ---- Altimeter
    const alt = getAltimeter ? getAltimeter() : Infinity;
    if (!isFinite(alt)) {
      altVal.textContent = '—';
      altPanel.classList.remove('warn');
    } else {
      altVal.textContent = `${alt.toFixed(2)} m`;
      if (alt < 2.0) altPanel.classList.add('warn');
      else altPanel.classList.remove('warn');
    }

    // ---- Sweep dial — angle is from sub.yaw + sweep azimuth; the sweep code
    // increments `angle` relative to sub facing. Show that on a top-down dial.
    if (getSweepAngle) {
      const a = getSweepAngle();
      const deg = (a * 180 / Math.PI) % 360;
      sweepArm.setAttribute('transform', `rotate(${deg.toFixed(1)})`);
    }
  }

  return { tick };
}
