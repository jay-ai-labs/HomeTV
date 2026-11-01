// Generates demo poster art and channel logos for the HomeTV prototype.
// Text is converted to vector paths so the art looks the same on every device.
'use strict';
const fs = require('fs'), path = require('path'), ot = require('opentype.js');
// The prototype lives in docs/design/prototype (repo root tools/ now, development/tools/ after the code move).
const OUT = process.argv[2] || [path.join(__dirname, '..', 'docs', 'design', 'prototype', 'art'), path.join(__dirname, '..', '..', 'docs', 'design', 'prototype', 'art'), path.join(__dirname, '..', 'prototype', 'art')]
  .find(p => fs.existsSync(path.dirname(p))) || path.join(__dirname, 'art');
fs.mkdirSync(OUT, { recursive: true });
const F = n => { const b = fs.readFileSync(path.join(__dirname, 'node_modules/@fontsource', n)); return ot.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const fonts = {
  anton: F('anton/files/anton-latin-400-normal.woff'),
  serif: F('dm-serif-display/files/dm-serif-display-latin-400-normal.woff'),
  black: F('archivo-black/files/archivo-black-latin-400-normal.woff'),
  play: F('playfair-display/files/playfair-display-latin-900-italic.woff'),
  playR: F('playfair-display/files/playfair-display-latin-700-normal.woff'),
  oswald: F('oswald/files/oswald-latin-700-normal.woff'),
  mont: F('montserrat/files/montserrat-latin-800-normal.woff'),
  mont5: F('montserrat/files/montserrat-latin-500-normal.woff'),
};
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hsl = (h, s, l, a = 1) => a === 1 ? `hsl(${h % 360} ${s}% ${l}%)` : `hsl(${h % 360} ${s}% ${l}% / ${a})`;

// text helpers --------------------------------------------------------------
function fitText(font, text, maxW, maxSize, tracking = 0) {
  let size = maxSize;
  const width = sz => font.getAdvanceWidth(text, sz) + tracking * sz * (text.length - 1);
  while (size > 8 && width(size) > maxW) size -= 1;
  return { size, w: width(size) };
}
function textPath(font, text, x, y, size, tracking = 0) {
  if (!tracking) return font.getPath(text, x, y, size).toPathData(1);
  let d = '', cx = x;
  for (const ch of text) { d += font.getPath(ch, cx, y, size).toPathData(1); cx += font.getAdvanceWidth(ch, size) + tracking * size; }
  return d;
}
function wrap(text, maxChars) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}

