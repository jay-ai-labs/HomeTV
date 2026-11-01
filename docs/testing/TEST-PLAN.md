# Test plan

Owner: qa agent · Last updated: 2026-11-01

## Layers

| Layer | What | Where | When |
| --- | --- | --- | --- |
| Unit (helper) | provider URL building, playlist rewrite, token map, time-zone conversion, store migrations, EPG parsing | `development/helper/tests/` (`py -m unittest`), arrives with F-032 | Every helper change |
| End-to-end | Every screen and flow in a real browser against the mock provider | `development/tools/e2e_test.js` (Playwright) | Every change (`/test`) |
| Visual | Screenshots at iPhone portrait/landscape, iPad portrait/landscape, desktop, TV | e2e writes to the screenshot folder | Every UI change |
| Device checklist | Real devices on the home network | below | Before each release |
| Real provider | Owner-only smoke test | below | Before each release; after provider changes |

## Running the automated tests (Windows)

```bat
:: once: Playwright, plus test media (ffmpeg commands in development\tools\README.md)
cd development\tools
npm install
npx playwright install chromium

:: terminal 1: mock provider
py mock_provider.py 9001

:: terminal 2: a THROWAWAY copy of the helper, so tests never touch the real data\config.json
robocopy development\helper %TEMP%\hometv-test /E /XD data >nul
cd /d %TEMP%\hometv-test
set HOMETV_PORT=8099
py server.py

:: terminal 3: log the test helper in to the mock once (http://localhost:8099, server 127.0.0.1:9001,
:: user demo, password "p@ss+1 23"), then
cd development\tools
set HOMETV_URL=http://localhost:8099
node e2e_test.js
```

Never run tests against the real helper on port 8080: logging it in to the mock would replace the household's provider login.
F-032 adds a `HOMETV_DATA_DIR` setting so a copy is no longer needed.

`/test` in Claude Code does the same.

The mock covers: 30 channels in 3 groups, guide data with gaps, catch-up channels, a channel that returns 403, HLS with redirect + relative segments + query tokens, MPEG-TS, movies with range requests, series with seasons, a password with `@`, `+` and a space, and a provider clock 1 h ahead of UTC.
**Stalker mock (F-036, not built yet):** `development/tools/mock_stalker.py` on port 9002 (MAC `00:1A:79:12:34:56`; one MAC deliberately unregistered). It checks the MAC cookie and Bearer token, expires tokens to test renewal, paginates VOD 14 per page, marks archive programmes, and issues single-use `create_link` URLs. The full e2e suite runs against **both** mocks.

**Rule:** every bug found on the real provider gets reproduced in the mock before it's fixed.

## Coverage map

| Feature | e2e case | Unit | Device checklist |
| --- | --- | --- | --- |
| F-001 login/account | setup, settings | config (F-032) | ✓ |
| F-002/F-003 live + preview | live, live-preview | | ✓ |
| F-004 player, zapping | player, zap | | ✓ |
| F-005 guide | guide | epg (F-032) | ✓ |
| F-006 catch-up | catchup | timeshift tz (F-032) | ✓ |
| F-007/F-008 movies, series | movie, series, episode | | ✓ |
| F-009 continue watching | progress saved | store (F-032) | ✓ |
| F-010/F-011 favorites, hidden | favorites | store (F-032) | ✓ |
| F-012 search | search | | |
| F-013 fallback, errors | blocked, ts | relay (F-032) | ✓ |
| F-014 remote/keyboard | keyboard | | Fire TV |
| F-015–F-017 home, layouts, install | home, phone, screenshots | | iPhone, iPad |

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
