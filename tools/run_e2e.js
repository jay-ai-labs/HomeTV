// One command: start the mock provider (9001) and a throwaway copy of helper/ (8099), log in to the mock,
// run e2e_test.js, and always stop what we started and delete the copy. Never touches port 8080 or helper/data.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MOCK_PORT = 9001, HELPER_PORT = 8099;
const URL_ = `http://127.0.0.1:${HELPER_PORT}`; // 127.0.0.1, not localhost: avoids slow IPv6 fallback on Windows
const PY = process.env.HOMETV_PY || (process.platform === 'win32' ? 'py' : 'python3');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const children = [];
let tmp = null;

function stopAll() {
  for (const c of children) {
    if (c.exitCode !== null || !c.pid) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else { try { c.kill('SIGKILL'); } catch { /* gone */ } }
  }
  children.length = 0;
}
async function removeTmp() {
  if (!tmp) return;
  for (let i = 0; i < 10; i++) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); break; } catch { await sleep(300); }
  }
}
async function up(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* not yet */ }
    await sleep(250);
  }
  return false;
}
async function portFree(port) {
  try { await fetch(`http://127.0.0.1:${port}/`); return false; } catch { return true; }
}

(async () => {
  let code = 1;
  try {
    if (!fs.existsSync(path.join(__dirname, 'media', 'movie.mp4'))) {
      console.error('tools/media is missing. Make the test videos with the ffmpeg commands in tools/README.md.'); process.exit(2);
    }
    for (const port of [MOCK_PORT, HELPER_PORT]) {
      if (!(await portFree(port))) { console.error(`Port ${port} is already in use. Stop whatever is using it and try again.`); process.exit(2); }
    }
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hometv-test-'));
    const copy = path.join(tmp, 'helper');
    fs.cpSync(path.join(ROOT, 'helper'), copy, { recursive: true, filter: s => path.basename(s) !== 'data' && path.basename(s) !== '__pycache__' });
    if (process.env.HOMETV_PATCH_BACKLOG) { // diagnostic only: shows the flakes vanish when the helper accepts bursts (backend bug). Patches the COPY.
      const sf = path.join(copy, 'server.py'); fs.writeFileSync(sf, fs.readFileSync(sf, 'utf8').replace('httpd = ThreadingHTTPServer(', 'ThreadingHTTPServer.request_queue_size = 128\n    httpd = ThreadingHTTPServer('));
    }
    if (fs.existsSync(path.join(copy, 'data'))) throw new Error('helper copy must not contain data/');

    const mock = spawn(PY, [path.join(__dirname, 'mock_provider.py'), String(MOCK_PORT)], { stdio: 'ignore', windowsHide: true });
    children.push(mock);
    const helper = spawn(PY, ['server.py'], { cwd: copy, env: { ...process.env, HOMETV_PORT: String(HELPER_PORT) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    children.push(helper);
    let helperLog = '';
    helper.stdout.on('data', d => helperLog += d); helper.stderr.on('data', d => helperLog += d);

    if (!(await up(`http://127.0.0.1:${MOCK_PORT}/logo.svg`))) throw new Error('mock provider did not start');
    if (!(await up(`${URL_}/api/status`))) throw new Error('test helper did not start:\n' + helperLog.slice(-1500));

    const r = await fetch(`${URL_}/api/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: `127.0.0.1:${MOCK_PORT}`, username: 'demo', password: 'p@ss+1 23' }) });
    const body = await r.json();
    if (!body.ok) throw new Error('login to mock failed: ' + JSON.stringify(body));

    // latency probe: a stalled helper is a product problem, so measure it instead of guessing
    const probe = { n: 0, slow: [], max: 0, stop: false };
    (async () => { while (!probe.stop) { const t0 = Date.now(); try { await fetch(URL_ + '/api/status', { signal: AbortSignal.timeout(15000) }); } catch { probe.slow.push('fail@' + t0); } const d = Date.now() - t0; probe.n++; probe.max = Math.max(probe.max, d); if (d > 1000) probe.slow.push(new Date(t0).toLocaleTimeString() + ' ' + d + 'ms'); await sleep(250); } })();
    const t = spawn(process.execPath, [path.join(__dirname, 'e2e_test.js')], { stdio: 'inherit', env: { ...process.env, HOMETV_URL: URL_ } });
    code = await new Promise(res => t.on('exit', c => res(c === null ? 1 : c)));

    probe.stop = true;
    console.log(`helper /api/status probe: ${probe.n} pings, slowest ${probe.max} ms, over 1 s: ${probe.slow.length}` + (probe.slow.length ? ' (' + probe.slow.slice(0, 6).join(', ') + ')' : ''));
    if (code !== 0) console.log('--- helper log (last 30 lines) ---\n' + helperLog.split(/\r?\n/).filter(Boolean).slice(-30).join('\n').slice(-3000) + '\n---');
    const errLines = helperLog.split(/\r?\n/).filter(l => /error|traceback/i.test(l));
    const interesting = errLines.filter(l => !/BrokenPipe|ConnectionReset|Connection aborted/i.test(l));
    console.log(`helper log: ${helperLog.split(/\r?\n/).filter(Boolean).length} lines, ${interesting.length} with "error"`);
    for (const l of interesting.slice(0, 8)) console.log('  ' + l.slice(0, 200));
  } catch (e) {
    console.error('run_e2e: ' + (e && e.message || e));
    code = 2;
  } finally {
    stopAll();
    await sleep(500);
    await removeTmp();
  }
  process.exit(code);
})();
process.on('SIGINT', () => { stopAll(); process.exit(130); });
