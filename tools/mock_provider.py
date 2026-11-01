"""Fake Xtream Codes provider for testing HomeTV."""
import json, os, re, time, urllib.parse, sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

M = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media")
U, PW = "demo", "p@ss+1 23"
TZ_OFF = 3600  # provider clock is UTC+1
LOG = []

CATS = [{"category_id": "1", "category_name": "UK | News", "parent_id": 0},
        {"category_id": "2", "category_name": "UK | Sports", "parent_id": 0},
        {"category_id": "3", "category_name": "US | Entertainment", "parent_id": 0}]
CH = []
for i in range(1, 31):
    CH.append({"num": i, "name": ["BBC News", "Sky News", "CNN", "Sky Sports Main", "Blocked Channel", "ESPN", "HBO", "AMC"][i - 1] if i <= 8 else "Channel %d" % i,
               "stream_type": "live", "stream_id": 100 + i, "stream_icon": "" if i % 3 else "/logo.svg",
               "epg_channel_id": "ch%d.uk" % i if i != 7 else None, "category_id": str((i - 1) % 3 + 1),
               "tv_archive": 1 if i in (1, 2, 4) else 0, "tv_archive_duration": 3 if i in (1, 2, 4) else 0})
VCATS = [{"category_id": "10", "category_name": "Action"}, {"category_id": "11", "category_name": "Comedy"}]
VODS = [{"num": i, "name": "Test Movie %d (20%02d)" % (i, i), "stream_type": "movie", "stream_id": 500 + i, "stream_icon": "/poster.svg",
         "rating": "7.%d" % i, "category_id": "10" if i < 6 else "11", "container_extension": "mp4"} for i in range(1, 11)]
SCATS = [{"category_id": "20", "category_name": "Drama"}]
SERIES = [{"num": 1, "name": "The Test Show", "series_id": 900, "cover": "/poster.svg", "plot": "A show about tests.", "releaseDate": "2024-01-01", "category_id": "20", "rating": "8"}]


