#!/usr/bin/env python3
"""
HomeTV - a private IPTV player for your home.

Run this on one computer at home. Every phone, tablet, computer and Fire
Stick on the same Wi-Fi can then open the app in a browser.

    python3 server.py              (Mac / Linux)
    py server.py                   (Windows)

Your provider login is saved only on this computer (data/config.json) and is
never sent to the devices that watch. Uses only the Python standard library.
"""

import gzip
import json
import os
import re
import secrets
import shutil
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import xml.etree.ElementTree as ET

VERSION = "1.0"
ROOT = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(ROOT, "web")
DATA_DIR = os.path.join(ROOT, "data")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
USERDATA_FILE = os.path.join(DATA_DIR, "userdata.json")
EPG_FILE = os.path.join(DATA_DIR, "epg.xml")
PORT = int(os.environ.get("HOMETV_PORT", "8080"))
DEFAULT_UA = "VLC/3.0.20 LibVLC/3.0.20"

# How much of the TV guide to keep in memory (hours before / after now).
EPG_PAST_HOURS = int(os.environ.get("HOMETV_EPG_PAST_HOURS", "24"))
EPG_FUTURE_HOURS = int(os.environ.get("HOMETV_EPG_FUTURE_HOURS", "36"))
EPG_REFRESH_HOURS = 12
LIST_CACHE_SECONDS = 30 * 60

ALLOWED_ACTIONS = {
    "get_live_categories", "get_live_streams",
    "get_vod_categories", "get_vod_streams", "get_vod_info",
    "get_series_categories", "get_series", "get_series_info",
    "get_short_epg",
}
ALLOWED_PARAMS = {"category_id", "vod_id", "series_id", "stream_id", "limit"}
CACHEABLE_ACTIONS = {
    "get_live_categories", "get_live_streams", "get_vod_categories",
    "get_vod_streams", "get_series_categories", "get_series",
}

MIME = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript",
    ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
    ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
    ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2",
}

os.makedirs(DATA_DIR, exist_ok=True)


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# --------------------------------------------------------------------------
# Storage
# --------------------------------------------------------------------------

_lock = threading.RLock()


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


config = load_json(CONFIG_FILE, {})
userdata = load_json(USERDATA_FILE, {})
for k, v in (("favorites", {"live": [], "movie": [], "series": []}),
             ("hidden", {"live": [], "movie": [], "series": []}),
             ("progress", {}), ("recent", [])):
    userdata.setdefault(k, v)


def configured():
    return bool(config.get("server") and config.get("username") and config.get("password"))


def normalize_server(s):
    s = (s or "").strip()
    if not s:
        return ""
    if not re.match(r"^https?://", s, re.I):
        s = "http://" + s
    p = urllib.parse.urlsplit(s)
    path = re.sub(r"/(player_api\.php|get\.php|xmltv\.php|c/?|portal\.php).*$", "", p.path or "", flags=re.I)
    return urllib.parse.urlunsplit((p.scheme.lower(), p.netloc, path.rstrip("/"), "", ""))


# --------------------------------------------------------------------------
# Talking to the provider
# --------------------------------------------------------------------------

def ua():
    return config.get("user_agent") or DEFAULT_UA


def upstream_open(url, method="GET", headers=None, timeout=25):
    h = {"User-Agent": ua(), "Accept": "*/*", "Connection": "close"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h, method=method)
    return urllib.request.urlopen(req, timeout=timeout)


def api_url(action=None, cfg=None, **params):
    cfg = cfg or config
    q = {"username": cfg["username"], "password": cfg["password"]}
    if action:
        q["action"] = action
    q.update({k: v for k, v in params.items() if v not in (None, "")})
    return cfg["server"] + "/player_api.php?" + urllib.parse.urlencode(q)


def fetch_json(url, timeout=40):
    with upstream_open(url, timeout=timeout) as r:
        raw = r.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    txt = raw.decode("utf-8", "replace").strip()
    return json.loads(txt) if txt else None


_list_cache = {}
_status_cache = {"t": 0, "data": None}


def compute_time_offset(server_info):
    """Seconds to add to UTC to get the provider's local clock (for catch-up)."""
    try:
        now_local = datetime.strptime(server_info["time_now"], "%Y-%m-%d %H:%M:%S")
        ts = int(server_info["timestamp_now"])
        off = (now_local.replace(tzinfo=timezone.utc).timestamp() - ts)
        return int(round(off / 900.0) * 900)  # snap to 15 minutes
    except (KeyError, ValueError, TypeError):
        return 0


