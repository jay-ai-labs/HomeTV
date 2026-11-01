/* HomeTV web app — talks only to the HomeTV server on your home computer. */
'use strict';

// ------------------------------------------------------------------ helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowS = () => Date.now() / 1000;
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
const fmtTime = ts => new Date(ts * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDur = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const fmtDay = ts => { const d = new Date(ts * 1000), t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today'; if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); };
const touchUI = () => window.matchMedia('(hover: none)').matches;
const isNarrow = () => window.matchMedia('(max-width: 700px)').matches; // phone portrait layout
const ic = n => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
const cleanTitle = s => String(s || '').replace(/\s*\((19|20)\d\d\)\s*$/, '').trim();
const cssUrl = u => String(u).replace(/["\\\n\r]/g, c => encodeURIComponent(c));
const bgStyle = u => u ? `background-image:url(&quot;${esc(cssUrl(u))}&quot;)` : '';
const fmtLeft = (s, short) => { const m = Math.max(1, Math.round(s / 60)), h = Math.floor(m / 60), r = m % 60;
  if (short) return h ? `${h}h${r ? ` ${r}m` : ''}` : `${m}m`;
  return (h ? `${h} h${r ? ` ${r} min` : ''}` : `${m} min`) + ' left'; };
const fmtRuntime = d => { const p = String(d).split(':').map(Number); let m;
  if (p.length === 3) m = p[0] * 60 + p[1]; else if (p.length === 2) m = p[0]; else m = Number(d) > 600 ? Math.round(Number(d) / 60) : Number(d);
  if (!m || !isFinite(m)) return String(d); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`; };
const b64 = s => { if (!s) return ''; try { return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))); } catch { return s; } };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const initials = s => esc(String(s || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?');
const imgTag = (src, cls, alt = '') => src
  ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls} ph',textContent:''}))">`
  : `<div class="${cls} ph">${initials(alt)}</div>`;
const isApple = (() => { const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Android|Edg|Silk/.test(ua)); })();

async function api(path, opts) {
  const r = await fetch(path, opts);
  let j = null; try { j = await r.json(); } catch { /* not json */ }
  if (!r.ok) throw new Error((j && j.error) || ('Server error ' + r.status));
  return j;
}
const x = (action, params = {}) => api('/api/x?' + new URLSearchParams({ action, ...params }));
const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let toastTimer;
function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ------------------------------------------------------------------ state
const S = {
  status: null, view: localStorage.getItem('view') || 'home', info: new Map(), heroTimer: null,
  live: { cats: [], streams: [], byId: new Map(), byCat: new Map() },
  vod: { cats: null, byCat: new Map(), all: null },
  series: { cats: null, byCat: new Map(), all: null },
  user: { favorites: { live: [], movie: [], series: [] }, hidden: { live: [], movie: [], series: [] }, progress: {}, recent: [] },
  epg: new Map(), epgT: new Map(), epgState: 'idle',
  liveGroup: localStorage.getItem('liveGroup') || null,
  guideGroup: localStorage.getItem('guideGroup') || null,
  vodGroup: { movie: localStorage.getItem('movieGroup'), series: localStorage.getItem('seriesGroup') },
  guideStart: null,
};
const isFav = (kind, id) => S.user.favorites[kind].some(f => String(f.id) === String(id));

// ------------------------------------------------------------------ layers (Back button support)
const layers = [];
function pushLayer(name, onClose) { layers.push({ name, onClose }); history.pushState({ layer: layers.length }, ''); }
function popLayer() { if (layers.length) history.back(); }
window.addEventListener('popstate', () => { const l = layers.pop(); if (l) l.onClose(); });

// ------------------------------------------------------------------ boot
async function boot() {
  try { S.status = await api('/api/status'); }
  catch { document.body.innerHTML = '<div class="empty">Can\'t reach the HomeTV server.<br>Make sure it is still running on your home computer, then reload this page.</div>'; return; }
  if (!S.status.configured) return showSetup(false);
  $('#app').classList.remove('hidden');
  $('#main').innerHTML = '<div class="loading">Loading your channels…</div>';
  try { await Promise.all([loadUser(), loadLive()]); }
  catch (e) { $('#main').innerHTML = `<div class="empty">Couldn't load channels from your provider.<br>${esc(e.message)}<div class="row-btns" style="justify-content:center"><button class="btn primary" onclick="location.reload()">Try again</button><button class="btn" onclick="setView('settings')">Settings</button></div></div>`; return; }
  setView(S.view);
  setInterval(tick, 30000);
  tickClock(); setInterval(tickClock, 5000);
  if (S.status.account && S.status.account.status && S.status.account.status !== 'Active')
    toast('Your provider says this account is: ' + S.status.account.status, 8000);
}

async function loadUser() { S.user = await api('/api/userdata'); }

async function loadLive(refresh) {
  const q = refresh ? { refresh: '1' } : {};
  const [cats, streams] = await Promise.all([x('get_live_categories', q), x('get_live_streams', q)]);
  S.live.cats = arr(cats);
  S.live.streams = arr(streams).map((s, i) => ({ ...s, id: String(s.stream_id), n: Number(s.num) || i + 1, epg: s.epg_channel_id || '' }));
  S.live.byId = new Map(S.live.streams.map(s => [s.id, s]));
  S.live.byCat = new Map();
  for (const s of S.live.streams) {
    const ids = new Set([String(s.category_id), ...arr(s.category_ids).map(String)]);
    for (const c of ids) { if (!S.live.byCat.has(c)) S.live.byCat.set(c, []); S.live.byCat.get(c).push(s); }
  }
}

function tickClock() { $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

function tick() {
  if (S.epgState !== 'ready') { S.epgT.clear(); }
  for (const [id, t] of S.epgT) if (Date.now() - t > 3600e3) S.epgT.delete(id);
  if (S.view === 'live') refreshNowRows();
  if (S.view === 'home') { const r = $('#shelves'); if (r) fillLiveCards(r); }
  if (S.view === 'guide') placeNowLine();
  updateOsd(); updatePreviewInfo();
}

// ------------------------------------------------------------------ setup
// Two login types (F-036): Xtream Codes (server + username + password) and Stalker MAC portal (portal URL + MAC).
// The MAC is a credential: it is sent to the helper once and never shown again (Settings shows only the last 2 bytes).
const fmtMac = v => { const h = String(v || '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 12); return h.match(/.{1,2}/g)?.join(':') || ''; };
const macOk = v => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(v);
function setLoginType(type) {
  const f = $('#setupForm'); f.elements.type.value = type;
  $$('#loginType [role=radio]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.type === type)));
  $$('.login-fields', f).forEach(fs => { const on = fs.dataset.for === type; fs.hidden = !on; fs.disabled = !on; });
  const cur = S.status && S.status.configured && (S.status.provider_type || 'xtream');
  $('#switchNote').classList.toggle('hidden', !cur || cur === type);
  $('#setupError').textContent = ''; clearFieldErrors();
}
function clearFieldErrors() { $$('#setupForm .field-error').forEach(e => e.textContent = ''); $$('#setupForm [aria-invalid]').forEach(i => i.removeAttribute('aria-invalid')); }
function fieldError(name, msg) { const i = $(`#setupForm [name=${name}]`); i.setAttribute('aria-invalid', 'true'); $(`#${name}Err`).textContent = msg; i.focus(); }
function showSetup(cancellable) {
  $('#setup').classList.remove('hidden');
  $('#app').classList.add('hidden');
  $('#setupCancel').classList.toggle('hidden', !cancellable);
  setLoginType((S.status && S.status.provider_type) || 'xtream');
  const first = $('#setupForm .login-fields:not([hidden]) input'); if (first && !touchUI()) first.focus();
}
$('#loginType').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (b) setLoginType(b.dataset.type); });
$('#loginType').addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault(); e.stopPropagation();
  const t = $('#setupForm').elements.type.value === 'xtream' ? 'stalker' : 'xtream'; setLoginType(t); $(`#loginType [data-type=${t}]`).focus();
});
$('#setupForm [name=mac]').addEventListener('input', e => {
  const i = e.target, f = fmtMac(i.value); if (i.value !== f) i.value = f;
  if (macOk(f)) { i.removeAttribute('aria-invalid'); $('#macErr').textContent = ''; }
});
$('#setupForm [name=mac]').addEventListener('blur', e => { const v = e.target.value; if (v && !macOk(v)) fieldError('mac', 'A MAC address has 12 letters and numbers, like 00:1A:79:12:34:56.'); });
$('#setupCancel').onclick = () => { $('#setup').classList.add('hidden'); $('#app').classList.remove('hidden'); };
$('#setupForm').onsubmit = async e => {
  e.preventDefault(); clearFieldErrors();
  const form = e.target, btn = $('#setupBtn'), type = form.elements.type.value;
  const body = Object.fromEntries(new FormData(form));
  if (type === 'stalker') {
    let portal = (body.portal || '').trim();
    if (portal && !/^https?:\/\//i.test(portal)) portal = 'http://' + portal;
    body.portal = portal; body.mac = fmtMac(body.mac);
    if (!portal) return fieldError('portal', 'Enter the portal URL your provider gave you.');
    try { new URL(portal); } catch { return fieldError('portal', 'This doesn\'t look like a web address. It usually starts with http://'); }
    if (!macOk(body.mac)) return fieldError('mac', body.mac ? 'A MAC address has 12 letters and numbers, like 00:1A:79:12:34:56.' : 'Enter the MAC address your provider registered.');
  } else if (!(body.server || '').trim() || !(body.username || '').trim() || !(body.password || '').trim()) {
    $('#setupError').textContent = 'Fill in the server address, username and password.'; return;
  }
  btn.disabled = true; btn.textContent = 'Connecting…'; $('#setupError').textContent = '';
  try {
    await post('/api/setup', body);
    location.reload();
  } catch (err) {
    let msg = err.message;
    // a helper from before F-036 doesn't know MAC portals and asks for a server address instead
    if (type === 'stalker' && /server address/i.test(msg)) msg = 'This HomeTV helper can\'t connect to MAC portals yet. Update it to the version with MAC portal support (F-036).';
    $('#setupError').textContent = msg; btn.disabled = false; btn.textContent = 'Connect';
  }
};


// ------------------------------------------------------------------ views
$('#app').addEventListener('click', e => { const b = e.target.closest('.rail button[data-view], .mtop button[data-view]'); if (b) setView(b.dataset.view); });
const VIEWS = { home: () => renderHome(), live: () => renderLive(), guide: () => renderGuide(), movies: () => renderVod('movie'), series: () => renderVod('series'), search: () => renderSearch(), settings: () => renderSettings() };
function setView(v) {
  if (!VIEWS[v]) v = 'home';
  if (P.mode === 'preview' && v !== 'live') stopPlayback(true);
  S.view = v; localStorage.setItem('view', v);
  $$('.rail [data-view], .mtop [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  clearInterval(S.heroTimer);
  if (!['home', 'movies', 'series'].includes(v)) setAmbient(null);
  VIEWS[v]();
}

// the background takes the colour of the artwork in focus, like a TV lighting up a dark room
let ambientUrl = null;
function setAmbient(url) {
  if (url === ambientUrl) return; ambientUrl = url;
  const box = $('#ambient');
  $$('i', box).forEach(i => { i.classList.remove('on'); setTimeout(() => i.remove(), 1300); });
  if (!url) return;
  const i = document.createElement('i'); i.setAttribute('style', bgStyle(url).replace(/&quot;/g, '"')); box.appendChild(i);
  requestAnimationFrame(() => requestAnimationFrame(() => i.classList.add('on')));
}

// render a long list in chunks as the user scrolls
function chunked(container, items, render, size = 120, onChunk) {
  let i = 0; const sentinel = document.createElement('div'); sentinel.style.height = '1px';
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) more(); }, { root: container.closest('.list, .grid-wrap, .view-pad, .view-scroll') || null, rootMargin: '600px' });
  function more() {
    const slice = items.slice(i, i + size); if (!slice.length) return;
    const frag = document.createDocumentFragment(); const els = [];
    for (const it of slice) { const el = render(it); frag.appendChild(el); els.push(el); }
    container.insertBefore(frag, sentinel.parentNode === container ? sentinel : null);
    i += slice.length; if (onChunk) onChunk(els, slice);
    if (i >= items.length) { io.disconnect(); sentinel.remove(); }
  }
  container.appendChild(sentinel); more(); if (i < items.length) io.observe(sentinel);
}
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// ------------------------------------------------------------------ EPG
async function ensureEpg(ids) {
  const need = [...new Set(ids.filter(id => id && !S.epgT.has(id)))];
  for (let i = 0; i < need.length; i += 400) {
    const chunk = need.slice(i, i + 400); chunk.forEach(id => S.epgT.set(id, Date.now()));
    try {
      const r = await post('/api/epg', { ids: chunk, from: nowS() - 26 * 3600, to: nowS() + 40 * 3600 });
      S.epgState = r.state;
      for (const id of chunk) S.epg.set(id, r.programmes[id] || []);
      if (r.state !== 'ready') chunk.forEach(id => S.epgT.delete(id));
    } catch { chunk.forEach(id => S.epgT.delete(id)); }
  }
}
function nowNext(epgId, t = nowS()) {
  const progs = S.epg.get(epgId) || [];
  const i = progs.findIndex(p => p[0] <= t && p[1] > t);
  if (i >= 0) return { now: progs[i], next: progs[i + 1], later: progs.slice(i + 1, i + 4) };
  const j = progs.findIndex(p => p[0] > t);
  return { now: null, next: j >= 0 ? progs[j] : null, later: j >= 0 ? progs.slice(j, j + 3) : [] };
}
const pct = p => p ? Math.min(100, Math.max(0, (nowS() - p[0]) / (p[1] - p[0]) * 100)) : 0;
async function shortEpg(ch) {
  try {
    const r = await x('get_short_epg', { stream_id: ch.id, limit: 4 });
    const l = arr(r && r.epg_listings).map(p => [Number(p.start_timestamp), Number(p.stop_timestamp), b64(p.title), b64(p.description)]).filter(p => p[0]);
    if (l.length) { S.epg.set('sid:' + ch.id, l); return l; }
  } catch { /* ignore */ }
  return [];
}
const epgKey = ch => (ch.epg && S.epg.get(ch.epg) && S.epg.get(ch.epg).length) ? ch.epg : 'sid:' + ch.id;

// ------------------------------------------------------------------ shared pieces: shelves, cards, hero
function shelf(title, opts = {}) {
  const s = el(`<section class="shelf"><div class="shelf-head"><h2>${esc(title)}</h2>${opts.sub ? `<span class="sub">${esc(opts.sub)}</span>` : ''}<span class="grow"></span>
    ${opts.more ? `<button class="more">${esc(opts.more[0])}</button>` : ''}
    <div class="shelf-nav"><button class="nonav" tabindex="-1" aria-label="Scroll left">${ic('left')}</button><button class="nonav" tabindex="-1" aria-label="Scroll right">${ic('right')}</button></div></div>
    <div class="row"></div></section>`);
  const row = $('.row', s);
  if (opts.more) $('.more', s).onclick = opts.more[1];
  const [l, r] = $$('.shelf-nav button', s);
  l.onclick = () => row.scrollBy({ left: -row.clientWidth * 0.8, behavior: 'smooth' });
  r.onclick = () => row.scrollBy({ left: row.clientWidth * 0.8, behavior: 'smooth' });
  return { el: s, row };
}
function liveCard(ch, list) {
  const b = el(`<button class="lcard" data-id="${ch.id}"><span class="lc-top"><span class="lc-num">${ch.n}</span><span class="live-dot">Live</span>${imgTag(ch.stream_icon, '', ch.name)}</span>
    <span class="lc-body"><span class="lc-title">${esc(ch.name)}</span><span class="bar"><i></i></span><span class="lc-when"><span class="lc-ch">${esc(ch.name)}</span><span class="lc-left"></span></span></span></button>`);
  b.onclick = () => { openFull(); play({ type: 'live', id: ch.id }, { list }); };
  return b;
}
function fillLiveCards(root) {
  $$('.lcard', root).forEach(c => {
    const ch = S.live.byId.get(c.dataset.id); if (!ch) return;
    const { now } = nowNext(ch.epg);
    $('.lc-title', c).textContent = now ? now[2] : ch.name;
    $('.lc-ch', c).textContent = now ? ch.name : 'No guide information';
    $('.bar i', c).style.width = pct(now) + '%'; $('.bar', c).style.visibility = now ? '' : 'hidden';
    $('.lc-left', c).textContent = now ? fmtLeft(now[1] - nowS()) : '';
  });
}
function continueCard(it) {
  const isEp = it.type === 'episode', m = String(it.name || '').match(/S(\d+)\s*E(\d+)/);
  const title = isEp ? (it.series_name || it.name) : cleanTitle(it.name);
  const kicker = isEp ? (m ? `Season ${m[1]}, episode ${m[2]}` : 'Episode') : 'Movie';
  const b = el(`<button class="ccard"><span class="cc-bg" style="${bgStyle(it.icon)}"></span>${it.icon ? `<img class="cc-art" src="${esc(it.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
    <span class="cc-body"><span class="cc-kicker">${esc(kicker)}</span><span class="cc-title">${esc(title)}</span><span class="bar"><i style="width:${it.dur ? it.pos / it.dur * 100 : 0}%"></i></span><span class="cc-left">${it.dur ? esc(fmtLeft(it.dur - it.pos)) : ''}</span></span>
    <span class="cc-play">${ic('play')}</span></button>`);
  b.onclick = () => {
    openFull();
    if (isEp) play({ type: 'episode', id: it.id, ext: it.ext, name: it.name, icon: it.icon, series_id: it.series_id, series_name: it.series_name }, { startAt: it.pos || 0 });
    else play({ type: 'movie', id: it.id, ext: it.ext, name: it.name, icon: it.icon }, { startAt: it.pos || 0 });
  };
  return b;
}
async function vodInfo(it) {
  const k = it.type + ':' + it.id; if (S.info.has(k)) return S.info.get(k);
  const p = (it.type === 'movie' ? x('get_vod_info', { vod_id: it.id }) : x('get_series_info', { series_id: it.id })).then(r => r || {}).catch(() => ({}));
  S.info.set(k, p); return p;
}
function metaHtml(it, info) {
  const year = String((info && (info.releasedate || info.releaseDate || info.release_date)) || it.year || '').slice(0, 4);
  const parts = [year && `<span>${esc(year)}</span>`, info && info.duration && `<span>${esc(fmtRuntime(info.duration))}</span>`, info && info.genre && `<span>${esc(info.genre)}</span>`,
    (info && info.rating || it.rating) && Number(info && info.rating || it.rating) > 0 && `<span class="rating">${ic('starf')}${esc(Number(info && info.rating || it.rating).toFixed(1))}</span>`];
  return parts.filter(Boolean).join('');
}
// featured artwork, rotating slowly; Play/Details act on whichever title is showing
function mountHero(box, items) {
  if (!box) return;
  if (!items.length) { box.remove(); return; }
  let i = 0, paused = false;
  box.onmouseenter = () => { paused = true; }; box.onmouseleave = () => { paused = false; };
  box.addEventListener('focusin', () => { paused = true; }); box.addEventListener('focusout', () => { paused = false; });
  const show = async (n, anim) => {
    i = (n + items.length) % items.length; const it = items[i];
    const pr = it.type === 'movie' ? progressFor('movie', it.id) : null;
    box.classList.remove('swap'); void box.offsetWidth; if (anim) box.classList.add('swap');
    box.innerHTML = `<div class="hero-bg"><i style="${bgStyle(it.icon)}"></i></div>
      <div class="hero-copy"><div class="hero-kind">${it.type === 'series' ? 'Series' : 'Movie'}</div><h1>${esc(cleanTitle(it.name))}</h1>
        <div class="meta">${metaHtml(it)}</div><p class="hplot"></p>
        <div class="row-btns"><button class="btn primary" data-a="play">${ic('play')}${it.type === 'series' ? 'Episodes' : pr ? 'Resume' : 'Play'}</button><button class="btn" data-a="info">${ic('info')}Details</button></div></div>
      ${it.icon ? `<div class="hero-art"><img src="${esc(it.icon)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : ''}
      ${items.length > 1 ? `<div class="hero-dots">${items.map((_, k) => `<button class="nonav${k === i ? ' on' : ''}" tabindex="-1" data-k="${k}" aria-label="Show title ${k + 1}"></button>`).join('')}</div>` : ''}`;
    setAmbient(it.icon);
    box.querySelector('[data-a=play]').onclick = () => {
      if (it.type === 'series') return openSeries(it);
      openFull(); play({ type: 'movie', id: it.id, ext: it.ext, name: it.name, icon: it.icon }, { startAt: pr ? pr.pos : 0 });
    };
    box.querySelector('[data-a=info]').onclick = () => openItem(it);
    $$('.hero-dots button', box).forEach(d => d.onclick = () => show(Number(d.dataset.k), true));
    const r = await vodInfo(it); const info = (r && r.info) || {};
    if (items[i] !== it || !box.isConnected) return;
    $('.meta', box).innerHTML = metaHtml(it, info);
    $('.hplot', box).textContent = info.plot || info.description || '';
  };
  show(0);
  clearInterval(S.heroTimer);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && items.length > 1)
    S.heroTimer = setInterval(() => { if (!box.isConnected) { clearInterval(S.heroTimer); return; } if (!paused && !document.hidden && P.mode !== 'full') show(i + 1, true); }, 9000);
}

// ------------------------------------------------------------------ HOME
async function renderHome() {
  const keep = $('#home') ? $('#home').scrollTop : 0;
  $('#main').innerHTML = `<div class="view-scroll" id="home"><section class="hero" id="hero"></section><div id="shelves"></div></div>`;
  const sh = $('#shelves');
  const favs = liveChannels('fav');
  const liveList = favs.length ? favs : liveChannels(pickGroup(liveGroups(), null));
  if (liveList.length) {
    const s = shelf(favs.length ? 'On now in your favorites' : 'On now', { more: ['Open Live TV', () => setView('live')] });
    liveList.slice(0, 30).forEach(ch => s.row.appendChild(liveCard(ch, liveList)));
    sh.appendChild(s.el);
    ensureEpg(liveList.slice(0, 30).map(c => c.epg)).then(() => fillLiveCards(s.row));
  }
  const cont = continueItems();
  if (cont.length) { const s = shelf('Continue watching'); cont.slice(0, 20).forEach(it => s.row.appendChild(continueCard(it))); sh.appendChild(s.el); }
  const rec = liveChannels('recent').filter(c => !favs.includes(c));
  if (rec.length) {
    const s = shelf('Recently watched channels'); rec.slice(0, 20).forEach(ch => s.row.appendChild(liveCard(ch, rec))); sh.appendChild(s.el);
    ensureEpg(rec.slice(0, 20).map(c => c.epg)).then(() => fillLiveCards(s.row));
  }
  $('#home').scrollTop = keep;
  // movies and series rows, plus the featured hero
  const rows = [];
  try {
    const mc = (await vodCats('movie')).slice(0, 2), sc = (await vodCats('series')).slice(0, 1);
    for (const c of mc) rows.push(['movie', c]); for (const c of sc) rows.push(['series', c]);
  } catch { /* movies and series are optional on Home */ }
  if (S.view !== 'home') return;
  let heroItems = [];
  for (const [kind, c] of rows) {
    const s = shelf(c.category_name, { sub: kind === 'movie' ? 'Movies' : 'Series', more: ['See all', () => { S.vodGroup[kind] = String(c.category_id); setView(kind === 'movie' ? 'movies' : 'series'); }] });
    sh.appendChild(s.el);
    vodItems(kind, String(c.category_id)).then(items => {
      if (!heroItems.length && kind === 'movie') { heroItems = items.filter(it => it.icon).slice(0, 5); }
      s.row.innerHTML = items.length ? '' : '<div class="row-empty">Nothing here yet.</div>';
      items.slice(0, 30).forEach(it => s.row.appendChild(posterTile(it)));
    }).catch(() => { s.row.innerHTML = '<div class="row-empty">Couldn\'t load this row.</div>'; });
  }
  if (rows.length) {
    const first = rows[0];
    const items = await vodItems(first[0], String(first[1].category_id)).catch(() => []);
    if (S.view === 'home') mountHero($('#hero'), items.filter(it => it.icon).slice(0, 5));
  } else $('#hero').remove();
}

// ------------------------------------------------------------------ LIVE TV
function liveGroups() {
  const hidden = new Set(S.user.hidden.live);
  const visible = S.live.cats.filter(c => !hidden.has(String(c.category_id)));
  const all = S.live.streams.filter(s => !hidden.has(String(s.category_id)));
  return [
    { id: 'fav', name: 'Favorites', n: S.user.favorites.live.length },
    { id: 'recent', name: 'Recently watched', n: S.user.recent.filter(id => S.live.byId.has(id)).length },
    { id: 'all', name: 'All channels', n: all.length },
    ...visible.map(c => ({ id: String(c.category_id), name: c.category_name, n: (S.live.byCat.get(String(c.category_id)) || []).length })),
  ];
}
function liveChannels(gid) {
  if (gid === 'fav') return S.user.favorites.live.map(f => S.live.byId.get(String(f.id))).filter(Boolean);
  if (gid === 'recent') return S.user.recent.map(id => S.live.byId.get(String(id))).filter(Boolean);
  if (gid === 'all') { const hidden = new Set(S.user.hidden.live); return S.live.streams.filter(s => !hidden.has(String(s.category_id))); }
  return S.live.byCat.get(gid) || [];
}
function pickGroup(groups, cur) {
  if (cur && groups.some(g => g.id === cur)) return cur;
  if (S.user.favorites.live.length) return 'fav';
  return (groups.find(g => !['fav', 'recent', 'all'].includes(g.id) && g.n) || groups[2]).id;
}
const PV_EMPTY = '<div class="pv-empty"><div><b>Pick a channel</b>It plays here. Select it again for full screen.</div></div>';

function renderLive() {
  const groups = liveGroups();
  S.liveGroup = pickGroup(groups, S.liveGroup);
  $('#main').innerHTML = `<div class="live">
    <div class="col groups-col"><h2>Live TV</h2><div class="list" id="glist"></div></div>
    <div class="col ch-col"><div class="chips group-chips" id="gchips"></div><div class="ch-head"><h3 id="chTitle"></h3><span id="chCount"></span></div><div class="list" id="clist"></div></div>
    <div class="col preview-col"><div class="pv-stage" id="pvStage">${PV_EMPTY}</div><div class="pv-info" id="pvInfo"></div></div>
  </div>`;
  const gl = $('#glist'), gc = $('#gchips');
  for (const g of groups) {
    const b = el(`<button class="grp${g.id === S.liveGroup ? ' active' : ''}" data-g="${esc(g.id)}"><span>${esc(g.name)}</span><span class="cnt">${g.n}</span></button>`);
    b.onclick = () => selectLiveGroup(g.id); gl.appendChild(b);
    const c = el(`<button class="chip${g.id === S.liveGroup ? ' active' : ''}" data-g="${esc(g.id)}">${esc(g.name)}<span class="cnt">${g.n}</span></button>`);
    c.onclick = () => selectLiveGroup(g.id); gc.appendChild(c);
  }
  renderChannelList();
  if (P.item && P.item.type === 'live' && P.mode === 'preview') { $('#pvStage').innerHTML = ''; $('#pvStage').appendChild(STAGE); updatePreviewInfo(); }
  requestAnimationFrame(() => { $$('#glist .active, #gchips .active').forEach(a => a.scrollIntoView({ block: 'nearest', inline: 'nearest' })); });
}
function selectLiveGroup(id) {
  S.liveGroup = id; localStorage.setItem('liveGroup', id);
  $$('#glist .grp, #gchips .chip').forEach(b => b.classList.toggle('active', b.dataset.g === id));
  renderChannelList();
}
function channelRow(ch) {
  const fav = isFav('live', ch.id), arch = Number(ch.tv_archive);
  const b = el(`<button class="ch" data-id="${ch.id}"><span class="num">${ch.n}</span><span class="logo-tile">${imgTag(ch.stream_icon, '', ch.name)}</span>
    <span class="ch-main"><span class="ch-name">${esc(ch.name)}</span><span class="ch-now"></span><span class="bar"><i></i></span></span>
    <span class="ch-side"><span class="icons">${arch ? `<span class="rw" title="Catch-up available">${ic('rewind')}</span>` : ''}${fav ? `<span class="star" title="Favorite">${ic('starf')}</span>` : ''}</span><span class="left"></span></span></button>`);
  b.onclick = () => onChannelClick(ch);
  return b;
}
function renderChannelList() {
  const list = $('#clist'); list.innerHTML = ''; list.scrollTop = 0;
  const chans = liveChannels(S.liveGroup);
  const g = liveGroups().find(x2 => x2.id === S.liveGroup);
  $('#chTitle').textContent = g ? g.name : ''; $('#chCount').textContent = chans.length === 1 ? '1 channel' : chans.length.toLocaleString() + ' channels';
  if (!chans.length) {
    list.innerHTML = `<div class="empty">${S.liveGroup === 'fav' ? '<b>No favorites yet</b>Open a channel and press the star to add it here.' : S.liveGroup === 'recent' ? '<b>Nothing watched yet</b>Channels you watch will appear here.' : 'No channels in this group.'}</div>`;
    return;
  }
  chunked(list, chans, channelRow, 150, async (els, slice) => {
    if (P.item && P.item.type === 'live') els.forEach(e => e.classList.toggle('playing', e.dataset.id === P.item.id));
    await ensureEpg(slice.map(c => c.epg)); fillNowRows(els);
  });
}
function fillNowRows(els) {
  for (const e of els) {
    const ch = S.live.byId.get(e.dataset.id); if (!ch) continue;
    const { now } = nowNext(ch.epg);
    e.querySelector('.ch-now').textContent = now ? now[2] : '';
    e.querySelector('.bar i').style.width = pct(now) + '%';
    e.querySelector('.bar').style.visibility = now ? '' : 'hidden';
    const left = e.querySelector('.left'); if (left) left.textContent = now ? fmtLeft(now[1] - nowS(), true) : '';
  }
}
async function refreshNowRows() {
  const rows = $$('#clist .ch'); if (!rows.length) return;
  await ensureEpg(rows.map(r => (S.live.byId.get(r.dataset.id) || {}).epg)); fillNowRows(rows);
}
function onChannelClick(ch) {
  const list = liveChannels(S.liveGroup);
  if (isNarrow()) { openFull(); play({ type: 'live', id: ch.id }, { list }); return; }
  if (P.item && P.item.type === 'live' && P.item.id === ch.id && P.mode === 'preview') { openFull(); return; }
  P.mode = 'preview'; const pv = $('#pvStage'); if (!pv.contains(STAGE)) { pv.innerHTML = ''; pv.appendChild(STAGE); }
  play({ type: 'live', id: ch.id }, { list });
}
function markPlayingRow() {
  $$('#clist .ch').forEach(e => e.classList.toggle('playing', !!(P.item && P.item.type === 'live' && e.dataset.id === P.item.id)));
}
async function updatePreviewInfo() {
  const box = $('#pvInfo'); if (!box) return;
  if (!(P.item && P.item.type === 'live')) { box.innerHTML = ''; return; }
  const ch = S.live.byId.get(P.item.id); if (!ch) return;
  if (!(S.epg.get(ch.epg) || []).length && !S.epg.has('sid:' + ch.id)) await shortEpg(ch);
  if (!(P.item && P.item.id === ch.id)) return;
  const { now, later } = nowNext(epgKey(ch)); const fav = isFav('live', ch.id);
  box.innerHTML = `<div class="pv-head"><span class="logo-tile">${imgTag(ch.stream_icon, '', ch.name)}</span><div class="pv-ch">${esc(ch.name)}<small>Channel ${ch.n}</small></div><span class="grow"></span>
      ${Number(ch.tv_archive) ? `<span class="tag rewind">${ic('rewind')}Catch-up</span>` : ''}</div>` +
    (now ? `<h2>${esc(now[2])}</h2><div class="when"><span>${fmtTime(now[0])} – ${fmtTime(now[1])}</span><span class="bar"><i style="width:${pct(now)}%"></i></span><span>${fmtLeft(now[1] - nowS())}</span></div>${now[3] ? `<p>${esc(now[3])}</p>` : ''}`
      : `<h2>${esc(ch.name)}</h2><div class="when">No guide information for this channel.</div>`) +
    `<div class="row-btns"><button class="btn primary" id="pvFull">${ic('expand')}Full screen</button><button class="btn${fav ? ' on' : ''}" id="pvFav">${ic(fav ? 'starf' : 'star')}${fav ? 'Favorite' : 'Add to favorites'}</button></div>` +
    (later.length ? `<div class="later"><h4>Later on ${esc(ch.name)}</h4>${later.map(p => `<div><span>${fmtTime(p[0])}</span><span>${esc(p[2])}</span></div>`).join('')}</div>` : '');
  $('#pvFull').onclick = () => openFull();
  $('#pvFav').onclick = async () => { await toggleFav('live', { id: ch.id, name: ch.name, icon: ch.stream_icon }); updatePreviewInfo(); const r = $(`#clist .ch[data-id="${ch.id}"]`); if (r) { const n = channelRow(ch); r.replaceWith(n); fillNowRows([n]); markPlayingRow(); } };
}

// ------------------------------------------------------------------ TV GUIDE
const PXM = () => (isNarrow() ? 3.4 : 5) * parseFloat(getComputedStyle(document.documentElement).fontSize) / 16; // px per minute
const CHW = () => isNarrow() ? 72 : Math.round(14.5 * parseFloat(getComputedStyle(document.documentElement).fontSize));
const SPAN_H = 6;
const GP = new WeakMap();
function renderGuide() {
  const groups = liveGroups();
  S.guideGroup = pickGroup(groups, S.guideGroup || S.liveGroup);
  if (!S.guideStart) S.guideStart = Math.floor(nowS() / 1800) * 1800 - 1800;
  $('#main').innerHTML = `<div class="guide">
    <div class="g-info" id="gInfo"></div>
    <div class="guide-bar">
      <select id="ggsel" aria-label="Channel group"></select>
      <button class="btn small" id="gEarlier">${ic('left')}Earlier</button>
      <button class="btn small" id="gNow">Now</button>
      <button class="btn small" id="gLater">Later${ic('right')}</button>
      <span class="day" id="gDay"></span>
    </div>
    <div class="grid-wrap" id="gwrap"><div class="grid" id="grid"></div></div></div>`;
  const gs = $('#ggsel');
  for (const g of groups) gs.appendChild(new Option(`${g.name} (${g.n})`, g.id, false, g.id === S.guideGroup));
  gs.onchange = () => { S.guideGroup = gs.value; localStorage.setItem('guideGroup', gs.value); drawGuide(); };
  $('#gEarlier').onclick = () => { S.guideStart = Math.max(S.guideStart - 3 * 3600, Math.floor((nowS() - 24 * 3600) / 1800) * 1800); drawGuide(); };
  $('#gLater').onclick = () => { S.guideStart = Math.min(S.guideStart + 3 * 3600, nowS() + 30 * 3600); drawGuide(); };
  $('#gNow').onclick = () => { S.guideStart = Math.floor(nowS() / 1800) * 1800 - 1800; drawGuide(); };
  const info = e => { const b = e.target.closest('.g-p, .g-ch'); const d = b && GP.get(b); if (d) showGuideInfo(d.ch, d.p); };
  $('#grid').addEventListener('focusin', info); $('#grid').addEventListener('mouseover', info);
  drawGuide();
}
function showGuideInfo(ch, p) {
  const box = $('#gInfo'); if (!box) return;
  const t = nowS(), isNow = p && p[0] <= t && p[1] > t, arch = p && p[1] <= t && Number(ch.tv_archive) && p[0] >= t - (Number(ch.tv_archive_duration) || 1) * 86400;
  box.innerHTML = `<span class="logo-tile">${imgTag(ch.stream_icon, '', ch.name)}</span><div style="min-width:0">
    <h2>${esc(p ? p[2] : ch.name)}</h2>
    <div class="meta"><span>${ch.n}  ${esc(ch.name)}</span>${p ? `<span>${fmtDay(p[0])}, ${fmtTime(p[0])} – ${fmtTime(p[1])}</span>` : ''}${isNow ? '<span class="live-dot">On now</span>' : ''}${arch ? `<span class="tag rewind">${ic('rewind')}Catch-up</span>` : ''}</div>
    ${p && p[3] ? `<p>${esc(p[3])}</p>` : !p ? '<p>No guide information for this channel.</p>' : ''}</div>`;
}
function drawGuide() {
  const grid = $('#grid'), wrap = $('#gwrap'); grid.innerHTML = ''; wrap.scrollTop = 0; wrap.scrollLeft = 0;
  const ws = S.guideStart, we = ws + SPAN_H * 3600, pxm = PXM(), chw = CHW(), W = SPAN_H * 60 * pxm;
  $('#gDay').textContent = fmtDay(ws);
  const head = el(`<div class="g-head"><div class="g-corner" style="width:${chw}px"></div><div class="g-times" style="width:${W}px"></div></div>`);
  for (let t = ws; t < we; t += 1800) head.lastChild.appendChild(el(`<span style="left:${(t - ws) / 60 * pxm}px;width:${30 * pxm}px">${fmtTime(t)}</span>`));
  grid.appendChild(head);
  const body = el(`<div style="position:relative"></div>`); grid.appendChild(body);
  body.appendChild(el(`<div class="g-now" id="gNowLine"></div>`));
  const chans = liveChannels(S.guideGroup);
  if (!chans.length) { body.appendChild(el('<div class="empty">No channels in this group.</div>')); $('#gInfo').innerHTML = ''; return; }
  let first = true;
  chunked(body, chans, ch => {
    const row = el(`<div class="g-row" data-id="${ch.id}"><button class="g-ch" style="width:${chw}px"><span class="num">${ch.n}</span><span class="logo-tile">${imgTag(ch.stream_icon, '', ch.name)}</span><span class="nm">${esc(ch.name)}</span></button><div class="g-progs" style="width:${W}px"></div></div>`);
    row.firstChild.onclick = () => { openFull(); play({ type: 'live', id: ch.id }, { list: chans }); };
    GP.set(row.firstChild, { ch, p: null });
    return row;
  }, 60, async (rows, slice) => {
    await ensureEpg(slice.map(c => c.epg));
    rows.forEach((r, i) => fillGuideRow(r, slice[i], ws, we, pxm, chans));
    placeNowLine();
    if (first) { first = false; const ch = slice[0]; const { now } = nowNext(ch.epg); showGuideInfo(ch, now); }
  });
}
function fillGuideRow(row, ch, ws, we, pxm, chans) {
  const box = row.querySelector('.g-progs'); box.innerHTML = '';
  const progs = (S.epg.get(ch.epg) || []).filter(p => p[1] > ws && p[0] < we);
  const t = nowS(), archiveFrom = Number(ch.tv_archive) ? t - (Number(ch.tv_archive_duration) || 1) * 86400 : Infinity;
  GP.set(row.firstChild, { ch, p: nowNext(ch.epg).now });
  if (!progs.length) {
    const b = el(`<button class="g-p none" style="left:0;width:${(we - ws) / 60 * pxm - 6}px"><b>${S.epgState === 'ready' || S.epgState === 'error' ? 'No guide information' : 'Loading guide…'}</b></button>`);
    b.onclick = () => { openFull(); play({ type: 'live', id: ch.id }, { list: chans }); }; GP.set(b, { ch, p: null }); box.appendChild(b); return;
  }
  for (const p of progs) {
    const s = Math.max(p[0], ws), e = Math.min(p[1], we);
    const isNow = p[0] <= t && p[1] > t, past = p[1] <= t, arch = past && p[0] >= archiveFrom;
    const b = el(`<button class="g-p${isNow ? ' now' : ''}${past ? ' past' : ''}${arch ? ' archive' : ''}" style="left:${(s - ws) / 60 * pxm + 2}px;width:${Math.max(4, (e - s) / 60 * pxm - 4)}px" title="${esc(p[2])}"><b>${arch ? ic('rewind') : ''}<span class="tt">${esc(p[2])}</span></b><small>${fmtTime(p[0])} – ${fmtTime(p[1])}</small></button>`);
    b.onclick = () => programmeClick(ch, p, chans, arch);
    GP.set(b, { ch, p });
    box.appendChild(b);
  }
}
function placeNowLine() {
  const l = $('#gNowLine'); if (!l) return;
  const x = (nowS() - S.guideStart) / 60 * PXM();
  l.style.left = (CHW() + x) + 'px'; l.style.display = x < 0 || x > SPAN_H * 60 * PXM() ? 'none' : '';
  l.dataset.t = fmtTime(nowS());
}
function programmeClick(ch, p, chans, arch) {
  const t = nowS();
  if (p[0] <= t && p[1] > t) { openFull(); play({ type: 'live', id: ch.id }, { list: chans }); return; }
  openModal(`<button class="ibtn modal-close" data-close aria-label="Close">${ic('close')}</button>
    <h2>${esc(p[2])}</h2>
    <div class="meta" style="margin-top:.6em"><span>${esc(ch.name)}</span><span>${fmtDay(p[0])}, ${fmtTime(p[0])} – ${fmtTime(p[1])}</span></div>
    ${p[3] ? `<p>${esc(p[3])}</p>` : ''}
    ${p[0] > t ? '<p class="muted">This programme hasn\'t started yet.</p>' : (!arch ? '<p class="muted">Catch-up isn\'t available for this programme.</p>' : '')}
    <div class="row-btns">${arch ? `<button class="btn primary" id="cuPlay">${ic('rewind')}Watch from the start</button>` : ''}
    <button class="btn" id="cuLive">${ic('live')}Watch ${esc(ch.name)} live</button></div>`);
  if (arch) $('#cuPlay').onclick = () => { openFull(); play({ type: 'catchup', id: ch.id, start: p[0], dur: Math.ceil((p[1] - p[0]) / 60), title: p[2] }); };
  $('#cuLive').onclick = () => { openFull(); play({ type: 'live', id: ch.id }, { list: chans }); };
}

// ------------------------------------------------------------------ MOVIES & SERIES
const K = kind => kind === 'movie'
  ? { store: S.vod, cats: 'get_vod_categories', list: 'get_vod_streams', label: 'movies' }
  : { store: S.series, cats: 'get_series_categories', list: 'get_series', label: 'series' };
const normVod = kind => s => kind === 'movie'
  ? { type: 'movie', id: String(s.stream_id), name: s.name, icon: s.stream_icon, ext: s.container_extension, rating: s.rating, year: s.year || '', cat: String(s.category_id) }
  : { type: 'series', id: String(s.series_id), name: s.name, icon: s.cover, rating: s.rating, year: String(s.releaseDate || s.release_date || s.year || '').slice(0, 4), cat: String(s.category_id) };

function continueItems() {
  return Object.entries(S.user.progress).sort((a, b) => (b[1].t || 0) - (a[1].t || 0)).map(([k, v]) => {
    const [type, id] = k.split(':'); return { ...v, type, id };
  });
}
async function vodCats(kind) {
  const k = K(kind); if (!k.store.cats) k.store.cats = arr(await x(k.cats));
  const hidden = new Set(S.user.hidden[kind]);
  return k.store.cats.filter(c => !hidden.has(String(c.category_id)));
}
async function vodItems(kind, gid) {
  if (gid === 'fav') return S.user.favorites[kind].map(f => ({ ...f, type: kind }));
  if (gid === 'continue') return continueItems().filter(c => kind === 'movie' ? c.type === 'movie' : c.type === 'episode');
  const st = K(kind).store;
  if (!st.byCat.has(gid)) st.byCat.set(gid, arr(await x(K(kind).list, { category_id: gid })).map(normVod(kind)));
  return st.byCat.get(gid);
}
async function renderVod(kind) {
  const k = K(kind), label = kind === 'movie' ? 'Movies' : 'Series';
  $('#main').innerHTML = `<div class="view-scroll vod" id="vscroll"><div class="vod-top"><h1>${label}</h1></div><div class="chips" id="vchips"></div><div id="vlist"><div class="loading">Loading ${k.label}…</div></div></div>`;
  let cats;
  try { cats = await vodCats(kind); }
  catch (e) { $('#vlist').innerHTML = `<div class="empty"><b>Couldn't load ${k.label}</b>${esc(e.message)}</div>`; return; }
  if (S.view !== (kind === 'movie' ? 'movies' : 'series')) return;
  const cont = await vodItems(kind, 'continue');
  const groups = [
    { id: 'browse', name: 'Browse' },
    ...(cont.length ? [{ id: 'continue', name: 'Continue watching' }] : []),
    { id: 'fav', name: 'Favorites' },
    ...cats.map(c => ({ id: String(c.category_id), name: c.category_name })),
  ];
  let cur = S.vodGroup[kind];
  if (!groups.some(g => g.id === cur)) cur = 'browse';
  const gc = $('#vchips');
  for (const g of groups) {
    const b = el(`<button class="chip${g.id === cur ? ' active' : ''}" data-g="${esc(g.id)}">${esc(g.name)}</button>`);
    b.onclick = () => sel(g.id); gc.appendChild(b);
  }
  function sel(id) {
    cur = id; S.vodGroup[kind] = id; localStorage.setItem(kind + 'Group', id);
    $$('#vchips .chip').forEach(b => b.classList.toggle('active', b.dataset.g === id));
    const a = $(`#vchips .chip[data-g="${CSS.escape(id)}"]`); if (a) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    $('#vscroll').scrollTop = 0;
    showVodGroup(kind, id);
  }
  S.vodSel = sel;
  showVodGroup(kind, cur);
  requestAnimationFrame(() => { const a = $('#vchips .active'); if (a) a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
}
async function showVodGroup(kind, gid) {
  const box = $('#vlist'); if (!box) return;
  clearInterval(S.heroTimer);
  if (gid === 'browse') return showBrowse(kind, box);
  setAmbient(null);
  box.innerHTML = '<div class="loading">Loading…</div>';
  let items;
  try { items = await vodItems(kind, gid); }
  catch (e) { box.innerHTML = `<div class="empty"><b>Couldn't load this category</b>${esc(e.message)}</div>`; return; }
  if (!box.isConnected) return;
  box.innerHTML = '';
  if (!items.length) { box.innerHTML = `<div class="empty">${gid === 'fav' ? '<b>No favorites yet</b>Open a title and press Add to favorites.' : gid === 'continue' ? '<b>Nothing in progress</b>Movies and episodes you start will appear here.' : 'Nothing in this category.'}</div>`; return; }
  const grid = el('<div class="posters"></div>'); box.appendChild(grid);
  chunked(grid, items, posterTile, 120);
}
async function showBrowse(kind, box) {
  box.innerHTML = '<section class="hero" id="vhero"></section><div id="vrows"></div>';
  const rows = $('#vrows'), cats = await vodCats(kind).catch(() => []);
  const cont = await vodItems(kind, 'continue');
  if (cont.length) { const s = shelf('Continue watching'); cont.slice(0, 20).forEach(it => s.row.appendChild(continueCard(it))); rows.appendChild(s.el); }
  const favs = await vodItems(kind, 'fav');
  if (favs.length) { const s = shelf('Your favorites'); favs.slice(0, 30).forEach(it => s.row.appendChild(posterTile(it))); rows.appendChild(s.el); }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); e.target._load(); } }), { root: $('#vscroll'), rootMargin: '500px' });
  cats.forEach(c => {
    const id = String(c.category_id);
    const s = shelf(c.category_name, { more: ['See all', () => S.vodSel && S.vodSel(id)] });
    s.row.innerHTML = '<div class="row-empty">Loading…</div>';
    s.el._load = () => vodItems(kind, id).then(items => {
      s.row.innerHTML = items.length ? '' : '<div class="row-empty">Nothing in this category.</div>';
      items.slice(0, 30).forEach(it => s.row.appendChild(posterTile(it)));
    }).catch(() => { s.row.innerHTML = '<div class="row-empty">Couldn\'t load this row.</div>'; });
    rows.appendChild(s.el); io.observe(s.el);
  });
  if (cats.length) {
    const items = await vodItems(kind, String(cats[0].category_id)).catch(() => []);
    if ($('#vhero')) mountHero($('#vhero'), items.filter(it => it.icon).slice(0, 5));
  } else { const h = $('#vhero'); if (h) h.remove(); }
}
function progressFor(type, id) { return S.user.progress[(type === 'movie' ? 'movie:' : 'episode:') + id]; }
function posterTile(it) {
  const pr = (it.type === 'movie' || it.type === 'episode') ? progressFor(it.type, it.id) : null;
  const fav = (it.type === 'movie' || it.type === 'series') && isFav(it.type, it.id);
  const title = it.type === 'episode' ? (it.series_name || it.name) : cleanTitle(it.name);
  const sub = it.type === 'episode' ? ((String(it.name).match(/S\d+\s*E\d+/) || [''])[0]) : (it.year || (String(it.name).match(/\((\d{4})\)\s*$/) || [])[1] || '');
  const b = el(`<button class="poster"><span class="art">${it.icon ? `<img src="${esc(it.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span class="ph">${it.icon ? '' : esc(title)}</span>
    ${fav ? `<span class="fav">${ic('starf')}</span>` : ''}${pr && pr.dur ? `<span class="bar"><i style="width:${pr.pos / pr.dur * 100}%"></i></span>` : ''}</span>
    <span class="t">${esc(title)}</span>${sub ? `<span class="y">${esc(sub)}</span>` : ''}</button>`);
  b.onclick = () => openItem(it);
  b.addEventListener('focus', () => { if (S.view === 'movies' || S.view === 'series') setAmbient(it.icon); });
  return b;
}
function openItem(it) {
  if (it.type === 'movie') return openMovie(it);
  if (it.type === 'series') return openSeries(it);
  if (it.type === 'episode') {
    const pr = progressFor('episode', it.id);
    openFull(); play({ type: 'episode', id: it.id, ext: it.ext, name: it.name, icon: it.icon, series_id: it.series_id, series_name: it.series_name }, { startAt: pr ? pr.pos : 0 });
  }
}

// ---- modal and full-screen detail pages
function openModal(html, kind) {
  const m = $('#modal'), c = $('#modalCard'); c.innerHTML = html; m.className = 'modal' + (kind ? ' ' + kind : ''); c.scrollTop = 0;
  pushLayer('modal', () => { m.className = 'modal hidden'; c.innerHTML = ''; });
  $$('[data-close]', c).forEach(b => b.onclick = () => popLayer());
  if (!touchUI()) setTimeout(() => { const f = $('.btn.primary', c) || $('.btn', c) || $('button', c); if (f) f.focus({ preventScroll: true }); }, 30);
}
$('#modal').onclick = e => { if (e.target.id === 'modal') popLayer(); };
function detailShell(it, kindLabel, ids) {
  return `<div class="dp-bg"><i style="${bgStyle(it.icon)}"></i></div><button class="ibtn modal-close" data-close aria-label="Back">${ic('back')}</button>
    <div class="dp"><div class="dp-body"><div class="hero-kind">${kindLabel}</div><h1>${esc(cleanTitle(it.name))}</h1><div class="meta" id="${ids}Meta">${metaHtml(it)}</div>
      <p id="${ids}Plot" class="muted">Loading details…</p><div class="row-btns" id="${ids}Btns"></div></div>
      ${it.icon ? `<img class="dp-poster" src="${esc(it.icon)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : '<span></span>'}</div>`;
}
async function openMovie(it) {
  openModal(detailShell(it, 'Movie', 'm'), 'page');
  const card = $('#modalCard');
  const draw = () => {
    const pr = progressFor('movie', it.id), btns = $('#mBtns', card); if (!btns) return;
    const fav = isFav('movie', it.id);
    btns.innerHTML = (pr ? `<button class="btn primary" data-a="resume">${ic('play')}Resume from ${fmtDur(pr.pos)}</button><button class="btn" data-a="start">${ic('refresh')}Start over</button>` : `<button class="btn primary" data-a="start">${ic('play')}Play</button>`) +
      `<button class="btn${fav ? ' on' : ''}" data-a="fav">${ic(fav ? 'starf' : 'star')}${fav ? 'Favorite' : 'Add to favorites'}</button>`;
    btns.onclick = async e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'fav') { await toggleFav('movie', { id: it.id, name: it.name, icon: it.icon, ext: it.ext }); draw(); $('[data-a=fav]', btns).focus(); return; }
      openFull(); play({ type: 'movie', id: it.id, ext: it.ext, name: it.name, icon: it.icon }, { startAt: a.dataset.a === 'resume' ? pr.pos : 0 });
    };
  };
  draw();
  const r = await vodInfo(it); const info = (r && r.info) || {}, md = (r && r.movie_data) || {};
  if (md.container_extension) it.ext = md.container_extension;
  if (!$('#mMeta', card)) return;
  $('#mMeta', card).innerHTML = metaHtml(it, info);
  $('#mPlot', card).textContent = info.plot || info.description || ''; $('#mPlot', card).classList.remove('muted');
  if (info.cast) $('#mPlot', card).insertAdjacentHTML('afterend', `<p class="cast">With ${esc(info.cast)}</p>`);
}

