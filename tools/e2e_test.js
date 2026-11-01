// HomeTV end-to-end suite (Playwright). Real pass/fail: prints PASS/FAIL per flow, a summary, exits 1 on any failure.
// Needs: the mock provider (tools/mock_provider.py) and a THROWAWAY helper copy. `npm run e2e` (run_e2e.js) sets both up.
// Env: HOMETV_URL (required unless the default http://127.0.0.1:8099 is right), HOMETV_SHOTS (screenshot folder).
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.env.HOMETV_URL || 'http://127.0.0.1:8099').replace(/\/+$/, '');
const SHOTS = process.env.HOMETV_SHOTS || path.join(os.tmpdir(), 'hometv-shots');
const MOCK = { server: '127.0.0.1:9001', username: 'demo', password: 'p@ss+1 23' };

// Safety: port 8080 is the household's real helper. Never test against it.
{
  let u;
  try { u = new URL(BASE); } catch { console.error('HOMETV_URL is not a valid URL: ' + BASE); process.exit(2); }
  if (u.port === '8080') { console.error('Refusing to run: port 8080 is the real helper. Use a throwaway copy on 8099 (npm run e2e).'); process.exit(2); }
}
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const errs = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
function expect(cond, msg) { if (!cond) throw new Error(msg); }
async function api(p, body) {
  const r = await fetch(BASE + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

let browser, ctx, p;
const pageOpts = { viewport: { width: 1440, height: 860 } };

async function newPage() {
  if (ctx) await ctx.close().catch(() => { });
  ctx = await browser.newContext(pageOpts);
  p = await ctx.newPage();
  watch(p, '');
}
function watch(page, tag) {
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => errs.push(tag + 'pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(tag + 'console: ' + m.text()); });
  // failed requests: the mock serves icons from its own origin, the blocked channel answers 403 and bad setup logins 400, all on purpose
  page.on('response', r => { if (r.status() >= 400 && !/\/(logo|poster)\.svg$|\/play\/live\/105\.|\/api\/setup$/.test(r.url())) errs.push(tag + 'http ' + r.status() + ' ' + r.url().replace(BASE, '')); });
}
// open the app fresh (new context = clean localStorage)
async function fresh() {
  await newPage();
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('nav button[data-view=live]');
}
// wait until the main area stops re-rendering (guide/EPG data arriving re-draws lists and drops focus)
const settle = () => p.evaluate(() => new Promise(res => {
  let t = setTimeout(done, 800); const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, 800); });
  function done() { mo.disconnect(); res(); }
  mo.observe(document.getElementById('main'), { childList: true, subtree: true, characterData: true });
  setTimeout(done, 6000);
}));
const shot = name => p.screenshot({ path: path.join(SHOTS, name + '.png') }).catch(() => { });

// playing = enough data, not paused, and the clock advanced by dv seconds since we started watching
// (live streams start at a non-zero timestamp, so an absolute currentTime proves nothing)
const waitPlaying = async (adv = 1.5, timeout = 25000) => {
  await p.evaluate(() => { window.__w = null; });
  await p.waitForFunction(a => {
    const v = document.getElementById('video');
    if (!(v.readyState >= 3 && !v.paused)) { window.__w = null; return false; }
    if (!window.__w || window.__w.src !== v.currentSrc) window.__w = { src: v.currentSrc, t: v.currentTime };
    return v.currentTime >= window.__w.t + a;
  }, adv, { timeout });
};
const vstate = () => p.evaluate(() => { const v = document.getElementById('video'); return { rs: v.readyState, t: +v.currentTime.toFixed(1), paused: v.paused, msg: document.getElementById('pmsg').innerText.trim().slice(0, 120) }; });
const nav = async v => { await p.click(`nav button[data-view=${v}]`); };
async function openLive() { await nav('live'); await p.waitForSelector('#clist .ch'); }
async function openFull(idx = 0) {
  await openLive();
  await p.click(`#clist .ch >> nth=${idx}`);
  await waitPlaying();
  await p.click(`#clist .ch >> nth=${idx}`);
  await p.waitForFunction(() => P.mode === 'full' && !document.getElementById('player').classList.contains('hidden'));
}
const playViaApp = (id) => p.evaluate(i => { openFull(); play({ type: 'live', id: i }); }, id);
async function waitEpgReady() {
  for (let i = 0; i < 60; i++) { const s = await api('/api/status'); if (s.epg && s.epg.state === 'ready') return; await sleep(500); }
  throw new Error('EPG never became ready');
}
async function ensureConfigured() {
  const s = await api('/api/status');
  if (!s.configured) { const r = await api('/api/setup', MOCK); expect(r.ok, 'setup failed: ' + JSON.stringify(r)); }
  await waitEpgReady();
}
async function resetUserData() {
  const u = await api('/api/userdata');
  for (const k of ['live', 'movie', 'series']) {
    for (const f of u.favorites[k] || []) await api('/api/favorite', { type: k, item: { id: f.id }, on: false });
    await api('/api/hidden', { type: k, ids: [] });
  }
  for (const key of Object.keys(u.progress || {})) await api('/api/progress', { key, remove: true });
}

