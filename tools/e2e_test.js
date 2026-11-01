const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = process.env.HOMETV_URL || 'http://localhost:8080';
require('fs').mkdirSync('/tmp/shots', { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const vstate = () => p.evaluate(() => { const v = document.getElementById('video'); return { rs: v.readyState, t: +v.currentTime.toFixed(1), paused: v.paused, err: v.error && v.error.code, msg: document.getElementById('pmsg').innerText.trim().slice(0,120) }; });
  const R = {};
  await p.goto(BASE + '/'); await p.evaluate(() => localStorage.clear()); await p.goto(BASE + '/');
  // home screen: hero and shelves
  await p.waitForSelector('#shelves .shelf'); await sleep(1500);
  R.home = await p.evaluate(() => ({ hero: (document.querySelector('#hero h1') || {}).textContent, shelves: [...document.querySelectorAll('.shelf-head h2')].map(h => h.textContent) }));
  await p.screenshot({ path: '/tmp/shots/00-home.png' });
  await p.click('nav button[data-view=live]'); await p.waitForSelector('#clist .ch'); await sleep(800);
  R.groups = await p.$$eval('#glist .grp', e => e.map(x => x.innerText.replace(/\n/g,' ')).slice(0,6));
  R.firstRows = await p.$$eval('#clist .ch', e => e.slice(0,3).map(x => x.innerText.replace(/\n/g,' | ')));
  await p.click('#clist .ch >> nth=0'); await sleep(5000); R.preview = await vstate();
  await p.screenshot({ path: '/tmp/shots/01-live.png' });
  await p.click('#clist .ch >> nth=0'); await sleep(1500); R.fullVisible = await p.isVisible('#player');
  R.osd = await p.innerText('#osd'); await p.screenshot({ path: '/tmp/shots/02-player.png' });
  await p.keyboard.press('ArrowDown'); await sleep(4500); R.zap = { title: await p.innerText('#osdTitle'), ...(await vstate()) };
  await p.keyboard.press('Escape'); await sleep(800); R.afterEsc = { player: await p.isVisible('#player'), mode: await p.evaluate(() => P.mode) };
  // blocked channel
  await p.evaluate(() => { const ch = S.live.byId.get('105'); openFull(); play({type:'live', id:'105'}); }); await sleep(6000); R.blocked = await vstate();
  await p.keyboard.press('Escape'); await sleep(500);
  // TS path
  await p.evaluate(() => localStorage.setItem('fmt','ts'));
  await p.evaluate(() => { openFull(); play({type:'live', id:'103'}); }); await sleep(6000); R.ts = await vstate();
  await p.keyboard.press('Escape'); await p.evaluate(() => localStorage.setItem('fmt','auto')); await sleep(500);
  // guide
  await p.click('nav button[data-view=guide]'); await p.waitForSelector('.g-p'); await sleep(800);
  R.guide = await p.evaluate(() => ({ rows: document.querySelectorAll('.g-row').length, progs: document.querySelectorAll('.g-p').length, now: document.querySelectorAll('.g-p.now').length, arch: document.querySelectorAll('.g-p.archive').length, none: document.querySelectorAll('.g-p.none').length }));
  await p.screenshot({ path: '/tmp/shots/03-guide.png' });
  await p.click('.g-p.archive >> nth=0'); await sleep(500); await p.screenshot({ path: '/tmp/shots/04-catchup-modal.png' });
  await p.click('#cuPlay'); await sleep(5000); R.catchup = { osd: await p.innerText('#osdTitle'), ...(await vstate()) };
  await p.keyboard.press('Escape'); await sleep(300); await p.keyboard.press('Escape'); await sleep(300);
  // movies
  await p.click('nav button[data-view=movies]'); await p.waitForSelector('.poster'); await sleep(500);
  await p.screenshot({ path: '/tmp/shots/05-movies.png' });
  await p.click('.poster >> nth=0'); await sleep(1200); await p.screenshot({ path: '/tmp/shots/06-movie-detail.png' });
  R.movieDetail = await p.innerText('#modalCard');
  await p.click('#mBtns .btn.primary'); await sleep(3000);
  await p.evaluate(() => { document.getElementById('video').currentTime = 40; }); await sleep(2500); R.movie = await vstate();
  await p.keyboard.press('Escape'); await sleep(800); await p.keyboard.press('Escape'); await sleep(500);
  R.progress = await (await p.request.get(BASE + '/api/userdata')).json().then(u => u.progress);
  // series
  await p.click('nav button[data-view=series]'); await p.waitForSelector('.poster'); await p.click('.poster >> nth=0'); await p.waitForSelector('.ep'); await sleep(400);
  await p.screenshot({ path: '/tmp/shots/07-series.png' });
  await p.click('.ep >> nth=0'); await sleep(3500); R.episode = { osd: await p.innerText('#osdTitle'), next: await p.isVisible('#osdNextEp'), ...(await vstate()) };
  await p.keyboard.press('Escape'); await sleep(300); await p.keyboard.press('Escape');
  // favorites via preview
  await p.click('nav button[data-view=live]'); await p.click('#glist .grp[data-g=all]'); await p.waitForSelector('#clist .ch >> nth=1'); await p.click('#clist .ch >> nth=1'); await sleep(2500);
  await p.click('#pvFav'); await sleep(600); R.favs = await (await p.request.get(BASE + '/api/userdata')).json().then(u => u.favorites.live);
  // search
  await p.click('nav button[data-view=search]'); await p.fill('#q', 'test'); await sleep(1500);
  R.search = await p.evaluate(() => ({ ch: document.querySelectorAll('#rl .ch').length, posters: document.querySelectorAll('#sres .poster').length }));
  await p.fill('#q', 'news'); await sleep(1200); R.searchNews = await p.$$eval('#rl .ch-name', e => e.map(x => x.innerText));
  await p.screenshot({ path: '/tmp/shots/08-search.png' });
  await p.click('nav button[data-view=settings]'); await sleep(1500); await p.screenshot({ path: '/tmp/shots/09-settings.png', fullPage: true });
  R.settings = (await p.innerText('.card')).slice(0, 300);
  // keyboard nav
  await p.click('nav button[data-view=live]'); await p.waitForSelector('#clist .ch'); await p.focus('#clist .ch >> nth=0');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  R.kbFocus = await p.evaluate(() => document.activeElement.className + ' ' + (document.activeElement.dataset.id||''));
  await p.keyboard.press('ArrowLeft'); R.kbLeft = await p.evaluate(() => document.activeElement.className);
  // phone
  const ph = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const q = await ph.newPage(); q.on('pageerror', e => errs.push('phone pageerror: ' + e.message));
  await q.goto(BASE + '/'); await q.waitForSelector('#shelves .shelf'); await sleep(800); await q.screenshot({ path: '/tmp/shots/10-phone-home.png' });
  await q.tap('nav button[data-view=live]'); await q.waitForSelector('#clist .ch'); await sleep(800);
  await q.screenshot({ path: '/tmp/shots/10-phone-live.png' });
  await q.tap('#clist .ch >> nth=0'); await sleep(4000); await q.screenshot({ path: '/tmp/shots/11-phone-player.png' });
  R.phonePlay = await q.evaluate(() => ({ mode: P.mode, t: document.getElementById('video').currentTime }));
  await q.goBack(); await sleep(500); R.phoneBack = await q.evaluate(() => ({ mode: P.mode, hidden: document.getElementById('player').classList.contains('hidden') }));
  await q.click('nav button[data-view=guide]'); await q.waitForSelector('.g-p'); await sleep(600); await q.screenshot({ path: '/tmp/shots/12-phone-guide.png' });
  await q.click('nav button[data-view=movies]'); await q.waitForSelector('.poster'); await sleep(600); await q.screenshot({ path: '/tmp/shots/13-phone-movies.png' });
  console.log(JSON.stringify(R, null, 1)); console.log('ERRORS', errs);
  await b.close();
})();
