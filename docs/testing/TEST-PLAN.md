# Test plan

Owner: qa agent · Last updated: 2026-11-01

## Layers

| Layer | What | Where | When |
| --- | --- | --- | --- |
| Unit (helper) | provider URL building, playlist rewrite, token map, time-zone conversion, store migrations, EPG parsing | `helper/tests/` (`py -m unittest`), arrives with F-032 | Every helper change |
| End-to-end | Every screen and flow in a real browser against the mock provider | `tools/e2e_test.js` (Playwright) | Every change (`/test`) |
| Visual | Screenshots at iPhone portrait/landscape, iPad portrait/landscape, desktop, TV | e2e writes to the screenshot folder | Every UI change |
| Device checklist | Real devices on the home network | below | Before each release |
| Real provider | Owner-only smoke test | below | Before each release; after provider changes |

## Running the automated tests (Windows)

```bat
:: once: Playwright, plus test media (ffmpeg commands in tools\README.md)
cd tools
npm install
npx playwright install chromium

:: every time: one command
npm run e2e
```

`npm run e2e` (`tools/run_e2e.js`) starts the mock provider on 9001, copies `helper/` without `data/` to a temp folder and starts it on 8099, logs it in to the mock through `POST /api/setup`, runs `tools/e2e_test.js`, prints PASS/FAIL per flow and a summary, and always stops both servers and deletes the copy. Exit code 0 = all passed, 1 = a test failed, 2 = setup problem (port in use, media missing).

- A failed test is retried once. A pass on retry prints `FLAKY` and is counted in the summary line, so flakes stay visible. `HOMETV_RETRIES=0` turns retries off.
- Screenshots go to `%TEMP%\hometv-shots` (or `HOMETV_SHOTS`). Failures add `FAIL-<name>.png`.
- To run against a helper you started yourself: `set HOMETV_URL=http://127.0.0.1:8099 && node e2e_test.js`. It logs the helper in to the mock if needed, and refuses to run on port 8080.
- `HOMETV_PY` picks the Python launcher (default `py` on Windows).

Never run tests against the real helper on port 8080: logging it in to the mock would replace the household's provider login.
F-032 adds a `HOMETV_DATA_DIR` setting so a copy is no longer needed.

`/test` in Claude Code does the same.

### Baseline (2026-11-01, helper before F-036)

24 e2e checks; all pass on a quiet machine. Known flake source (backend bug, see below): the helper sometimes refuses or stalls new connections, so the page shows "Couldn't load channels" and a test passes only on retry.

| Open helper issue | Evidence | Owner |
| --- | --- | --- |
| `ThreadingHTTPServer` keeps the default listen backlog of 5. A burst of 30 parallel new connections gets `ECONNREFUSED` about 37% of the time (1112 of 3000) on Windows; with `request_queue_size = 128` there were 0 of 3000. A browser loading the app opens many connections at once. Fix: set `ThreadingHTTPServer.request_queue_size = 128` | burst test in the qa notes, run 2026-11-01 | backend |
| Even with the larger backlog, an occasional 10 s stall of `GET /api/status` was seen during e2e (1 run in 3). Cause not found; may be the machine (other heavy Chrome processes were running). `run_e2e.js` prints a latency probe line so it can be tracked | `helper /api/status probe:` line | backend, to investigate |
| The mock serves icons at `/logo.svg` and `/poster.svg` as relative paths, so the browser asks the helper for them and gets 404. Real providers send absolute URLs. The e2e ignores these two 404s | `http 404 /poster.svg` | backend (mock) |

The mock covers: 30 channels in 3 groups, guide data with gaps, catch-up channels, a channel that returns 403, HLS with redirect + relative segments + query tokens, MPEG-TS, movies with range requests, series with seasons, a password with `@`, `+` and a space, and a provider clock 1 h ahead of UTC.
**Stalker mock (F-036, not built yet):** `tools/mock_stalker.py` on port 9002 (MAC `00:1A:79:12:34:56`; one MAC deliberately unregistered). It checks the MAC cookie and Bearer token, expires tokens to test renewal, paginates VOD 14 per page, marks archive programmes, and issues single-use `create_link` URLs. The full e2e suite runs against **both** mocks.

**Rule:** every bug found on the real provider gets reproduced in the mock before it's fixed.

## Coverage map

| Feature | e2e case | Unit | Device checklist |
| --- | --- | --- | --- |
Names are the test titles printed by `e2e_test.js`.

| Feature | e2e case | Unit | Device checklist |
| --- | --- | --- | --- |
| F-001 login/account | helper reachable and logged in; settings: account details; setup form: validation and login-type switch; setup form: wrong password and unreachable server; setup form: Xtream login with special-character password | config (F-032) | ✓ |
| F-002/F-003 live + preview | live: groups and channel list; live: preview plays | | ✓ |
| F-004 player, zapping | player: second click goes full screen; zap: arrow down; player: Escape closes full screen | | ✓ |
| F-005 guide | guide: rows, programmes, now and catch-up marks | epg (F-032) | ✓ |
| F-006 catch-up | catch-up: archive programme plays | timeshift tz (F-032) | ✓ |
| F-007/F-008 movies, series | movie: plays, seek works, progress saved; series: episode plays and offers next episode | | ✓ |
| F-009 continue watching | movie: ... progress saved (checks `/api/userdata` progress) | store (F-032) | ✓ |
| F-010/F-011 favorites, hidden | favorites: add from preview; hide groups: hidden group disappears, then restores | store (F-032) | ✓ |
| F-012 search | search: movies/series and channels | | |
| F-013 fallback, errors | blocked channel shows a message; MPEG-TS live plays | relay (F-032) | ✓ |
| F-014 remote/keyboard | keyboard: arrows move focus | | Fire TV |
| F-015–F-017 home, layouts, install | home: hero and shelves; screens fit without sideways scrolling at 5 sizes (390x844, 844x390, 820x1180, 1180x820, 1440x900, 7 screens each, screenshots saved); phone: tap to play, back closes player | | iPhone, iPad |
| All | no page errors or unexpected console errors or failed requests | | |

Not yet covered: Stalker setup against a mock (F-036), movie/series category hiding, Next episode click-through, EPG gap rendering details, PWA install.

## Device checklist (each release)

On iPhone, iPad, Android phone, Android tablet, Fire tablet and Fire TV (Silk):

- [ ] Open from the Home Screen icon (or Silk bookmark); first screen in under 2 s
- [ ] Start a favorite live channel; zap 5 channels
- [ ] Open the guide; play one catch-up programme
- [ ] Resume a movie started on another device
- [ ] Play an episode; Next episode works
- [ ] Add a favorite; it appears on a second device after reload
- [ ] Rotate (phones/tablets): layout adapts, playback continues
- [ ] Back gesture / remote Back closes the player and dialogs

## Real-provider smoke test (owner only)

Never run by agents; never paste credentials into Claude. Record results (times, counts, problems with hosts removed) in DEVLOG.

- [ ] Channel count matches iSTB; guide covers favorites
- [ ] Time to first frame for 5 channels
- [ ] Device-limit message when one too many devices watch

## Bug report format (in the feature spec's "Bugs found" table, or a DEVLOG entry)

Device/size · steps · expected · actual · console or helper log lines (no credentials) · mock reproduction added (yes/no).