// poster motifs (400 x 600) -------------------------------------------------
function hills(r, h, n, baseY, amp, light) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const y0 = baseY + i * 38, a = amp * (1 - i * 0.18), ph = r() * 6, f = 0.008 + r() * 0.01;
    let d = `M0 600 L0 ${y0}`;
    for (let x = 0; x <= 400; x += 10) d += ` L${x} ${(y0 + Math.sin(x * f + ph) * a + Math.sin(x * f * 2.7 + ph * 2) * a * 0.35).toFixed(1)}`;
    d += ' L400 600 Z';
    out += `<path d="${d}" fill="${hsl(h + i * 6, 35, Math.max(4, light - i * 6))}"/>`;
  }
  return out;
}
function peaks(r, h, n, baseY) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const y0 = baseY + i * 45; let d = `M0 600 L0 ${y0 + 40}`; let x = 0;
    while (x < 400) { x += 30 + r() * 60; d += ` L${x.toFixed(0)} ${(y0 - r() * (110 - i * 25)).toFixed(0)} L${(x + 20 + r() * 30).toFixed(0)} ${(y0 + 20 + r() * 30).toFixed(0)}`; x += 30; }
    d += ' L400 600 Z';
    out += `<path d="${d}" fill="${hsl(h, 30, 10 + i * 4)}"/><rect x="0" y="${y0 - 10}" width="400" height="120" fill="url(#fog)" opacity=".5"/>`;
  }
  return out;
}
function skyline(r, h) {
  let out = '', x = -10;
  while (x < 410) {
    const w = 24 + r() * 46, top = 300 + r() * 170;
    out += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${600 - top}" fill="${hsl(h + 200, 30, 7 + r() * 5)}"/>`;
    for (let wy = top + 10; wy < 590; wy += 14) for (let wx = x + 5; wx < x + w - 6; wx += 9) if (r() < 0.22) out += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="4" height="6" fill="${hsl(h + 30, 90, 70, 0.8)}"/>`;
    x += w + 2;
  }
  return out;
}
function rings(r, h) {
  const cx = 120 + r() * 160, cy = 180 + r() * 160; let out = `<circle cx="${cx}" cy="${cy}" r="70" fill="url(#core)"/>`;
  for (let i = 1; i < 14; i++) out += `<circle cx="${cx}" cy="${cy}" r="${40 + i * 28}" fill="none" stroke="${hsl(h + 20, 80, 70, 0.5 - i * 0.03)}" stroke-width="${i % 3 ? 1 : 2.5}"/>`;
  return out;
}
function blooms(r, h) {
  let out = '';
  for (let i = 0; i < 7; i++) out += `<circle cx="${(r() * 400).toFixed(0)}" cy="${(r() * 480).toFixed(0)}" r="${(80 + r() * 140).toFixed(0)}" fill="${hsl(h + i * 35, 85, 55, 0.35)}"/>`;
  return `<g filter="url(#blur)">${out}</g>`;
}
function beams(r, h) {
  let out = '';
  for (let i = 0; i < 6; i++) { const x = r() * 400; out += `<polygon points="${x},0 ${x + 30 + r() * 40},0 ${x - 160 + r() * 80},600 ${x - 240},600" fill="${hsl(h + 30, 80, 80, 0.07 + r() * 0.06)}"/>`; }
  return out;
}
function popStripes(r, h) {
  let out = `<rect width="400" height="600" fill="${hsl(h, 62, 54)}"/>`;
  for (let i = -6; i < 16; i += 2) out += `<rect x="${i * 40}" y="-100" width="40" height="900" fill="${hsl(h + 8, 66, 59)}" transform="rotate(25 200 300)"/>`;
  out += `<circle cx="${200 + (r() - 0.5) * 120}" cy="250" r="${120 + r() * 40}" fill="${hsl(h + 170, 45, 28)}"/>`;
  return out;
}
function waves(r, h) {
  let out = '';
  for (let i = 0; i < 8; i++) {
    const y0 = 330 + i * 34; let d = `M0 600 L0 ${y0}`;
    for (let x = 0; x <= 400; x += 10) d += ` L${x} ${(y0 + Math.sin(x * 0.03 + i) * 8).toFixed(1)}`;
    out += `<path d="${d} L400 600Z" fill="${hsl(h + 190, 55, 22 - i * 2)}"/>`;
  }
  return out;
}

const STYLES = {
  sun: (r, h) => `<rect width="400" height="600" fill="url(#sky)"/><circle cx="${140 + r() * 120}" cy="${230 + r() * 60}" r="${70 + r() * 50}" fill="${hsl(28 + h % 28, 95, 70)}"/><circle cx="200" cy="300" r="260" fill="url(#glow)"/>${hills(r, h + 200, 4, 370, 26, 18)}`,
  city: (r, h) => `<rect width="400" height="600" fill="url(#sky)"/><circle cx="${80 + r() * 240}" cy="${110 + r() * 80}" r="36" fill="${hsl(h + 40, 40, 88)}"/>${beams(r, h)}${skyline(r, h)}`,
  rings: (r, h) => `<rect width="400" height="600" fill="${hsl(h + 210, 45, 7)}"/>${rings(r, h)}`,
  peaks: (r, h) => `<rect width="400" height="600" fill="url(#sky)"/>${peaks(r, h + 200, 4, 330)}`,
  bloom: (r, h) => `<rect width="400" height="600" fill="${hsl(h + 300, 50, 12)}"/>${blooms(r, h)}`,
  pop: (r, h) => popStripes(r, h),
  sea: (r, h) => `<rect width="400" height="600" fill="url(#sky)"/><circle cx="${100 + r() * 200}" cy="300" r="60" fill="${hsl(30 + h % 25, 90, 74)}"/>${waves(r, h)}`,
};
const TYPE = [
  { f: 'anton', up: true, track: 0.02, max: 92, lh: 0.95 },
  { f: 'serif', up: false, track: 0, max: 70, lh: 1.0 },
  { f: 'black', up: true, track: -0.01, max: 58, lh: 1.0 },
  { f: 'play', up: false, track: 0, max: 64, lh: 1.05 },
  { f: 'oswald', up: true, track: 0.08, max: 66, lh: 1.05 },
  { f: 'mont', up: true, track: 0.12, max: 44, lh: 1.2 },
];

function poster(title, year, style, typeIdx, hue, kind) {
  const r = rng(hash(title + kind)); const h = hue;
  const t = TYPE[typeIdx], font = fonts[t.f];
  const text = t.up ? title.toUpperCase() : title;
  const lines = wrap(text, t.f === 'anton' ? 10 : t.f === 'mont' ? 9 : 12);
  const sizes = lines.map(l => fitText(font, l, 340, t.max, t.track));
  const size = Math.min(...sizes.map(s => s.size));
  const lineH = size * t.lh * 1.12, blockH = lineH * lines.length;
  const atTop = style === 'sun' || style === 'peaks' || style === 'sea' ? false : r() < 0.4;
  const y0 = atTop ? 70 + size : 545 - blockH + size * 0.8;
  const ink = style === 'pop' ? hsl(h + 180, 60, 12) : '#fff';
  let tp = '';
  lines.forEach((l, i) => { const w = fitText(font, l, 340, size, t.track).w; tp += textPath(font, l, (400 - w) / 2, y0 + i * lineH, size, t.track); });
  const yr = String(year), ys = fitText(fonts.mont5, yr, 200, 15, 0.3);
  const sub = textPath(fonts.mont5, yr, (400 - ys.w) / 2, atTop ? 572 : 580, 15, 0.3);
  const scrim = style === 'pop' ? '' : `<rect width="400" height="600" fill="url(#${atTop ? 'scrimT' : 'scrimB'})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(h + 220, 55, 10)}"/><stop offset=".55" stop-color="${hsl(h + 300, 50, 28)}"/><stop offset="1" stop-color="${hsl(h + 20, 80, 55)}"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="${hsl(h + 40, 100, 70, 0.45)}"/><stop offset="1" stop-color="${hsl(h + 40, 100, 70, 0)}"/></radialGradient>
<radialGradient id="core"><stop offset="0" stop-color="${hsl(h + 20, 100, 85)}"/><stop offset=".4" stop-color="${hsl(h + 10, 90, 55, 0.6)}"/><stop offset="1" stop-color="${hsl(h, 90, 40, 0)}"/></radialGradient>
<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(h + 220, 40, 70, 0)}"/><stop offset="1" stop-color="${hsl(h + 220, 40, 70, 0.25)}"/></linearGradient>
<linearGradient id="scrimB" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></linearGradient>
<linearGradient id="scrimT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
<filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="28"/></filter>
</defs>${STYLES[style](r, h)}${scrim}<path d="${tp}" fill="${ink}"/><path d="${sub}" fill="${ink}" fill-opacity=".8"/></svg>`;
}

// channel logos (240 x 120, white wordmark + coloured mark) ----------------
function logo(name, cat, i) {
  const hueByCat = { 1: 355, 2: 140, 3: 40, 4: 290, 5: 165, 6: 320, 7: 25 };
  const h = (hueByCat[cat] + i * 23) % 360;
  const fontKey = { 1: 'black', 2: 'anton', 3: 'serif', 4: 'black', 5: 'mont', 6: 'oswald', 7: 'playR' }[cat];
  const font = fonts[fontKey];
  const m = name.match(/^(.*?)(\s+(\d+|One|Plus|Max|TV|Live|Now|HD))?$/);
  let main = name, tag = '';
  if (m && m[2] && name.split(' ').length > 1) { main = m[1]; tag = m[3]; }
  const upper = ['black', 'anton', 'mont', 'oswald'].includes(fontKey);
  const words = (upper ? main.toUpperCase() : main);
  const lines = words.length > 11 && words.includes(' ') ? wrap(words, Math.ceil(words.length / 2) + 2).slice(0, 2) : [words];
  const markW = 46;
  const maxW = 240 - markW - 18 - (tag ? 6 : 0);
  const sz = Math.min(...lines.map(l => fitText(font, l, maxW, lines.length > 1 ? 34 : 44, upper ? 0.02 : 0).size));
  const lh = sz * 1.0; const total = lh * lines.length;
  let d = '', y = 60 - total / 2 + sz * 0.78;
  for (const l of lines) { d += textPath(font, l, markW + 14, y, sz, upper ? 0.02 : 0); y += lh; }
  const shapes = [
    `<circle cx="23" cy="60" r="21" fill="${hsl(h, 85, 55)}"/>`,
    `<rect x="2" y="39" width="42" height="42" rx="9" fill="${hsl(h, 80, 52)}"/>`,
    `<polygon points="4,38 44,60 4,82" fill="${hsl(h, 85, 56)}"/>`,
    `<rect x="2" y="39" width="42" height="42" rx="21" fill="none" stroke="${hsl(h, 85, 60)}" stroke-width="8"/>`,
  ];
  let mark = shapes[(hash(name) >>> 3) % shapes.length];
  if (tag) {
    const tf = fitText(fonts.black, tag.toUpperCase(), 30, 18, 0);
    mark = `<rect x="2" y="39" width="42" height="42" rx="9" fill="${hsl(h, 80, 50)}"/><path d="${textPath(fonts.black, tag.toUpperCase(), 23 - tf.w / 2, 60 + tf.size * 0.36, tf.size)}" fill="#fff"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120">${mark}<path d="${d}" fill="#fff"/></svg>`;
}