async function openSeries(it) {
  openModal(detailShell(it, 'Series', 's') + '<div class="dp-section"><div class="seasons" id="seasons"></div><div class="eps" id="eps"></div></div>', 'page');
  const card = $('#modalCard');
  const favBtn = () => { const b = $('#sFav', card); if (!b) return; const f = isFav('series', it.id); b.className = 'btn' + (f ? ' on' : ''); b.innerHTML = ic(f ? 'starf' : 'star') + (f ? 'Favorite' : 'Add to favorites'); };
  $('#sBtns', card).innerHTML = '<button class="btn" id="sFav"></button>';
  favBtn(); $('#sFav', card).onclick = async () => { await toggleFav('series', { id: it.id, name: it.name, icon: it.icon }); favBtn(); };
  const r = await vodInfo(it);
  if (!$('#eps', card)) return;
  const info = (r && r.info) || {};
  $('#sMeta', card).innerHTML = metaHtml(it, info);
  $('#sPlot', card).textContent = info.plot || ''; $('#sPlot', card).classList.remove('muted');
  let eps = r && r.episodes; const bySeason = {};
  if (Array.isArray(eps)) eps.forEach(e => { if (Array.isArray(e)) e.forEach(x2 => (bySeason[x2.season] ||= []).push(x2)); else (bySeason[e.season] ||= []).push(e); });
  else Object.entries(eps || {}).forEach(([s, l]) => { bySeason[s] = arr(l); });
  const seasons = Object.keys(bySeason).sort((a, b) => Number(a) - Number(b));
  if (!seasons.length) { $('#eps', card).innerHTML = '<div class="empty">No episodes available.</div>'; return; }
  const items = s => bySeason[s].map(e => {
    const t = e.title && !String(e.title).includes(it.name) && !/^Episode \d+$/i.test(e.title) ? e.title : '';
    return {
      type: 'episode', id: String(e.id), ext: e.container_extension, icon: (e.info && e.info.movie_image) || it.icon,
      name: `${cleanTitle(it.name)} S${s} E${e.episode_num}${t ? ': ' + t : ''}`,
      title: t || ('Episode ' + e.episode_num), num: e.episode_num, plot: e.info && e.info.plot, dur: e.info && e.info.duration,
      series_id: it.id, series_name: cleanTitle(it.name),
    };
  });
  const last = Object.entries(S.user.progress).filter(([, v]) => String(v.series_id) === it.id).sort((a, b) => b[1].t - a[1].t)[0];
  let cur = seasons[0], resumeEp = null;
  if (last) { const eid = last[0].split(':')[1]; cur = seasons.find(s => bySeason[s].some(e => String(e.id) === eid)) || cur; resumeEp = items(cur).find(e => e.id === eid); }
  const startEp = resumeEp || items(seasons[0])[0], startPr = resumeEp ? progressFor('episode', resumeEp.id) : null;
  const pb = el(`<button class="btn primary">${ic('play')}${resumeEp ? `Resume S${cur} E${resumeEp.num}` : `Play S${seasons[0]} E${startEp.num}`}</button>`);
  pb.onclick = () => { openFull(); play(startEp, { list: items(resumeEp ? cur : seasons[0]), startAt: startPr ? startPr.pos : 0 }); };
  $('#sBtns', card).prepend(pb); if (!touchUI()) pb.focus({ preventScroll: true });
  const sbox = $('#seasons', card);
  if (seasons.length > 1) seasons.forEach(s => { const b = el(`<button class="chip${s === cur ? ' active' : ''}" data-s="${esc(s)}">Season ${esc(s)}</button>`); b.onclick = () => showSeason(s); sbox.appendChild(b); });
  else sbox.innerHTML = `<h3 class="sec" style="margin:0">Season ${esc(seasons[0])}</h3>`;
  function showSeason(s) {
    cur = s; $$('#seasons .chip', card).forEach(b => b.classList.toggle('active', b.dataset.s === s));
    const list = items(s), box = $('#eps', card); box.innerHTML = '';
    list.forEach(ep => {
      const pr = progressFor('episode', ep.id);
      const b = el(`<button class="ep"><span class="thumb" style="${bgStyle(ep.icon)}">${ic('play')}${pr && pr.dur ? `<span class="bar"><i style="width:${pr.pos / pr.dur * 100}%"></i></span>` : ''}</span>
        <span style="min-width:0"><span class="n">Episode ${esc(ep.num)}${ep.dur ? `<span class="d">${esc(fmtRuntime(ep.dur))}</span>` : ''}</span><div class="et">${esc(ep.title)}</div>${ep.plot ? `<div class="ed">${esc(ep.plot)}</div>` : ''}</span></button>`);
      b.onclick = () => { openFull(); play(ep, { list, startAt: pr ? pr.pos : 0 }); };
      box.appendChild(b);
    });
  }
  showSeason(cur);
}

