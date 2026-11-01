# HomeTV helper API

API version **1** (helper 1.0) · Owner: architect (contract), backend (implementation) · Last updated: 2026-11-01

The web client talks only to the home helper, never to the provider. All endpoints are on the helper's LAN address (default port 8080, set with `HOMETV_PORT`).
This file is the contract: **change it in the same commit as the code**, and add a line to the change log at the bottom.

## Conventions

- JSON in and out (`Content-Type: application/json`). Responses over 2 KB are gzipped when the client sends `Accept-Encoding: gzip`.
- Errors: HTTP status + `{"error": "Human-readable message"}`. Codes: 400 bad input or not configured · 404 unknown endpoint · 410 expired stream token · 500 helper bug · 502 provider refused · 504 provider unreachable.
- No authentication (LAN only, see F-030). Never expose the port to the internet.
- `Cache-Control: no-store` on everything.
- IDs are strings in client code even when the provider sends numbers.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | [/api/status](#get-apistatus) | Setup state, account, guide state |
| POST | [/api/setup](#post-apisetup) | Save and validate the provider login |
| GET | [/api/x](#get-apix) | Whitelisted Xtream API proxy (lists, info, short EPG) |
| POST | [/api/refresh](#post-apirefresh) | Clear list caches; optionally re-download the guide |
| POST | [/api/epg](#post-apiepg) | Programmes for many channels in a time window |
| GET | [/api/userdata](#get-apiuserdata) | Shared favorites, hidden groups, progress, recent |
| POST | [/api/favorite](#post-apifavorite) | Add or remove a favorite |
| POST | [/api/hidden](#post-apihidden) | Replace hidden groups for one type |
| POST | [/api/progress](#post-apiprogress) | Save or clear a resume point |
| POST | [/api/recent](#post-apirecent) | Mark a channel as recently watched |
| GET, HEAD | [/play/{kind}/{id}.{ext}](#get-playkindidext) | Start a stream (live, movie, series, timeshift) |
| GET, HEAD | [/t/{token}[.ext]](#get-ttokenext) | Stream segment or nested playlist behind a token |
| GET | `/`, `/<file>` | Static files from `web/` |

---

### GET /api/status

Query: `refresh=1` re-reads the account from the provider (otherwise cached 5 minutes).

```json
{
  "configured": true,
  "version": "1.0",
  "epg": { "state": "ready", "updated": 1793546954, "channels": 30, "programmes": 2730, "error": "" },
  "username": "demo",
  "server": "provider.example",
  "account": { "username": "demo", "auth": 1, "status": "Active", "exp_date": "1801322956",
               "active_cons": "0", "max_connections": "2", "allowed_output_formats": ["m3u8", "ts"] },
  "tz_offset": 3600
}
```

- `epg.state`: `idle` | `downloading` | `parsing` | `ready` | `error`.
- `account` is the provider's `user_info` with `password` removed. If the provider can't be reached, `account_error` is returned instead.
- Not configured: `{"configured": false, "version": "1.0", "epg": {...}}`.
- **F-036, not built yet:** adds `provider_type` (`"xtream"` | `"stalker"`) and, for Stalker, `mac_hint` (last 2 bytes, e.g. `"…:A1:B2"`). `username` is omitted for Stalker. `account` is built from the portal's profile/account info, with the same field names.

### POST /api/setup

**F-036, not built yet:** a Stalker portal login is `{"type": "stalker", "portal": "http://host:port/c/", "mac": "00:1A:79:12:34:56", "serial": "", "device_id": "", "device_id2": "", "signature": "", "timezone": ""}` (only `portal` and `mac` required). A missing `type` means `"xtream"`. The MAC is normalised to upper case with colons, and is never returned by any endpoint.

```json
{ "server": "http://provider.example:8080", "username": "demo", "password": "secret", "user_agent": "" }
```

The helper normalises `server` (adds `http://`, strips `/player_api.php` and similar), then validates by calling the provider. On success it saves `config.json`, clears caches and starts a guide download.
Returns `{"ok": true}` or 400 `{"error": "The provider rejected this username or password."}`.

### GET /api/x

Proxies one whitelisted Xtream action. The response body is the provider's JSON, unchanged.

| `action` | Extra params | Cached 30 min |
| --- | --- | --- |
| `get_live_categories` | | yes |
| `get_live_streams` | `category_id` (optional) | yes |
| `get_vod_categories` | | yes |
| `get_vod_streams` | `category_id` (optional) | yes |
| `get_vod_info` | `vod_id` | no |
| `get_series_categories` | | yes |
| `get_series` | `category_id` (optional) | yes |
| `get_series_info` | `series_id` | no |
| `get_short_epg` | `stream_id`, `limit` | no |

`refresh=1` bypasses the cache. Other actions or params → 400. An empty provider answer becomes `[]`.

### POST /api/refresh

`{"epg": true}` also re-downloads the guide in the background. Returns `{"ok": true}`.

### POST /api/epg

```json
{ "ids": ["ch1.uk", "ch2.uk"], "from": 1793460000, "to": 1793676000 }
```
```json
{ "state": "ready", "programmes": { "ch1.uk": [[1793545200, 1793547000, "Title", "Description"]] } }
```

- `ids` are the channels' `epg_channel_id`s (max 3,000 per call). Channels with no guide are omitted.
- Each programme is `[start, stop, title, description]` (Unix seconds, description ≤ 400 chars).
- While `state` isn't `ready`, results may be empty; the client retries.

### GET /api/userdata

```json
{
  "favorites": { "live": [{ "id": "104", "name": "Channel", "icon": "http://..." }], "movie": [], "series": [] },
  "hidden": { "live": ["3"], "movie": [], "series": [] },
  "progress": { "movie:501": { "name": "Film", "icon": "...", "ext": "mp4", "pos": 2540.2, "dur": 7200, "t": 1793547115 } },
  "recent": ["104", "101"]
}
```

Shape and rules: [DATA-MODEL.md](../database/DATA-MODEL.md#userdatajson).

### POST /api/favorite

`{"type": "live"|"movie"|"series", "item": {"id": "104", "name": "...", "icon": "...", "ext": "mp4", "cat": "3"}, "on": true}`
Stores `id, name, icon, ext, cat` only. Returns the whole `favorites` object.

### POST /api/hidden

`{"type": "live"|"movie"|"series", "ids": ["3", "7"]}` replaces the hidden category IDs for that type. Returns the whole `hidden` object.

### POST /api/progress

`{"key": "movie:501" | "episode:7001", "pos": 2540.2, "dur": 7200, "name": "...", "icon": "...", "ext": "mp4", "series_id": "900", "series_name": "...", "remove": false}`

The point is removed when `remove` is true, `pos < 15` s, or `pos/dur > 0.95`. Only the 300 newest points are kept. Returns `{"ok": true}`.

### POST /api/recent

`{"id": "104"}` moves the channel to the front of `recent` (max 30). `/play/live/...` already does this, so clients rarely need it.

### GET /play/{kind}/{id}.{ext}

| kind | Upstream | Notes |
| --- | --- | --- |
| `live` | `/live/{user}/{pass}/{id}.{ext}` | `ext` = `m3u8` or `ts`. Also updates `recent` |
| `movie` | `/movie/{user}/{pass}/{id}.{ext}` | `ext` = the item's `container_extension` |
| `series` | `/series/{user}/{pass}/{id}.{ext}` | `id` = episode ID |
| `timeshift` | `/timeshift/{user}/{pass}/{dur}/{YYYY-MM-DD:HH-MM}/{id}.{ext}` | Query `start` (Unix s) and `dur` (minutes, 1–600); converted with `tz_offset` |

- `id` must be digits, `ext` 2–5 lowercase letters/digits. **F-036, not built yet:** `id` widens to `[A-Za-z0-9_-]{1,64}`, for Stalker episode IDs `{series_id}_{season_id}_{episode}`.
- For Stalker portals (F-036) the adapter calls the portal's `create_link` for each play and relays the returned URL; the `/api/x` actions return the same Xtream-shaped JSON (translation table in the F-036 spec).
- The `Range` header is forwarded, and `Content-Range` / `Accept-Ranges` are passed back (seeking).
- HLS playlists (by content type or `.m3u8`) come back rewritten. Every URI, including `URI="..."` attributes, becomes `/t/{token}.{ext}`, resolved against the final URL after redirects.
- Provider refusals → 502 `{"error": "...", "status": 403}` with friendly text for 401, 403, 404 and 458.

### GET /t/{token}[.ext]

Relays the URL behind an opaque token issued during a playlist rewrite (nested playlists are rewritten again). Unknown or evicted token → 410. Tokens live in memory only (max 30,000).

---

## Upstream calls (provider, Xtream Codes)

| Helper use | Provider URL |
| --- | --- |
| Login check, account, server clock | `GET {server}/player_api.php?username&password` |
| Lists and info | `GET {server}/player_api.php?username&password&action=...` |
| Full guide | `GET {server}/xmltv.php?username&password` (may be gzipped) |
| Streams | `/live/`, `/movie/`, `/series/`, `/timeshift/` paths above |

Default user agent `VLC/3.0.20 LibVLC/3.0.20`, overridable at setup.

## Adding or changing an endpoint

1. architect writes the change here first (request, response, errors) and links the feature spec.
2. backend implements it, keeping this file exact.
3. A breaking change (renamed field, removed endpoint) bumps the API version and needs an ADR. Additive changes don't.
4. qa adds an e2e or unit case that calls it.

## Change log

| Date | Version | Change | Feature |
| --- | --- | --- | --- |
| 2026-11-01 | 1 | Initial API | F-001–F-018 |
| 2026-11-01 | 1 (additive, planned) | Stalker login in `/api/setup`; `provider_type`, `mac_hint` in `/api/status`; wider `/play` IDs | F-036 |