def b64(s):
    import base64
    return base64.b64encode(s.encode()).decode()


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def log_message(self, *a):
        pass

    def j(self, o, code=200):
        b = json.dumps(o).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def raw(self, b, ct, code=200):
        self.send_response(code); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path); q = dict(urllib.parse.parse_qsl(u.query)); p = urllib.parse.unquote(u.path)
        LOG.append(p + ("?" + u.query if u.query else ""))
        if p == "/player_api.php":
            if q.get("username") != U or q.get("password") != PW:
                return self.j({"user_info": {"auth": 0}})
            a = q.get("action")
            now = int(time.time())
            if not a:
                return self.j({"user_info": {"username": U, "password": PW, "auth": 1, "status": "Active", "exp_date": str(now + 86400 * 90), "active_cons": "0", "max_connections": "2", "allowed_output_formats": ["m3u8", "ts"]},
                               "server_info": {"timezone": "Europe/London", "timestamp_now": now, "time_now": datetime.fromtimestamp(now + TZ_OFF, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")}})
            if a == "get_live_categories": return self.j(CATS)
            if a == "get_live_streams":
                c = q.get("category_id"); return self.j([x for x in CH if not c or x["category_id"] == c])
            if a == "get_vod_categories": return self.j(VCATS)
            if a == "get_vod_streams":
                c = q.get("category_id"); return self.j([x for x in VODS if not c or x["category_id"] == c])
            if a == "get_vod_info":
                return self.j({"info": {"plot": "A movie used for testing playback.", "genre": "Action", "releasedate": "2021-05-01", "duration": "00:02:00", "rating": "7.5", "cast": "Test Actor"}, "movie_data": {"stream_id": int(q["vod_id"]), "container_extension": "mp4"}})
            if a == "get_series_categories": return self.j(SCATS)
            if a == "get_series": return self.j(SERIES)
            if a == "get_series_info":
                eps = {"1": [{"id": str(7000 + e), "episode_num": e, "title": "Pilot" if e == 1 else "Episode %d" % e, "container_extension": "mp4", "season": 1, "info": {"duration": "00:02:00", "plot": "Episode plot %d" % e}} for e in range(1, 4)],
                       "2": [{"id": "7101", "episode_num": 1, "title": "Return", "container_extension": "mp4", "season": 2, "info": {}}]}
                return self.j({"seasons": [], "info": {"name": "The Test Show", "plot": "A show about tests.", "genre": "Drama"}, "episodes": eps})
            if a == "get_short_epg":
                t = int(time.time()) // 1800 * 1800
                return self.j({"epg_listings": [{"title": b64("Short EPG Show"), "description": b64("From short EPG"), "start_timestamp": str(t), "stop_timestamp": str(t + 1800)}]})
            return self.j([])
        if p == "/xmltv.php":
            if q.get("username") != U: return self.raw(b"", "text/xml", 401)
            t0 = int(time.time()) // 1800 * 1800 - 30 * 3600
            out = ['<?xml version="1.0" encoding="UTF-8"?><tv>']
            for i in range(1, 31):
                out.append('<channel id="ch%d.uk"><display-name>C%d</display-name></channel>' % (i, i))
            for i in range(1, 31):
                t = t0
                k = 0
                while t < t0 + 70 * 3600:
                    d = 1800 if (k + i) % 3 else 3600
                    s = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y%m%d%H%M%S +0000")
                    e = datetime.fromtimestamp(t + d, tz=timezone.utc).strftime("%Y%m%d%H%M%S +0000")
                    out.append('<programme start="%s" stop="%s" channel="ch%d.uk"><title lang="en">Show %d &amp; Co #%d</title><desc>Description for programme %d on channel %d.</desc></programme>' % (s, e, i, i, k, k, i))
                    t += d; k += 1
            out.append("</tv>")
            return self.raw("".join(out).encode(), "application/xml")
        m = re.match(r"^/live/([^/]+)/([^/]+)/(\d+)\.(m3u8|ts)$", p)
        if m:
            if (m.group(1), m.group(2)) != (U, PW): return self.raw(b"", "text/plain", 401)
            sid = int(m.group(3))
            if sid == 105: return self.raw(b"", "text/plain", 403)
            if m.group(4) == "m3u8":
                self.send_response(302); self.send_header("Location", "/hlsredir/%d/index.m3u8?token=abc" % sid); self.end_headers(); return
            return self.stream_ts()
        m = re.match(r"^/hlsredir/(\d+)/index\.m3u8$", p)
        if m:
            n = int(time.time()) // 2
            lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:2", "#EXT-X-MEDIA-SEQUENCE:%d" % n]
            for k in range(n, n + 6):
                if k % 30 == 0 and k != n: lines.append("#EXT-X-DISCONTINUITY")
                lines += ["#EXTINF:2.000,", "seg/%d.ts?token=abc" % (k % 30)]
            return self.raw("\n".join(lines).encode(), "application/vnd.apple.mpegurl")
        m = re.match(r"^/hlsredir/\d+/seg/(\d+)\.ts$", p)
        if m:
            return self.file(os.path.join(M, "hls", "seg%s.ts" % m.group(1)), "video/mp2t")
        m = re.match(r"^/timeshift/([^/]+)/([^/]+)/(\d+)/([\d:-]+)/(\d+)\.(m3u8|ts)$", p)
        if m:
            if m.group(6) == "ts": return self.stream_ts()
            body = open(os.path.join(M, "hls", "full.m3u8")).read().replace("seg", "/vodseg/seg")
            return self.raw(body.encode(), "application/vnd.apple.mpegurl")
        m = re.match(r"^/vodseg/(seg\d+\.ts)$", p)
        if m:
            return self.file(os.path.join(M, "hls", m.group(1)), "video/mp2t")
        m = re.match(r"^/(movie|series)/([^/]+)/([^/]+)/(\d+)\.(\w+)$", p)
        if m:
            return self.file(os.path.join(M, "movie.mp4"), "video/mp4")
        if p in ("/logo.svg", "/poster.svg"):
            svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#345"/><circle cx="100" cy="150" r="60" fill="#8ac"/></svg>'
            return self.raw(svg.encode(), "image/svg+xml")
        self.raw(b"nope", "text/plain", 404)

    def file(self, path, ct):
        size = os.path.getsize(path)
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng:
            mm = re.match(r"bytes=(\d*)-(\d*)", rng)
            if mm.group(1): start = int(mm.group(1))
            if mm.group(2): end = min(int(mm.group(2)), size - 1)
            self.send_response(206); self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        else:
            self.send_response(200)
        self.send_header("Content-Type", ct); self.send_header("Accept-Ranges", "bytes"); self.send_header("Content-Length", str(end - start + 1)); self.end_headers()
        with open(path, "rb") as f:
            f.seek(start); left = end - start + 1
            try:
                while left > 0:
                    b = f.read(min(65536, left)); self.wfile.write(b); left -= len(b)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def stream_ts(self):
        self.send_response(200); self.send_header("Content-Type", "video/mp2t"); self.end_headers()
        data = open(os.path.join(M, "live.ts"), "rb").read()
        rate = len(data) / 60.0
        try:
            sent, t0 = 0, time.time()
            while time.time() - t0 < 120:
                chunk = data[(sent % len(data)) // 188 * 188:][:188 * 350]
                self.wfile.write(chunk); sent += len(chunk)
                ahead = sent / rate - (time.time() - t0)
                if ahead > 3: time.sleep(ahead - 3)
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 9001), H)
    srv.daemon_threads = True
    srv.serve_forever()