async function toggleFav(kind, item) {
  const on = !isFav(kind, item.id);
  S.user.favorites = await post('/api/favorite', { type: kind, item, on });
  toast(on ? 'Added to favorites' : 'Removed from favorites', 1800);
  return on;
}

// ------------------------------------------------------------------ SEARCH
function renderSearch() {
  $('#main').innerHTML = `<div class="view-scroll" id="spad"><div class="search-box"><div class="search-field">${ic('search')}<input id="q" type="search" placeholder="Channels, movies and series" aria-label="Search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></div></div><div id="sres" class="search-res"></div></div>`;
  const q = $('#q'); q.value = S.lastQuery || ''; q.oninput = debounce(() => doSearch(q.value), 250);
  if (!isNarrow()) q.focus();
  doSearch(q.value);
}
async function doSearch(qs) {
  S.lastQuery = qs; const box = $('#sres'); if (!box) return;
  const terms = qs.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean);
  if (qs.trim().length < 2) { box.innerHTML = '<div class="empty"><b>Find something to watch</b>Type at least 2 letters of a channel, movie or series.</div>'; return; }
  const match = n => { const s = String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return terms.every(t => s.includes(t)); };
  const live = S.live.streams.filter(c => match(c.name)).slice(0, 60);
  box.innerHTML = `<h3 class="sec">Channels<span class="cnt">${live.length}${live.length === 60 ? '+' : ''}</span></h3><div class="res-live" id="rl"></div><h3 class="sec">Movies</h3><div id="rm"><div class="muted">Searching movies…</div></div><h3 class="sec">Series</h3><div id="rs"><div class="muted">Searching series…</div></div>`;
  const rl = $('#rl'); if (!live.length) rl.innerHTML = '<div class="muted" style="padding:0">No channels found.</div>';
  live.forEach(ch => { const r = channelRow(ch); r.onclick = () => { openFull(); play({ type: 'live', id: ch.id }, { list: live }); }; rl.appendChild(r); });
  ensureEpg(live.map(c => c.epg)).then(() => fillNowRows($$('#rl .ch')));
  for (const kind of ['movie', 'series']) {
    const st = K(kind).store, target = kind === 'movie' ? '#rm' : '#rs';
    try { if (!st.all) st.all = arr(await x(K(kind).list)).map(normVod(kind)); }
    catch { const t = $(target); if (t) t.innerHTML = '<div class="muted">Couldn\'t search ' + K(kind).label + '.</div>'; continue; }
    if (S.lastQuery !== qs) return;
    const res = st.all.filter(v => match(v.name)).slice(0, 60), t = $(target); if (!t) return;
    t.innerHTML = res.length ? '' : `<div class="muted">No ${K(kind).label} found.</div>`;
    if (res.length) { const g = el('<div class="posters"></div>'); res.forEach(it => g.appendChild(posterTile(it))); t.appendChild(g); }
  }
}