def provider_status(force=False):
    if not configured():
        return None
    if not force and _status_cache["data"] and time.time() - _status_cache["t"] < 300:
        return _status_cache["data"]
    data = fetch_json(api_url(), timeout=20)
    if isinstance(data, dict) and data.get("server_info"):
        with _lock:
            config["tz_offset"] = compute_time_offset(data["server_info"])
    _status_cache.update(t=time.time(), data=data)
    return data


# --------------------------------------------------------------------------
# TV guide (XMLTV)
# --------------------------------------------------------------------------

epg = {"state": "idle", "updated": 0, "channels": 0, "programmes": 0, "error": "", "data": {}}
_epg_lock = threading.Lock()


def parse_xmltv_time(s):
    s = (s or "").strip()
    m = re.match(r"(\d{14})\s*([+-]\d{4})?", s)
    if not m:
        return None
    dt = datetime.strptime(m.group(1), "%Y%m%d%H%M%S")
    tz = m.group(2) or "+0000"
    sign = 1 if tz[0] == "+" else -1
    off = sign * (int(tz[1:3]) * 3600 + int(tz[3:5]) * 60)
    return int(dt.replace(tzinfo=timezone.utc).timestamp()) - off


def load_epg(force_download=False):
    if not configured() or not _epg_lock.acquire(blocking=False):
        return
    try:
        epg.update(state="downloading", error="")
        fresh = os.path.exists(EPG_FILE) and time.time() - os.path.getmtime(EPG_FILE) < EPG_REFRESH_HOURS * 3600
        if force_download or not fresh:
            url = config["server"] + "/xmltv.php?" + urllib.parse.urlencode(
                {"username": config["username"], "password": config["password"]})
            log("Downloading TV guide...")
            tmp = EPG_FILE + ".part"
            with upstream_open(url, timeout=120) as r, open(tmp, "wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
            if os.path.getsize(tmp) < 50:
                os.remove(tmp)
                raise RuntimeError("Your provider returned an empty TV guide.")
            os.replace(tmp, EPG_FILE)
        epg["state"] = "parsing"
        now = time.time()
        lo, hi = now - EPG_PAST_HOURS * 3600, now + EPG_FUTURE_HOURS * 3600
        data, count = {}, 0
        with open(EPG_FILE, "rb") as raw:
            head = raw.read(2)
        opener = gzip.open if head == b"\x1f\x8b" else open
        with opener(EPG_FILE, "rb") as f:
            for _, el in ET.iterparse(f, events=("end",)):
                if el.tag == "programme":
                    start = parse_xmltv_time(el.get("start"))
                    stop = parse_xmltv_time(el.get("stop"))
                    if start and stop and stop > lo and start < hi:
                        ch = el.get("channel") or ""
                        title = (el.findtext("title") or "").strip()
                        desc = (el.findtext("desc") or "").strip()[:400]
                        data.setdefault(ch, []).append((start, stop, title, desc))
                        count += 1
                    el.clear()
                elif el.tag == "channel":
                    el.clear()
        for lst in data.values():
            lst.sort()
        epg.update(data=data, state="ready", updated=int(time.time()),
                   channels=len(data), programmes=count)
        log("TV guide ready: %d channels, %d programmes" % (len(data), count))
    except Exception as e:  # noqa: BLE001
        epg.update(state="error", error=str(e))
        log("TV guide error:", e)
    finally:
        _epg_lock.release()


def epg_loop():
    while True:
        if configured():
            load_epg()
        time.sleep(EPG_REFRESH_HOURS * 3600)


# --------------------------------------------------------------------------
# Stream proxy (keeps your password off the devices, fixes browser limits)
# --------------------------------------------------------------------------

_tokens = OrderedDict()
_token_by_url = {}
_token_lock = threading.Lock()
MAX_TOKENS = 30000


def token_for(url):
    with _token_lock:
        t = _token_by_url.get(url)
        if t:
            _tokens.move_to_end(t)
            return t
        t = secrets.token_urlsafe(12)
        _tokens[t] = url
        _token_by_url[url] = t
        while len(_tokens) > MAX_TOKENS:
            old, oldurl = _tokens.popitem(last=False)
            _token_by_url.pop(oldurl, None)
        return t


def url_for_token(t):
    with _token_lock:
        return _tokens.get(t)


URI_ATTR = re.compile(r'URI="([^"]+)"')


def rewrite_playlist(text, base):
    out = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            out.append(line)
        elif s.startswith("#"):
            out.append(URI_ATTR.sub(lambda m: 'URI="%s"' % proxied(urllib.parse.urljoin(base, m.group(1))), line))
        else:
            out.append(proxied(urllib.parse.urljoin(base, s)))
    return "\n".join(out) + "\n"


def proxied(url):
    path = urllib.parse.urlsplit(url).path
    ext = os.path.splitext(path)[1].lower()
    if not re.match(r"^\.[a-z0-9]{1,5}$", ext):
        ext = ""
    return "/t/" + token_for(url) + ext


def is_playlist(resp, url):
    ct = (resp.headers.get("Content-Type") or "").lower()
    return "mpegurl" in ct or urllib.parse.urlsplit(url).path.lower().endswith(".m3u8")


# --------------------------------------------------------------------------
# HTTP handler
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "HomeTV/" + VERSION
    protocol_version = "HTTP/1.0"

    def log_message(self, fmt, *args):
        if os.environ.get("HOMETV_DEBUG"):
            log(self.address_string(), fmt % args)

    # ---- helpers
    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_bytes(body, "application/json; charset=utf-8", code)

    def send_bytes(self, body, ctype, code=200, extra=None):
        accept_gzip = "gzip" in (self.headers.get("Accept-Encoding") or "")
        gz = accept_gzip and len(body) > 2048 and ctype.startswith(("application/json", "text/", "application/javascript"))
        if gz:
            body = gzip.compress(body, 5)
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if gz:
            self.send_header("Content-Encoding", "gzip")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            raise ValueError("too large")
        raw = self.rfile.read(n) if n else b""
        return json.loads(raw.decode("utf-8")) if raw else {}

    # ---- routing
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        path, q = u.path, dict(urllib.parse.parse_qsl(u.query))
        try:
            if path.startswith("/api/"):
                return self.api_get(path, q)
            if path.startswith("/play/"):
                return self.play(path, q)
            if path.startswith("/t/"):
                return self.passthrough(path)
            return self.static(path)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except urllib.error.HTTPError as e:
            self.safe_error(502, "Provider answered %s" % e.code)
        except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
            self.safe_error(504, "Could not reach your provider (%s)" % getattr(e, "reason", e))
        except Exception as e:  # noqa: BLE001
            log("Error on", path, repr(e))
            self.safe_error(500, str(e))

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        try:
            body = self.read_body()
            return self.api_post(path, body)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa: BLE001
            log("Error on", path, repr(e))
            self.safe_error(500, str(e))

    def safe_error(self, code, msg):
        try:
            self.send_json({"error": msg}, code)
        except Exception:  # noqa: BLE001
            pass

    # ---- static files
    def static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        full = os.path.normpath(os.path.join(WEB_DIR, path.lstrip("/")))
        if not full.startswith(WEB_DIR + os.sep) or not os.path.isfile(full):
            return self.send_bytes(b"Not found", "text/plain", 404)
        with open(full, "rb") as f:
            body = f.read()
        self.send_bytes(body, MIME.get(os.path.splitext(full)[1].lower(), "application/octet-stream"))

    # ---- JSON API
    def api_get(self, path, q):
        if path == "/api/status":
            out = {"configured": configured(), "version": VERSION,
                   "epg": {k: epg[k] for k in ("state", "updated", "channels", "programmes", "error")}}
            if configured():
                out["username"] = config["username"]
                out["server"] = urllib.parse.urlsplit(config["server"]).hostname
                try:
                    st = provider_status(force=q.get("refresh") == "1") or {}
                    ui = dict(st.get("user_info") or {})
                    ui.pop("password", None)
                    out["account"] = ui
                    out["tz_offset"] = config.get("tz_offset", 0)
                except Exception as e:  # noqa: BLE001
                    out["account_error"] = str(e)
            return self.send_json(out)

        if path == "/api/x":
            if not configured():
                return self.send_json({"error": "not configured"}, 400)
            action = q.get("action")
            if action not in ALLOWED_ACTIONS:
                return self.send_json({"error": "action not allowed"}, 400)
            params = {k: v for k, v in q.items() if k in ALLOWED_PARAMS}
            key = action + "?" + urllib.parse.urlencode(sorted(params.items()))
            hit = _list_cache.get(key)
            if action in CACHEABLE_ACTIONS and hit and time.time() - hit[0] < LIST_CACHE_SECONDS and q.get("refresh") != "1":
                return self.send_bytes(hit[1], "application/json; charset=utf-8")
            with upstream_open(api_url(action, **params), timeout=60) as r:
                raw = r.read()
            if raw[:2] == b"\x1f\x8b":
                raw = gzip.decompress(raw)
            if not raw.strip():
                raw = b"[]"
            if action in CACHEABLE_ACTIONS:
                _list_cache[key] = (time.time(), raw)
            return self.send_bytes(raw, "application/json; charset=utf-8")

        if path == "/api/userdata":
            with _lock:
                return self.send_json(userdata)

        return self.send_json({"error": "not found"}, 404)

    def api_post(self, path, body):
        if path == "/api/setup":
            server = normalize_server(body.get("server"))
            user = (body.get("username") or "").strip()
            pw = (body.get("password") or "").strip()
            if not (server and user and pw):
                return self.send_json({"error": "Please fill in the server address, username and password."}, 400)
            cand = {"server": server, "username": user, "password": pw,
                    "user_agent": (body.get("user_agent") or "").strip()}
            try:
                old_ua = config.get("user_agent")
                config["user_agent"] = cand["user_agent"]
                data = fetch_json(api_url(cfg=cand), timeout=20)
            except Exception as e:  # noqa: BLE001
                config["user_agent"] = old_ua
                return self.send_json({"error": "Could not connect to %s — %s" % (server, e)}, 400)
            ui = (data or {}).get("user_info") if isinstance(data, dict) else None
            if not ui or str(ui.get("auth", "1")) == "0":
                config["user_agent"] = old_ua
                return self.send_json({"error": "The provider rejected this username or password."}, 400)
            with _lock:
                config.clear()
                config.update(cand)
                config["tz_offset"] = compute_time_offset(data.get("server_info") or {})
                save_json(CONFIG_FILE, config)
            _list_cache.clear()
            _status_cache.update(t=0, data=None)
            if os.path.exists(EPG_FILE):
                os.remove(EPG_FILE)
            threading.Thread(target=load_epg, daemon=True).start()
            log("Connected to provider", server, "as", user)
            return self.send_json({"ok": True})

        if path == "/api/refresh":
            _list_cache.clear()
            _status_cache.update(t=0, data=None)
            if body.get("epg"):
                threading.Thread(target=load_epg, kwargs={"force_download": True}, daemon=True).start()
            return self.send_json({"ok": True})

        if path == "/api/epg":
            ids = body.get("ids") or []
            lo = float(body.get("from") or time.time() - 3 * 3600)
            hi = float(body.get("to") or time.time() + 6 * 3600)
            data = epg["data"]
            out = {}
            for cid in ids[:3000]:
                progs = data.get(cid)
                if progs:
                    out[cid] = [p for p in progs if p[1] > lo and p[0] < hi]
            return self.send_json({"state": epg["state"], "programmes": out})

        if path == "/api/favorite":
            kind, item, on = body.get("type"), body.get("item") or {}, bool(body.get("on"))
            if kind not in ("live", "movie", "series") or "id" not in item:
                return self.send_json({"error": "bad request"}, 400)
            with _lock:
                favs = [f for f in userdata["favorites"][kind] if str(f.get("id")) != str(item["id"])]
                if on:
                    favs.append({k: item.get(k) for k in ("id", "name", "icon", "ext", "cat") if k in item})
                userdata["favorites"][kind] = favs
                save_json(USERDATA_FILE, userdata)
                return self.send_json(userdata["favorites"])

        if path == "/api/hidden":
            kind = body.get("type")
            if kind not in ("live", "movie", "series"):
                return self.send_json({"error": "bad request"}, 400)
            with _lock:
                userdata["hidden"][kind] = [str(x) for x in body.get("ids") or []]
                save_json(USERDATA_FILE, userdata)
                return self.send_json(userdata["hidden"])

        if path == "/api/progress":
            key = str(body.get("key") or "")
            if not re.match(r"^(movie|episode):\w+$", key):
                return self.send_json({"error": "bad key"}, 400)
            with _lock:
                prog = userdata["progress"]
                pos, dur = float(body.get("pos") or 0), float(body.get("dur") or 0)
                if body.get("remove") or (dur and pos / dur > 0.95) or pos < 15:
                    prog.pop(key, None)
                else:
                    prog[key] = {k: body.get(k) for k in ("name", "icon", "ext", "series_id", "series_name") if body.get(k) is not None}
                    prog[key].update(pos=pos, dur=dur, t=int(time.time()))
                if len(prog) > 300:
                    for k in sorted(prog, key=lambda k: prog[k].get("t", 0))[:len(prog) - 300]:
                        prog.pop(k)
                save_json(USERDATA_FILE, userdata)
                return self.send_json({"ok": True})

        if path == "/api/recent":
            cid = str(body.get("id") or "")
            with _lock:
                rec = [c for c in userdata["recent"] if c != cid]
                rec.insert(0, cid)
                userdata["recent"] = rec[:30]
                save_json(USERDATA_FILE, userdata)
                return self.send_json({"ok": True})

        return self.send_json({"error": "not found"}, 404)

    # ---- playback
    PLAY_RE = re.compile(r"^/play/(live|movie|series|timeshift)/(\d+)\.([a-z0-9]{2,5})$")

    def play(self, path, q):
        if not configured():
            return self.send_json({"error": "not configured"}, 400)
        m = self.PLAY_RE.match(path)
        if not m:
            return self.send_json({"error": "bad stream path"}, 400)
        kind, sid, ext = m.groups()
        c = config
        user, pw = urllib.parse.quote(c["username"], safe=""), urllib.parse.quote(c["password"], safe="")
        if kind == "timeshift":
            start_ts = int(q.get("start") or 0)
            dur = max(1, min(600, int(q.get("dur") or 60)))
            local = datetime.fromtimestamp(start_ts + c.get("tz_offset", 0), tz=timezone.utc)
            start = local.strftime("%Y-%m-%d:%H-%M")
            url = "%s/timeshift/%s/%s/%d/%s/%s.%s" % (c["server"], user, pw, dur, start, sid, ext)
        else:
            url = "%s/%s/%s/%s/%s.%s" % (c["server"], kind, user, pw, sid, ext)
        if kind == "live":
            threading.Thread(target=self._note_recent, args=(sid,), daemon=True).start()
        return self.relay(url)

    @staticmethod
    def _note_recent(sid):
        with _lock:
            rec = [c for c in userdata["recent"] if c != sid]
            rec.insert(0, sid)
            userdata["recent"] = rec[:30]
            save_json(USERDATA_FILE, userdata)

    def passthrough(self, path):
        token = path[3:].split(".", 1)[0]
        url = url_for_token(token)
        if not url:
            return self.send_json({"error": "expired"}, 410)
        return self.relay(url)

    def relay(self, url):
        headers = {}
        if self.headers.get("Range"):
            headers["Range"] = self.headers["Range"]
        try:
            resp = upstream_open(url, method="HEAD" if self.command == "HEAD" else "GET",
                                 headers=headers, timeout=25)
        except urllib.error.HTTPError as e:
            msg = {401: "Your provider refused the stream (check your subscription).",
                   403: "Your provider refused the stream (too many devices watching, or blocked).",
                   404: "This stream isn't available from your provider.",
                   458: "Your provider limited the number of devices watching at once."}.get(e.code, "Provider answered %s" % e.code)
            return self.send_json({"error": msg, "status": e.code}, 502)
        with resp:
            final = resp.geturl()
            if is_playlist(resp, final):
                text = resp.read().decode("utf-8", "replace")
                body = rewrite_playlist(text, final).encode("utf-8")
                return self.send_bytes(body, "application/vnd.apple.mpegurl")
            self.send_response(resp.status)
            for h in ("Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "Last-Modified"):
                v = resp.headers.get(h)
                if v:
                    self.send_header(h, v)
            if not resp.headers.get("Content-Type"):
                self.send_header("Content-Type", "video/mp2t")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if self.command == "HEAD":
                return
            while True:
                chunk = resp.read(64 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)


# --------------------------------------------------------------------------
# Start-up
# --------------------------------------------------------------------------

def lan_addresses():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith("127."))


def main():
    if not os.path.isdir(WEB_DIR):
        sys.exit("The 'web' folder is missing. Keep server.py next to the web folder.")
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    httpd.daemon_threads = True
    threading.Thread(target=epg_loop, daemon=True).start()
    print()
    print("  HomeTV is running.")
    print("  On this computer:   http://localhost:%d" % PORT)
    for ip in lan_addresses():
        print("  On your other devices (same Wi-Fi):   http://%s:%d" % (ip, PORT))
    print("  Leave this window open while you watch. Press Ctrl+C to stop.")
    print()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
