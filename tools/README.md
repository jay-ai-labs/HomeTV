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
- `e2e_test.js` drives every screen in a headless browser (Node.js + Playwright): Home, Live TV, player, zapping,
  blocked channel, MPEG-TS, guide, catch-up, movies, series, favorites, search, settings, keyboard, phone.
  Run it while HomeTV is connected to the mock provider: `npm install` once in this folder, then `node e2e_test.js`
  (set `HOMETV_URL` if HomeTV isn't on http://localhost:8080). Screenshots go to /tmp/shots.
- `gen-art.js` draws the prototype's sample posters and channel logos into `docs\design\prototype\art\`
  (text is turned into vector shapes so they look the same everywhere). `npm install`, then `node gen-art.js`.