// ------------------------------------------------------------------ SETTINGS
async function renderSettings() {
  const st = S.status || {}, a = st.account || {};
  const stalker = st.provider_type === 'stalker';
  const exp = a.exp_date ? new Date(Number(a.exp_date) * 1000).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : (stalker ? 'Not reported' : 'Never');
  const fmt = localStorage.getItem('fmt') || 'auto';
  $('#main').innerHTML = `<div class="view-pad"><h1 class="page-title">Settings</h1><div class="settings">
    <div class="card"><h2>Your provider</h2><dl class="kv">
      ${stalker
        ? `<dt>Login type</dt><dd>MAC portal</dd><dt>Portal</dt><dd>${esc(st.server || '')}</dd><dt>MAC address</dt><dd><span class="mono">${esc(st.mac_hint || '…')}</span></dd>`
        : `<dt>Login type</dt><dd>Username and password</dd><dt>Server</dt><dd>${esc(st.server || '')}</dd><dt>Username</dt><dd>${esc(st.username || '')}</dd>`}
      <dt>Account</dt><dd>${a.status === 'Active' ? '<span class="ok">Active</span>' : esc(a.status || (st.account_error ? 'Unreachable' : 'Not reported'))}</dd><dt>Expires</dt><dd>${esc(exp)}</dd>
      ${a.max_connections ? `<dt>Watching now</dt><dd>${esc(a.active_cons ?? '?')} of ${esc(a.max_connections)} devices allowed</dd>` : ''}
      <dt>Channels</dt><dd>${S.live.streams.length.toLocaleString()}</dd>
      <dt>TV guide</dt><dd>${esc(epgText(st.epg))}</dd></dl>
      ${stalker ? `<div class="notice"><svg aria-hidden="true"><use href="#i-info"/></svg><p><b>One device at a time.</b> Most portals allow one active session per MAC address, so iSTB or a MAG box using the same MAC may sign HomeTV out, and the other way round.</p></div>` : ''}
      <div class="row-btns"><button class="btn small" id="sRefresh">${ic('refresh')}Refresh channels and movies</button><button class="btn small" id="sEpg">${ic('refresh')}Refresh TV guide</button><button class="btn small" id="sChange">Change provider login</button></div></div>
    <div class="card"><h2>Watch on your other devices</h2>
      <p>On any phone, tablet, computer or Fire Stick on your home Wi-Fi, open the browser and go to:</p>
      <p><code class="addr">${esc(window.DEMO ? 'http://192.168.1.20:8080' : location.origin)}</code>${window.DEMO ? '<br><small>Example address. Yours is your home computer\'s address.</small>' : ''}</p>
      <p class="muted">iPhone and iPad: tap Share, then Add to Home Screen. Android: open the ⋮ menu, then Add to Home screen. Fire Stick: open it in Silk Browser and bookmark it.</p></div>
    <div class="card"><h2>This device</h2>
      <label>Live stream format
        <select id="sFmt"><option value="auto">Automatic (recommended)</option><option value="hls">HLS (.m3u8) only</option><option value="ts">MPEG-TS (.ts) only</option></select>
        <small>Change this only if live channels won't start on this device.</small></label></div>
    <div class="card"><h2>Hide groups</h2><p class="muted" style="margin-top:0">Untick groups you never watch. This applies on every device.</p>
      <div class="row-btns" style="margin-top:.6em"><button class="btn small" data-h="live">Live TV groups</button><button class="btn small" data-h="movie">Movie categories</button><button class="btn small" data-h="series">Series categories</button></div><div id="hideBox"></div></div>
    </div>
    <p class="foot">HomeTV ${esc(st.version || '')}. Your provider login is stored only on the computer running HomeTV.${window.DEMO ? ' This prototype uses sample channels, movies and a short demo video.' : ''}</p></div>`;
  $('#sFmt').value = fmt; $('#sFmt').onchange = e => { localStorage.setItem('fmt', e.target.value); toast('Saved for this device'); };
  $('#sChange').onclick = () => showSetup(true);
  $('#sRefresh').onclick = async () => {
    toast('Refreshing…'); await post('/api/refresh', {});
    S.vod = { cats: null, byCat: new Map(), all: null }; S.series = { cats: null, byCat: new Map(), all: null }; S.info.clear();
    await loadLive(true); toast('Channel lists refreshed'); renderSettings();
  };
  $('#sEpg').onclick = async () => { await post('/api/refresh', { epg: true }); S.epg.clear(); S.epgT.clear(); toast('Downloading the TV guide. This can take a minute.', 5000); };
  $$('[data-h]').forEach(b => b.onclick = () => { $$('[data-h]').forEach(x2 => x2.classList.toggle('on', x2 === b)); showHide(b.dataset.h); });
  try { S.status = await api('/api/status?refresh=1'); } catch { /* keep old */ }
}
function epgText(e) {
  if (!e) return 'Unknown';
  return { ready: `${e.channels.toLocaleString()} channels, updated ${e.updated ? new Date(e.updated * 1000).toLocaleString([], { hour: 'numeric', minute: '2-digit', weekday: 'short' }) : ''}`,
    downloading: 'Downloading…', parsing: 'Processing…', error: 'Not available (' + e.error + ')', idle: 'Waiting…' }[e.state] || e.state;
}
async function showHide(kind) {
  const box = $('#hideBox'); box.innerHTML = '<div class="loading">Loading…</div>';
  let cats;
  try {
    cats = kind === 'live' ? S.live.cats : (K(kind).store.cats ||= arr(await x(K(kind).cats)));
  } catch (e) { box.innerHTML = `<div class="muted">${esc(e.message)}</div>`; return; }
  const hidden = new Set(S.user.hidden[kind]);
  box.innerHTML = `<div class="row-btns" style="margin-top:1em"><button class="btn small" id="hAll">Show all</button><button class="btn small" id="hNone">Hide all</button></div><div class="checks">${cats.map(c => `<label><input type="checkbox" value="${esc(c.category_id)}" ${hidden.has(String(c.category_id)) ? '' : 'checked'}> ${esc(c.category_name)}</label>`).join('')}</div>`;
  const save = debounce(async () => {
    const ids = $$('.checks input', box).filter(i => !i.checked).map(i => i.value);
    S.user.hidden = await post('/api/hidden', { type: kind, ids }); toast('Saved', 1200);
  }, 500);
  box.onchange = save;
  $('#hAll').onclick = () => { $$('.checks input', box).forEach(i => i.checked = true); save(); };
  $('#hNone').onclick = () => { $$('.checks input', box).forEach(i => i.checked = false); save(); };
}

