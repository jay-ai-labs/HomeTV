# Developer tools

- `mock_provider.py` is a fake Xtream Codes provider used for testing without a real login.
  It serves 30 channels, a TV guide, movies, series, catch-up and a deliberately blocked channel.
  It expects test videos in `tools/media/` (`hls/seg0.ts`..., `hls/full.m3u8`, `movie.mp4`, `live.ts`); the API and TV guide work without them.
  Make them with ffmpeg (keyframes every 2 s so the HLS segments are 2 s long):

      ffmpeg -f lavfi -i testsrc2=size=640x360:rate=25 -f lavfi -i sine=frequency=440 -t 120 -c:v libx264 -g 50 -keyint_min 50 -sc_threshold 0 -pix_fmt yuv420p -c:a aac -shortest media/movie.mp4
      ffmpeg -i media/movie.mp4 -t 60 -c copy -f mpegts media/live.ts
      ffmpeg -i media/movie.mp4 -t 60 -c copy -f hls -hls_time 2 -hls_list_size 0 -hls_segment_filename media/hls/seg%d.ts media/hls/full.m3u8

  Run: `py tools\mock_provider.py 9001`, then log in to HomeTV with server `127.0.0.1:9001`,
  username `demo`, password `p@ss+1 23`.
- `e2e_test.js` drives every screen in a headless browser (Node.js + Playwright) and checks each flow: Home, Live TV,
  preview, full screen, zapping, blocked channel, MPEG-TS, guide, catch-up, movies (seek, saved progress), series,
  favorites, hide groups, search, settings, the setup form, keyboard, five screen sizes, phone, and browser errors.
  It prints PASS/FAIL per flow plus a summary and exits non-zero if anything failed. A failed test is retried once;
  a pass on retry prints FLAKY. It refuses to run against port 8080.
- `run_e2e.js` is the one-command runner: `npm install` and `npx playwright install chromium` once in this folder,
  make the test media (above), then `npm run e2e`. It starts the mock provider (9001) and a throwaway copy of `helper/`
  (8099, no `data/`), logs the copy in to the mock, runs `e2e_test.js`, then stops both and deletes the copy.
  Screenshots go to `%TEMP%\hometv-shots` (set `HOMETV_SHOTS` to change). To test a helper you started yourself, set
  `HOMETV_URL` (for example `http://127.0.0.1:8099`) and run `node e2e_test.js`.
- `gen-art.js` draws the prototype's sample posters and channel logos into `docs\design\prototype\art\`
  (text is turned into vector shapes so they look the same everywhere). `npm install`, then `node gen-art.js`.