// data (mirrors demo.js) ----------------------------------------------------
const CHANNELS = {
  1: ['Metro News 24', 'Global Report', 'Business Today', 'Weather Now', 'City Live'],
  2: ['Arena Sports 1', 'Arena Sports 2', 'Goal TV', 'Court Side', 'Motor Max', 'Cricket Plus'],
  3: ['Cinema One', 'Cinema Classics', 'Drama Plus', 'Thriller Zone', 'Laugh Track'],
  4: ['Kids Planet', 'Toon Time', 'Family Hub'],
  5: ['Nature & Wild', 'Science Now', 'History Vault', 'Travel Escape', 'Kitchen Live'],
  6: ['Hit Music TV', 'Retro Hits', 'Jazz Lounge'],
  7: ['India Gold', 'Desi News 24', 'Gujarati Plus', 'Filmy Masala', 'Bhakti Sagar'],
};
const MOVIES = {
  10: [['Northern Lights', 'peaks'], ['The Glass Orchard', 'bloom'], ['Signal Lost', 'rings'], ['Paper Kingdoms', 'city'], ['Echoes of June', 'sun'], ['After the Storm', 'sea']],
  11: [['Iron Horizon', 'peaks'], ['Edge of Midnight', 'city'], ['The Ninth Gate Run', 'rings'], ['Red Canyon', 'sun'], ['Deep Current', 'sea'], ['Skyfall Protocol', 'rings']],
  12: [['Wedding Crashers Club', 'pop'], ['My Neighbour the Chef', 'pop'], ['Totally Fine', 'pop'], ['Road Trip Rules', 'sun'], ['Office Hours', 'pop']],
  13: [['The Secret Garden Gate', 'bloom'], ['Captain Biscuit', 'pop'], ['Snow Day Heroes', 'peaks'], ['Dragon Lake', 'sea']],
  14: [['Dil Se Dosti', 'bloom'], ['Monsoon Melody', 'sea'], ['Rang Barse', 'bloom'], ['Safar', 'sun'], ['Kismat Connection 2', 'bloom']],
};
const SERIES = { 20: [['The Harbour', 'sea'], ['Kingsbridge', 'city'], ['Summer House', 'sun']], 21: [['Flat Share', 'pop'], ['The Night Desk', 'city']], 22: [['Cold Case Unit', 'rings'], ['Blackwater', 'peaks']], 23: [['Ghar Ki Baat', 'bloom'], ['Mumbai Diaries Season', 'city']] };

let n = 0;
for (const [cat, list] of Object.entries(CHANNELS)) list.forEach((name, i) => { fs.writeFileSync(path.join(OUT, `l-${slug(name)}.svg`), logo(name, Number(cat), i)); n++; });
for (const [kind, groups] of [['m', MOVIES], ['s', SERIES]]) for (const list of Object.values(groups)) list.forEach(([title, style]) => {
  const r = rng(hash(title)); const year = kind === 'm' ? 2018 + Math.floor(r() * 8) : 2016 + Math.floor(r() * 9);
  const typeIdx = hash(title + 't') % TYPE.length, hue = hash(title + 'h') % 360;
  fs.writeFileSync(path.join(OUT, `${kind}-${slug(title)}.svg`), poster(title, year, style, typeIdx, hue, kind)); n++;
});
console.log('wrote', n, 'files to', OUT);