// ------------------------------------------------------------------ PLAYER
const VIDEO = $('#video'), STAGE = $('#stage');
const P = { hls: null, ts: null, gen: 0, item: null, list: [], mode: null, retries: 0, lastSave: 0, started: false };

function useNativeHls() { return isApple && !!VIDEO.canPlayType('application/vnd.apple.mpegurl') || (!(window.Hls && Hls.isSupported()) && !!VIDEO.canPlayType('application/vnd.apple.mpegurl')); }
function liveFormats() {
  const pref = localStorage.getItem('fmt') || 'auto';
  const allowed = (S.status && S.status.account && S.status.account.allowed_output_formats) || [];
  const hlsOk = !allowed.length || allowed.includes('m3u8');
  const tsOk = !!(window.mpegts && mpegts.getFeatureList().mseLivePlayback);
  if (pref === 'hls') return ['m3u8'];
  if (pref === 'ts') return ['ts'];
  const order = hlsOk ? ['m3u8', 'ts'] : ['ts', 'm3u8'];
  return order.filter(f => f === 'm3u8' || tsOk);
}
function sourcesFor(it) {
  if (window.DEMO) return [{ url: window.DEMO_VIDEO, fmt: 'file', live: it.type === 'live' }];
  if (it.type === 'live') return liveFormats().map(f => ({ url: `/play/live/${it.id}.${f}`, fmt: f, live: true }));
  if (it.type === 'catchup') return liveFormats().map(f => ({ url: `/play/timeshift/${it.id}.${f}?start=${it.start}&dur=${it.dur}`, fmt: f, live: false }));
  if (it.type === 'movie') return [{ url: `/play/movie/${it.id}.${it.ext || 'mp4'}`, fmt: 'file' }];
  if (it.type === 'episode') return [{ url: `/play/series/${it.id}.${it.ext || 'mp4'}`, fmt: 'file' }];
  return [];
}
function destroyEngines() {
  if (P.hls) { try { P.hls.destroy(); } catch { /* */ } P.hls = null; }
  if (P.ts) { try { P.ts.pause(); P.ts.unload(); P.ts.detachMediaElement(); P.ts.destroy(); } catch { /* */ } P.ts = null; }
  VIDEO.removeAttribute('src'); try { VIDEO.load(); } catch { /* */ }
}
function stopPlayback(park) {
  saveProgress(true);
  P.gen++; destroyEngines(); P.item = null; P.started = false; hideMsg();
  if (park) { $('#stageHolder').appendChild(STAGE); P.mode = null; }
  markPlayingRow(); updatePreviewInfo();
  const pv = $('#pvStage'); if (pv && !pv.contains(STAGE) && !$('.pv-empty', pv)) pv.innerHTML = PV_EMPTY;
}
function showMsg(html, spin) { const m = $('#pmsg'); m.innerHTML = html; m.className = 'pmsg' + (spin ? ' spin' : ''); }
function hideMsg() { $('#pmsg').className = 'pmsg hidden'; $('#bigPlay').classList.add('hidden'); }

