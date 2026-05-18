#!/usr/bin/env node
// Walk dist/ and inject the precache list into dist/sw.js.
// Runs as a postbuild step.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SW   = join(DIST, 'sw.js');
const HTML = join(DIST, 'index.html');

if (!existsSync(DIST)) {
  console.warn('[precache] dist/ not present — run `vite build` first');
  process.exit(0);
}
if (!existsSync(SW)) {
  console.warn('[precache] dist/sw.js not present — skipping');
  process.exit(0);
}

// Read the cache-bust token from dist/index.html so the SW cache name keys to
// the same token as the rest of the build (the prebuild bust.sh wrote it into
// the cb meta tag).
let token = 'unbusted';
if (existsSync(HTML)) {
  const html = readFileSync(HTML, 'utf8');
  const m = html.match(/<meta[^>]*name="cb"[^>]*content="([^"]+)"/);
  if (m) token = m[1];
}

const SKIP = new Set(['.DS_Store']);
const SKIP_EXT = new Set(['.map']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else {
      const ext = name.slice(name.lastIndexOf('.'));
      if (SKIP_EXT.has(ext)) continue;
      out.push('./' + relative(DIST, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

const files = walk(DIST)
  .filter((p) => p !== './sw.js')                // don't precache the SW itself
  .filter((p) => !p.startsWith('./cb-shapes/'))  // 64 shape SVGs would bloat the cache
  .sort();

const totalBytes = files.reduce((n, f) => n + statSync(join(DIST, f.slice(2))).size, 0);
const totalMB = totalBytes / 1024 / 1024;

let sw = readFileSync(SW, 'utf8');
// Substitute the cache-bust token (was '__CB_TOKEN__' in source).
sw = sw.replace(/__CB_TOKEN__/g, token);
const injection = `self.__PRECACHE__ = ${JSON.stringify(['./', ...files], null, 2)};`;
sw = injection + '\n' + sw;
writeFileSync(SW, sw);

console.log(`[precache] token=${token}, injected ${files.length + 1} entries into dist/sw.js (${totalMB.toFixed(2)} MB)`);
if (totalMB > 10) {
  console.warn(`[precache] WARNING: precache > 10MB`);
}