// A test that fails is retried once (HOMETV_RETRIES). A pass on retry is reported as FLAKY, not hidden: known cause is
// the helper refusing bursts of new connections (listen backlog of 5, see the F-036 baseline notes), which makes the page
// show "Couldn't load channels" now and then. Real regressions fail both attempts.
const RETRIES = Number(process.env.HOMETV_RETRIES === undefined ? 1 : process.env.HOMETV_RETRIES);
async function test(name, fn) {
  const t0 = Date.now();
  const before = errs.length;
  let firstErr = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      await fn();
      if (firstErr) {
        errs.length = before; // errors of the failed attempt belong to the flake
        results.push({ name, ok: true, flaky: firstErr });
        console.log(`FLAKY ${name}: passed on retry (first attempt: ${firstErr})`);
      } else {
        results.push({ name, ok: true });
        console.log(`PASS  ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      }
      return;
    } catch (e) {
      const msg = (String(e.message || e).split('\n')[0] + (e.cause ? ' [' + (e.cause.code || e.cause.message) + ']' : '')).slice(0, 300);
      if (p) await shot('FAIL-' + name.replace(/\W+/g, '-') + (attempt ? '-retry' : ''));
      if (!firstErr) firstErr = msg;
      if (attempt === RETRIES) { results.push({ name, ok: false, err: msg, first: firstErr }); console.log(`FAIL  ${name}: ${msg}`); }
    }
  }
}
// Console errors we expect: the blocked channel answers 403 on purpose and the player reports it.
const EXPECTED_ERR = /MEDIA_ERR|net::ERR_ABORTED|403 \(Forbidden\)/i;

(async () => {
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  await test('helper reachable and logged in to mock', async () => { await ensureConfigured(); await resetUserData(); });

  await test('home: hero and shelves', async () => {
    await fresh();
    await p.waitForSelector('#shelves .shelf');
    await p.waitForFunction(() => (document.querySelector('#hero h1') || {}).textContent);
    const r = await p.evaluate(() => ({ hero: document.querySelector('#hero h1').textContent.trim(), shelves: [...document.querySelectorAll('.shelf-head h2')].map(h => h.textContent.trim()) }));
    expect(r.hero.length > 0, 'hero title empty');
    expect(r.shelves.length >= 1, 'no shelves');
    await shot('00-home');
  });

  await test('live: groups and channel list', async () => {
    await fresh(); await openLive();
    const groups = await p.$$eval('#glist .grp', e => e.map(x => x.innerText.replace(/\n/g, ' ')));
    expect(groups.some(g => /UK \| News/.test(g)), 'group "UK | News" missing: ' + groups.join(' / '));
    expect(groups.some(g => /UK \| Sports/.test(g)), 'group "UK | Sports" missing');
    expect(groups.some(g => /US \| Entertainment/.test(g)), 'group "US | Entertainment" missing');
    const rows = await p.$$eval('#clist .ch', e => e.map(x => x.innerText.replace(/\n/g, ' | ')));
    expect(rows.length > 0, 'no channel rows');
    expect(rows.some(r => /BBC News/.test(r)), 'BBC News not listed');
  });

  await test('live: preview plays', async () => {
    await fresh(); await openLive();
    await p.click('#clist .ch >> nth=0');
    await waitPlaying();
    expect(await p.evaluate(() => P.mode) !== 'full', 'first click should preview, not go full screen');
    await shot('01-live');
  });

  await test('player: second click goes full screen with OSD', async () => {
    await fresh(); await openFull();
    expect(await p.isVisible('#player'), 'player not visible');
    await p.waitForFunction(() => document.getElementById('osd').innerText.trim().length > 0);
    await shot('02-player');
  });

  await test('zap: arrow down changes channel and keeps playing', async () => {
    await fresh(); await openFull();
    const first = await p.evaluate(() => P.item.id);
    const title = await p.innerText('#osdTitle');
    await p.keyboard.press('ArrowDown');
    await p.waitForFunction(id => P.item && P.item.id !== id, first);
    await waitPlaying();
    const now = await p.evaluate(() => P.item.id);
    expect(now !== first, 'channel did not change');
    expect(await p.innerText('#osdTitle') !== title, 'OSD title unchanged after zap');
  });

  await test('player: Escape closes full screen', async () => {
    await fresh(); await openFull();
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => document.getElementById('player').classList.contains('hidden') && P.mode !== 'full');
    expect(!(await p.isVisible('#player')), 'player still visible');
  });

  await test('blocked channel shows a message, no crash', async () => {
    await fresh(); await openLive();
    await playViaApp('105');
    await p.waitForFunction(() => document.getElementById('pmsg').innerText.trim().length > 0, null, { timeout: 25000 });
    const s = await vstate();
    expect(s.msg.length > 0, 'no error message shown');
    expect(s.paused || s.rs < 3, 'blocked channel should not be playing');
    expect(!/undefined|\[object|Traceback/i.test(s.msg), 'ugly message: ' + s.msg);
  });

  await test('MPEG-TS live plays', async () => {
    await fresh(); await openLive();
    await p.evaluate(() => localStorage.setItem('fmt', 'ts'));
    await playViaApp('103');
    await waitPlaying(1, 30000);
    expect(await p.evaluate(() => (document.getElementById('video').currentSrc || '').length > 0), 'no media source');
  });

  await test('guide: rows, programmes, now and catch-up marks', async () => {
    await fresh(); await nav('guide'); await p.waitForSelector('.g-p');
    const g = await p.evaluate(() => ({ rows: document.querySelectorAll('.g-row').length, progs: document.querySelectorAll('.g-p').length, now: document.querySelectorAll('.g-p.now').length, arch: document.querySelectorAll('.g-p.archive').length, none: document.querySelectorAll('.g-p.none').length }));
    expect(g.rows >= 3, 'rows ' + g.rows);
    expect(g.progs > g.rows, 'programmes ' + g.progs);
    expect(g.now >= 1, 'no programme marked now');
    expect(g.arch >= 1, 'no catch-up programme');
    expect(g.none >= 1, 'no "no guide data" cells (mock has a channel without guide)');
    await shot('03-guide');
  });

  await test('catch-up: archive programme plays', async () => {
    await fresh(); await nav('guide'); await p.waitForSelector('.g-p.archive');
    await p.click('.g-p.archive >> nth=0');
    await p.waitForSelector('#cuPlay');
    await shot('04-catchup-modal');
    await p.click('#cuPlay');
    await waitPlaying(1, 30000);
    expect((await p.innerText('#osdTitle')).trim().length > 0, 'OSD title empty');
  });

  await test('movie: plays, seek works, progress saved', async () => {
    await fresh(); await nav('movies'); await p.waitForSelector('.poster');
    await shot('05-movies');
    await p.click('.poster >> nth=0');
    await p.waitForSelector('#mBtns .btn.primary');
    expect((await p.innerText('#modalCard')).includes('A movie used for testing playback'), 'detail text missing');
    await shot('06-movie-detail');
    await p.click('#mBtns .btn.primary');
    await waitPlaying();
    await p.evaluate(() => { document.getElementById('video').currentTime = 40; });
    await p.waitForFunction(() => { const v = document.getElementById('video'); return v.currentTime >= 40.5 && !v.paused && v.readyState >= 3; });
    await p.keyboard.press('Escape');
    let prog;
    for (let i = 0; i < 40; i++) {
      prog = (await api('/api/userdata')).progress || {};
      if (Object.keys(prog).some(k => k.startsWith('movie:'))) break;
      await sleep(500);
    }
    const key = Object.keys(prog).find(k => k.startsWith('movie:'));
    expect(key, 'no movie progress saved: ' + JSON.stringify(prog));
    expect(prog[key].pos >= 38 && prog[key].pos <= 60, 'saved position ' + prog[key].pos + ' (expected about 40)');
    expect(prog[key].dur >= 100, 'saved duration ' + prog[key].dur);
  });

  await test('series: episode plays and offers next episode', async () => {
    await fresh(); await nav('series'); await p.waitForSelector('.poster');
    await p.click('.poster >> nth=0'); await p.waitForSelector('.ep');
    await shot('07-series');
    expect(await p.locator('.ep').count() >= 3, 'fewer than 3 episodes listed');
    await p.click('.ep >> nth=0');
    await waitPlaying();
    expect(await p.isVisible('#osdNextEp'), 'Next episode button not shown on episode 1');
    expect((await p.innerText('#osdTitle')).trim().length > 0, 'OSD title empty');
  });

  await test('favorites: add from preview, stored on the helper', async () => {
    await fresh(); await openLive();
    await p.click('#glist .grp[data-g=all]');
    await p.waitForSelector('#clist .ch >> nth=1');
    const id = await p.getAttribute('#clist .ch >> nth=1', 'data-id');
    await p.click('#clist .ch >> nth=1');
    await p.waitForSelector('#pvFav');
    const resp = p.waitForResponse(r => r.url().includes('/api/favorite'));
    await p.click('#pvFav');
    await resp;
    const favs = (await api('/api/userdata')).favorites.live;
    expect(favs.some(f => String(f.id) === String(id)), 'favorite ' + id + ' not stored: ' + JSON.stringify(favs));
  });

  await test('search: movies/series and channels', async () => {
    await fresh(); await nav('search');
    await p.fill('#q', 'test');
    await p.waitForFunction(() => document.querySelectorAll('#sres .poster').length > 0);
    const posters = await p.locator('#sres .poster').count();
    expect(posters >= 10, 'expected the 10 Test Movies, got ' + posters);
    await p.fill('#q', 'news');
    await p.waitForFunction(() => [...document.querySelectorAll('#rl .ch-name')].some(x => /BBC News/.test(x.innerText)));
    const names = await p.$$eval('#rl .ch-name', e => e.map(x => x.innerText));
    expect(names.some(n => /Sky News/.test(n)), 'Sky News missing: ' + names.join(','));
    await shot('08-search');
  });

  await test('settings: account details', async () => {
    await fresh(); await nav('settings');
    await p.waitForSelector('.card dl.kv');
    await p.waitForFunction(() => /Active/.test(document.querySelector('.card').innerText));
    const t = await p.innerText('.card');
    expect(/demo/.test(t), 'username not shown');
    expect(/127\.0\.0\.1/.test(t), 'server not shown');
    expect(/Channels\s*30/.test(t.replace(/\n/g, ' ').replace(/\t/g, ' ')), 'channel count 30 not shown: ' + t.slice(0, 200));
    expect(!/p@ss/.test(await p.content()), 'password leaked into the page');
    await shot('09-settings');
  });

  const openSetupFromSettings = async () => {
    await fresh(); await nav('settings'); await p.waitForSelector('#sChange');
    await p.click('#sChange');
    await p.waitForSelector('#setup:not(.hidden)');
  };
  const fillXtream = async (server, user, pw) => {
    await p.fill('#setupForm [name=server]', server);
    await p.fill('#setupForm [name=username]', user);
    await p.fill('#setupForm [name=password]', pw);
  };

  await test('setup form: validation and login-type switch', async () => {
    await openSetupFromSettings();
    expect(await p.isVisible('#setupCancel'), 'Cancel should be offered when changing login');
    await p.click('#setupBtn');
    await p.waitForFunction(() => /Fill in/i.test(document.getElementById('setupError').textContent));
    await p.click('#loginType [data-type=stalker]');
    expect(await p.isVisible('#setupForm [name=portal]'), 'portal field not shown');
    expect(!(await p.isVisible('#setupForm [name=server]')), 'server field should be hidden');
    await p.fill('#setupForm [name=mac]', 'aabbccddeeff');
    expect(await p.inputValue('#setupForm [name=mac]') === 'AA:BB:CC:DD:EE:FF', 'MAC not formatted');
    await p.fill('#setupForm [name=portal]', 'http://127.0.0.1:9002/c/');
    await p.fill('#setupForm [name=mac]', '12');
    await p.click('#setupBtn');
    await p.waitForFunction(() => /MAC address/i.test(document.getElementById('macErr').textContent));
    await p.click('#loginType [data-type=xtream]');
    expect(await p.isVisible('#setupForm [name=server]'), 'server field not shown after switching back');
    await p.click('#setupCancel');
    await p.waitForSelector('#app:not(.hidden)');
  });

  await test('setup form: wrong password and unreachable server show errors', async () => {
    await openSetupFromSettings();
    await fillXtream(MOCK.server, MOCK.username, 'wrong');
    await p.click('#setupBtn');
    await p.waitForFunction(() => /rejected/i.test(document.getElementById('setupError').textContent));
    expect((await p.innerText('#setupBtn')).trim() === 'Connect', 'button not restored');
    await fillXtream('127.0.0.1:1', MOCK.username, MOCK.password);
    await p.click('#setupBtn');
    await p.waitForFunction(() => /Could not connect/i.test(document.getElementById('setupError').textContent), null, { timeout: 30000 });
    const s = await api('/api/status');
    expect(s.configured && s.server === '127.0.0.1', 'failed attempts must not replace the saved login');
  });

  await test('setup form: Xtream login with special-character password', async () => {
    await openSetupFromSettings();
    await fillXtream(MOCK.server, MOCK.username, MOCK.password);
    await p.click('#setupBtn');
    await p.waitForFunction(() => document.getElementById('setup').classList.contains('hidden') && !document.getElementById('app').classList.contains('hidden'), null, { timeout: 30000 });
    await p.waitForSelector('nav button[data-view=live]');
    const s = await api('/api/status');
    expect(s.configured && s.username === 'demo', 'status after login: ' + JSON.stringify({ c: s.configured, u: s.username }));
    expect(!JSON.stringify(s).includes('p@ss'), 'password exposed by /api/status');
    await waitEpgReady();
  });

  await test('hide groups: hidden group disappears from Live TV, then restores', async () => {
    try {
      await fresh(); await nav('settings');
      await p.waitForSelector('[data-h=live]');
      await p.click('[data-h=live]');
      await p.waitForSelector('.checks input');
      const resp = p.waitForResponse(r => r.url().includes('/api/hidden'));
      await p.locator('.checks label', { hasText: 'UK | Sports' }).locator('input').uncheck();
      await resp;
      expect(JSON.stringify((await api('/api/userdata')).hidden.live) === '["2"]', 'hidden.live = ' + JSON.stringify((await api('/api/userdata')).hidden.live));
      await p.reload(); await p.waitForSelector('nav button[data-view=live]');
      await openLive();
      const groups = await p.$$eval('#glist .grp', e => e.map(x => x.innerText));
      expect(!groups.some(g => /UK \| Sports/.test(g)), 'hidden group still listed');
      expect(groups.some(g => /UK \| News/.test(g)), 'other groups should remain');
      await p.click('#glist .grp[data-g=all]');
      await p.waitForSelector('#clist .ch');
      const names = await p.$$eval('#clist .ch-name', e => e.map(x => x.innerText));
      expect(!names.includes('Sky News'), 'channel of a hidden group still listed');
      expect(names.includes('BBC News'), 'visible channel missing');
      await nav('settings'); await p.click('[data-h=live]'); await p.waitForSelector('#hAll');
      const resp2 = p.waitForResponse(r => r.url().includes('/api/hidden'));
      await p.click('#hAll'); await resp2;
      expect(((await api('/api/userdata')).hidden.live).length === 0, 'Show all did not clear hidden groups');
    } finally {
      await api('/api/hidden', { type: 'live', ids: [] });
    }
  });

  await test('keyboard: arrows move focus between channels and groups', async () => {
    await fresh(); await openLive();
    await p.click('#glist .grp[data-g=all]');
    await p.waitForSelector('#clist .ch >> nth=3');
    await p.waitForLoadState('networkidle'); await settle();
    await p.focus('#clist .ch >> nth=0');
    const first = await p.evaluate(() => document.activeElement.dataset.id);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
    const f = await p.evaluate(() => ({ cls: document.activeElement.className, id: document.activeElement.dataset.id }));
    expect(/\bch\b/.test(f.cls) && f.id && f.id !== first, 'focus did not move down the list: ' + JSON.stringify(f));
    await p.keyboard.press('ArrowLeft');
    const l = await p.evaluate(() => document.activeElement.className);
    expect(/grp/.test(l), 'ArrowLeft should move to the group list, focus is on: ' + l);
  });

  await test('screens fit without sideways scrolling at 5 sizes', async () => {
    const sizes = [[390, 844], [844, 390], [820, 1180], [1180, 820], [1440, 900]];
    const bad = [];
    for (const [w, h] of sizes) {
      if (ctx) await ctx.close().catch(() => { });
      ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 900 });
      p = await ctx.newPage(); watch(p, '');
      await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#shelves .shelf');
      for (const v of ['home', 'live', 'guide', 'movies', 'series', 'search', 'settings']) {
        await p.evaluate(x => setView(x), v);
        await p.waitForFunction(x => S.view === x, v);
        await p.waitForTimeout(400);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 1) bad.push(`${v}@${w}x${h} overflows by ${over}px`);
        await shot(`size-${w}x${h}-${v}`);
      }
    }
    expect(bad.length === 0, bad.join('; '));
  });

  await test('phone: tap to play, back closes player, guide and movies render', async () => {
    if (ctx) await ctx.close().catch(() => { });
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p = await ctx.newPage(); watch(p, 'phone ');
    await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#shelves .shelf');
    await shot('10-phone-home');
    await p.tap('nav button[data-view=live]'); await p.waitForSelector('#clist .ch');
    await shot('10-phone-live');
    await p.tap('#clist .ch >> nth=0');
    await waitPlaying();
    await shot('11-phone-player');
    expect(await p.evaluate(() => P.mode) !== undefined, 'no player mode');
    await p.goBack();
    await p.waitForFunction(() => document.getElementById('player').classList.contains('hidden') || P.mode !== 'full');
    await p.tap('nav button[data-view=guide]'); await p.waitForSelector('.g-p');
    await shot('12-phone-guide');
    await p.tap('nav button[data-view=movies]'); await p.waitForSelector('.poster');
    await shot('13-phone-movies');
  });

  await test('no page errors or unexpected console errors', async () => {
    // a 403 on the blocked channel is expected; everything else (page errors, other failed requests) is not
    const bad = errs.filter(e => !EXPECTED_ERR.test(e));
    expect(bad.length === 0, bad.length + ' error(s): ' + bad.slice(0, 3).join(' || ').slice(0, 400));
  });

  await browser.close();

  const failed = results.filter(r => !r.ok), flaky = results.filter(r => r.flaky);
  console.log(`\nSUMMARY: ${results.length - failed.length} passed (${flaky.length} only on retry), ${failed.length} failed, ${results.length} total. Screenshots: ${SHOTS}`);
  for (const f of flaky) console.log(`  FLAKY: ${f.name} -- ${f.flaky}`);
  for (const f of failed) console.log(`  FAILED: ${f.name} -- ${f.err}`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('Test run crashed: ' + (e && e.stack || e)); process.exit(2); });