function play(item, opts = {}) {
  saveProgress(true);
  P.gen++; const gen = P.gen; destroyEngines(); hideMsg();
  VIDEO.loop = !!(window.DEMO && (item.type === 'live' || item.type === 'catchup'));
  P.item = item; P.started = false; if (opts.list) P.list = opts.list; if (!opts.retry) P.retries = 0;
  if (item.type === 'live') { const ch = S.live.byId.get(item.id); item.name = ch ? ch.name : item.name; if (!S.user.recent.includes(item.id)) S.user.recent.unshift(item.id); else { S.user.recent = [item.id, ...S.user.recent.filter(i => i !== item.id)]; } }
  if (item.type === 'catchup') { const ch = S.live.byId.get(item.id); item.name = (item.title || '') + (ch ? ` (${ch.name})` : ''); }
  markPlayingRow(); updateOsd(); updatePreviewInfo();
  const srcs = sourcesFor(item); let i = 0, lastErr = '';
  showMsg('Loading…', true);
  const next = () => {
    if (gen !== P.gen) return;
    if (i >= srcs.length) { failPlayback(lastErr, srcs, gen); return; }
    const s = srcs[i++];
    attach(s, gen, opts.startAt || 0).then(() => {
      if (gen !== P.gen) return; P.started = true; hideMsg();
      if (opts.startAt > 5 && VIDEO.currentTime > 5) toast('Resumed from ' + fmtDur(VIDEO.currentTime), 2500);
    }, err => { if (gen !== P.gen) return; lastErr = err.message || String(err); console.warn('Source failed', s.url, lastErr); destroyEngines(); next(); });
  };
  next();
}
function attach(s, gen, startAt) {
  return new Promise((resolve, reject) => {
    let done = false;
    const ok = () => { if (done) return; done = true; cleanup(); resolve(); };
    const fail = e => { if (done) { lateError(gen, e); return; } done = true; cleanup(); reject(new Error(e)); };
    const onErr = () => fail(mediaErrorText(VIDEO.error));
    const timer = setTimeout(() => fail('The stream took too long to start.'), 25000);
    const cleanup = () => { clearTimeout(timer); VIDEO.removeEventListener('loadeddata', ok); VIDEO.removeEventListener('error', onErr); };
    VIDEO.addEventListener('loadeddata', ok); VIDEO.addEventListener('error', onErr);
    const doPlay = () => { const p = VIDEO.play(); if (p && p.catch) p.catch(e => { if (e.name === 'NotAllowedError' && gen === P.gen) $('#bigPlay').classList.remove('hidden'); }); };
    if (s.fmt === 'file' || (s.fmt === 'm3u8' && useNativeHls())) {
      // resume, unless the saved point is past the end (the file changed, or the provider replaced it)
      if (startAt) VIDEO.addEventListener('loadedmetadata', () => { try { if (!isFinite(VIDEO.duration) || startAt < VIDEO.duration - 10) VIDEO.currentTime = startAt; } catch { /* */ } }, { once: true });
      VIDEO.src = s.url; doPlay();
    } else if (s.fmt === 'm3u8') {
      if (!(window.Hls && Hls.isSupported())) return fail('This browser can\'t play HLS streams.');
      const hls = new Hls({ enableWorker: true, startPosition: startAt || -1, manifestLoadingMaxRetry: 1, levelLoadingMaxRetry: 2, fragLoadingMaxRetry: 3, backBufferLength: 30 });
      P.hls = hls; let recovered = false;
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return;
        if (done && d.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) { recovered = true; hls.recoverMediaError(); return; }
        fail(hlsErrorText(d));
      });
      hls.on(Hls.Events.MANIFEST_PARSED, doPlay);
      hls.loadSource(s.url); hls.attachMedia(VIDEO);
    } else if (s.fmt === 'ts') {
      if (!(window.mpegts && mpegts.getFeatureList().mseLivePlayback)) return fail('This device can\'t play MPEG-TS streams in the browser.');
      const p = mpegts.createPlayer({ type: 'mpegts', isLive: s.live !== false, url: new URL(s.url, location.href).href },
        { enableWorker: true, liveBufferLatencyChasing: s.live !== false, lazyLoad: false, autoCleanupSourceBuffer: true, enableStashBuffer: false });
      P.ts = p;
      p.on(mpegts.Events.ERROR, (type, detail, info) => fail('Stream error: ' + (info && info.msg || detail || type)));
      p.attachMediaElement(VIDEO); p.load(); doPlay();
    }
    // errors that happen after playback started
    VIDEO.addEventListener('error', function late() { if (gen !== P.gen) { VIDEO.removeEventListener('error', late); return; } if (done) lateError(gen, mediaErrorText(VIDEO.error)); });
  });
}
function lateError(gen, msg) {
  if (gen !== P.gen || !P.item) return;
  if ((P.item.type === 'live') && P.retries < 3) {
    P.retries++; showMsg('Reconnecting…', true);
    const it = P.item; setTimeout(() => { if (P.item === it) play(it, { retry: true }); }, 1500); return;
  }
  failPlayback(msg, sourcesFor(P.item), gen);
}
function mediaErrorText(e) {
  if (!e) return 'Playback error.';
  return { 1: 'Playback was stopped.', 2: 'The connection to the stream was lost.', 3: 'This video couldn\'t be decoded on this device.', 4: 'This video format isn\'t supported on this device.' }[e.code] || 'Playback error.';
}
function hlsErrorText(d) {
  if (d.response && d.response.code) return `Your provider answered ${d.response.code}.`;
  return { manifestLoadError: 'The stream couldn\'t be opened.', manifestParsingError: 'The stream isn\'t in HLS format.', levelLoadError: 'The stream stopped responding.', fragLoadError: 'The stream stopped responding.', bufferIncompatibleCodecsError: 'This channel uses a format this device can\'t play.' }[d.details] || ('Stream error: ' + d.details);
}
async function failPlayback(msg, srcs, gen) {
  // Ask the server what went wrong (e.g. too many devices watching)
  try {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(srcs[0].url, { headers: { Range: 'bytes=0-1' }, signal: ctrl.signal });
    if (!r.ok) { const j = await r.json().catch(() => null); if (j && j.error) msg = j.error; }
    ctrl.abort();
  } catch { /* ignore */ }
  if (gen !== P.gen) return;
  const src = srcs.find(s => s.fmt !== 'm3u8') || srcs[0];
  const abs = new URL(src.url, location.href);
  const vlc = isApple ? `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(abs.href)}`
    : /Android/.test(navigator.userAgent) ? `intent://${abs.host}${abs.pathname}${abs.search}#Intent;scheme=${abs.protocol.replace(':', '')};type=video/*;end` : abs.href;
  showMsg(`<div style="font-weight:600;margin-bottom:.4em">Couldn't play this</div><div class="muted">${esc(msg || 'Unknown error')}</div>
    <div class="row-btns"><button class="btn primary" id="pmRetry">${ic('refresh')}Try again</button><a class="btn" href="${esc(vlc)}">Open in ${/Android|iPhone|iPad/.test(navigator.userAgent) || isApple ? 'VLC' : 'another player'}</a></div>`);
  $('#pmRetry').onclick = () => play(P.item);
  if (P.mode === 'full') showOsd(true);
}
$('#bigPlay').onclick = () => { $('#bigPlay').classList.add('hidden'); VIDEO.play().catch(() => { }); };

VIDEO.addEventListener('timeupdate', () => { if (Date.now() - P.lastSave > 15000) saveProgress(); });
VIDEO.addEventListener('ended', () => {
  if (!P.item) return;
  if (P.item.type === 'movie' || P.item.type === 'episode') { saveProgress(true, true); }
  if (P.item.type === 'episode') { const n = neighbour(1); if (n) { toast('Next episode'); play(n, { list: P.list }); return; } }
  if (P.item.type !== 'live' && P.mode === 'full') popLayer();
});
VIDEO.addEventListener('playing', () => { P.retries = 0; });

function saveProgress(force, finished) {
  const it = P.item; if (!it || !(it.type === 'movie' || it.type === 'episode')) return;
  const pos = VIDEO.currentTime || 0, dur = VIDEO.duration;
  if (!isFinite(dur) || !dur || (!force && pos < 15)) return;
  P.lastSave = Date.now();
  const key = (it.type === 'movie' ? 'movie:' : 'episode:') + it.id;
  const body = { key, pos: finished ? dur : pos, dur, name: it.name, icon: it.icon, ext: it.ext, series_id: it.series_id, series_name: it.series_name };
  if (finished || pos / dur > 0.95 || pos < 15) delete S.user.progress[key]; else S.user.progress[key] = { ...body, t: Date.now() / 1000 };
  post('/api/progress', body).catch(() => { });
}

// ---- full screen overlay
function openFull() {
  if (P.mode === 'full') return;
  const wasPreview = P.mode === 'preview';
  P.mode = 'full';
  $('#player').classList.remove('hidden'); $('#pstage').appendChild(STAGE);
  if (wasPreview && VIDEO.paused && P.started) VIDEO.play().catch(() => { });
  pushLayer('player', closeFull);
  const fs = $('#player'); if (!isApple && fs.requestFullscreen && !document.fullscreenElement) fs.requestFullscreen().catch(() => { });
  showOsd(); updateOsd();
}
function closeFull() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  $('#player').classList.add('hidden');
  if (S.view === 'live' && !isNarrow() && P.item && P.item.type === 'live' && $('#pvStage')) {
    P.mode = 'preview'; $('#pvStage').innerHTML = ''; $('#pvStage').appendChild(STAGE); if (VIDEO.paused) VIDEO.play().catch(() => { });
    updatePreviewInfo(); const r = $(`#clist .ch[data-id="${P.item.id}"]`); if (r) r.focus({ preventScroll: false });
  } else {
    stopPlayback(true);
    if (S.view === 'home' && !layers.length) renderHome();
  }
}
let osdTimer;
function showOsd(stay) {
  const o = $('#osd'); o.classList.remove('off'); clearTimeout(osdTimer);
  if (!stay) osdTimer = setTimeout(() => { if (!$('#pmsg').classList.contains('hidden') && !$('#pmsg').classList.contains('spin')) return; o.classList.add('off'); }, 4500);
}
['pointermove', 'pointerdown', 'touchstart'].forEach(ev => $('#player').addEventListener(ev, () => showOsd(), { passive: true }));
async function updateOsd() {
  const it = P.item; if (!it || $('#player').classList.contains('hidden')) return;
  const live = it.type === 'live', ch = live || it.type === 'catchup' ? S.live.byId.get(it.id) : null;
  $('#osdPrev').classList.toggle('hidden', !live); $('#osdNextCh').classList.toggle('hidden', !live);
  $('#osdNextEp').classList.toggle('hidden', !(it.type === 'episode' && neighbour(1)));
  const favKind = live ? 'live' : it.type === 'movie' ? 'movie' : it.type === 'episode' ? 'series' : null;
  const favId = it.type === 'episode' ? it.series_id : it.id;
  $('#osdFav').classList.toggle('hidden', !favKind);
  if (favKind) { const on = isFav(favKind, favId); $('#osdFav').innerHTML = ic(on ? 'starf' : 'star'); $('#osdFav').classList.toggle('on', on); }
  const logo = $('#osdLogo'), icon = ch ? ch.stream_icon : it.icon;
  if (icon) { logo.src = icon; logo.style.visibility = ''; } else logo.style.visibility = 'hidden';
  logo.onerror = () => { logo.style.visibility = 'hidden'; };
  if (live && ch) {
    $('#osdTitle').innerHTML = `<span class="n">${ch.n}</span>${esc(ch.name)}`;
    if (!(S.epg.get(ch.epg) || []).length && !S.epg.has('sid:' + ch.id)) { await ensureEpg([ch.epg]); if (!(S.epg.get(ch.epg) || []).length) await shortEpg(ch); }
    if (P.item !== it) return;
    const { now, next } = nowNext(epgKey(ch));
    $('#osdSub').textContent = now ? `${now[2]} ${fmtTime(now[0])} – ${fmtTime(now[1])}` : '';
    $('#osdBar').style.width = pct(now) + '%'; $('#osdBar').parentNode.style.visibility = now ? '' : 'hidden';
    $('#osdNext').textContent = next ? `Next at ${fmtTime(next[0])}: ${next[2]}` : '';
  } else {
    $('#osdTitle').textContent = it.name || ''; $('#osdBar').parentNode.style.visibility = 'hidden';
    $('#osdSub').textContent = it.type === 'catchup' ? `Catch-up from ${fmtDay(it.start)}, ${fmtTime(it.start)}` : ''; $('#osdNext').textContent = '';
  }
}
function neighbour(d) {
  const it = P.item; if (!it || !P.list || !P.list.length) return null;
  const idx = P.list.findIndex(c => String(c.id) === String(it.id)); if (idx < 0) return null;
  if (it.type === 'live') { const c = P.list[(idx + d + P.list.length) % P.list.length]; return { type: 'live', id: c.id }; }
  if (it.type === 'episode') return P.list[idx + d] || null;
  return null;
}
function zap(d) { const n = neighbour(d); if (n) { play(n); showOsd(); } }
$('#osdPrev').onclick = () => zap(-1);
$('#osdNextCh').onclick = () => zap(1);
$('#osdNextEp').onclick = () => { const n = neighbour(1); if (n) play(n, { list: P.list }); };
$('#osdClose').onclick = () => popLayer();
$('#osdFav').onclick = async () => {
  const it = P.item; if (!it) return;
  if (it.type === 'live') { const ch = S.live.byId.get(it.id); await toggleFav('live', { id: ch.id, name: ch.name, icon: ch.stream_icon }); }
  else if (it.type === 'movie') await toggleFav('movie', { id: it.id, name: it.name, icon: it.icon, ext: it.ext });
  else if (it.type === 'episode') await toggleFav('series', { id: it.series_id, name: it.series_name, icon: it.icon });
  updateOsd();
};
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && P.mode === 'full' && layers.length && layers[layers.length - 1].name === 'player' && isNarrow()) { /* keep overlay; user can close */ } });

// ------------------------------------------------------------------ remote control / keyboard
const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '');
document.addEventListener('keydown', e => {
  const k = e.key;
  const back = k === 'Escape' || k === 'GoBack' || k === 'BrowserBack' || (k === 'Backspace' && !typing(e));
  if (P.mode === 'full' && !$('#player').classList.contains('hidden')) {
    showOsd();
    const live = P.item && P.item.type === 'live';
    if (back) { e.preventDefault(); popLayer(); return; }
    if (live && (k === 'ArrowUp' || k === 'ChannelUp' || k === 'PageUp')) { e.preventDefault(); zap(-1); return; }
    if (live && (k === 'ArrowDown' || k === 'ChannelDown' || k === 'PageDown')) { e.preventDefault(); zap(1); return; }
    if (!live && (k === 'ArrowLeft' || k === 'ArrowRight') && document.activeElement === document.body) { e.preventDefault(); VIDEO.currentTime += k === 'ArrowLeft' ? -10 : 30; return; }
    if (k === ' ' || k === 'MediaPlayPause') { e.preventDefault(); VIDEO.paused ? VIDEO.play() : VIDEO.pause(); return; }
    if (!live && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); moveFocus(k, $('#player')); }
    return;
  }
  if (back) { if (layers.length) { e.preventDefault(); popLayer(); } return; }
  if (!k.startsWith('Arrow')) return;
  if (typing(e) && (k === 'ArrowLeft' || k === 'ArrowRight' || e.target.tagName === 'SELECT')) return;
  e.preventDefault();
  moveFocus(k, layers.length && layers[layers.length - 1].name === 'modal' ? $('#modal') : $('#app'));
});
function moveFocus(k, root) {
  const cands = $$('button:not([disabled]):not(.nonav), a[href], input, select', root).filter(b => { if (b.offsetParent === null) return false; const r = b.getBoundingClientRect(); return r.width && r.height; });
  const cur = document.activeElement;
  if (!cur || !root.contains(cur) || cur === document.body) { const f = cands.find(c => c.closest('.ch-col, .grid, .view-pad, .view-scroll, .modal-card')) || cands[0]; if (f) f.focus(); return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const c of cands) {
    if (c === cur) continue;
    const r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let main, cross;
    if (k === 'ArrowDown') { if (r.top < a.bottom - 4) continue; main = r.top - a.bottom; cross = Math.max(0, Math.max(r.left, a.left) - Math.min(r.right, a.right)) ? Math.abs(cx - ax) : 0; }
    else if (k === 'ArrowUp') { if (r.bottom > a.top + 4) continue; main = a.top - r.bottom; cross = Math.max(0, Math.max(r.left, a.left) - Math.min(r.right, a.right)) ? Math.abs(cx - ax) : 0; }
    else if (k === 'ArrowRight') { if (r.left < a.right - 4) continue; main = r.left - a.right; cross = Math.max(0, Math.max(r.top, a.top) - Math.min(r.bottom, a.bottom)) ? Math.abs(cy - ay) : 0; }
    else { if (r.right > a.left + 4) continue; main = a.left - r.right; cross = Math.max(0, Math.max(r.top, a.top) - Math.min(r.bottom, a.bottom)) ? Math.abs(cy - ay) : 0; }
    const score = main + cross * 3;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

boot();
