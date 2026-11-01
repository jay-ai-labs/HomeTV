# F-036 Stalker (MAC address) portal support

| Field | Value |
| --- | --- |
| Status | Ready |
| Priority | **P0: blocks all real use.** The household's provider is a Stalker portal (portal URL + MAC address, no username/password) |
| Area | H W T |
| Milestone | M2 (first feature, before F-019) |
| Owner agents | architect → backend → frontend → qa → docs-keeper |
| Decision | [ADR-0010](../decisions/0010-provider-adapters-xtream-and-stalker.md) |
| Created | 2026-11-01 |

## Problem
HomeTV only speaks Xtream Codes (server + username + password). The household's subscription is a Stalker/MAG portal: in iSTB it was set up with only a **portal URL and a MAC address**. HomeTV can't log in, so none of its features can be used or tested with the real provider.

## Outcome
In the HomeTV setup screen the owner chooses **"MAC portal (Stalker)"**, enters the portal URL and MAC address, and gets the same Live TV, guide, catch-up, movies, series, favorites and continue watching as with Xtream. Devices never see the MAC.

## Acceptance criteria
- [ ] Setup offers two login types: "Username and password (Xtream Codes)" and "MAC portal (Stalker)". The Stalker form asks for portal URL and MAC address, with advanced fields for serial number, device ID 1/2, signature and time zone (all optional).
- [ ] The MAC is validated (`XX:XX:XX:XX:XX:XX`, hex; dashes or lower case accepted and normalised to upper case with colons); a wrong format shows an inline error before any network call.
- [ ] The portal URL is accepted in the forms providers hand out: `http://host:port/c/`, `http://host:port/stalker_portal/c/`, `http://host:port/portal.php`, `http://host:port/`. The helper finds the working API endpoint itself.
- [ ] Wrong MAC / unregistered device: setup fails with "The portal didn't accept this MAC address", and nothing is saved.
- [ ] Live TV shows the portal's genres as groups, channels with logos and numbers, and plays channels on iPhone, iPad and desktop (mock).
- [ ] The guide shows now/next and the grid for channels that have guide data; catch-up plays where the portal marks archive.
- [ ] Movies and series categories, details and playback work, including seasons/episodes; resume works.
- [ ] Settings shows provider type "MAC portal", account status and expiry when the portal reports them, and never shows the MAC in full (only the last 2 bytes, e.g. `…:A1:B2`).
- [ ] The session token is renewed automatically when it expires (the portal answers with an auth error, then a fresh handshake succeeds), with no user action.
- [ ] Xtream logins still work exactly as before (full e2e suite on the Xtream mock stays green).
- [ ] `config.json` never leaves the helper; the MAC isn't logged, isn't in any API response, and isn't in URLs given to devices.

## Design notes (architect)

### Approach: provider adapters behind the existing API ([ADR-0010](../decisions/0010-provider-adapters-xtream-and-stalker.md))
- The helper gets a `providers` layer with one interface and two adapters: `XtreamProvider` (today's code, moved) and `StalkerProvider` (new).
- **The web client keeps calling the same `/api/x?action=...` and `/play/...` endpoints.** The Stalker adapter translates each action into portal calls and returns **Xtream-shaped JSON** (same field names the client already reads). Client changes are limited to the setup form, Settings, and episode IDs (below).
- Built on the current stdlib helper in M2 (needed for real-provider testing). The adapter is plain Python with no HTTP-framework code, so M3 (FastAPI, `apps/api/src/hometv_api/providers/`) moves it as-is and swaps `urllib` for `httpx`.

### Stalker portal protocol (to verify against the real portal; providers vary)
All calls: `GET {api}?type=...&action=...&JsHttpRequest=1-xml`, where `{api}` is discovered from the portal URL by trying, in order, `{base}/server/load.php`, `{base}/stalker_portal/server/load.php` and `{base}/portal.php`, after stripping a trailing `/c/`. Responses are `{"js": ...}`.

Headers on every call:
- `User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3`
- `X-User-Agent: Model: MAG250; Link: WiFi`
- `Cookie: mac=<MAC>; stb_lang=en; timezone=<tz>`
- `Authorization: Bearer <token>` after the handshake
- `Referer: {base}/c/`

| HomeTV need | Portal call | Notes |
| --- | --- | --- |
| Session | `type=stb&action=handshake&token=` → `js.token` (some portals also return `js.random`) | Re-run on any auth error; one in-flight handshake at a time (lock) |
| Device profile / status | `type=stb&action=get_profile&hd=1&sn=<serial>&stb_type=MAG250&device_id=<id1>&device_id2=<id2>&signature=<sig>&ver=...` | Serial and device IDs default to values derived from the MAC (serial = first 13 hex chars of MD5(MAC), upper case; device IDs = SHA-256(MAC) hex, upper case). Owner can override in Advanced |
| Account / expiry | `type=account_info&action=get_main_info` | Map to `user_info.status`, `exp_date`; missing fields → "Unknown" |
| Live groups | `type=itv&action=get_genres` | → `get_live_categories` (`category_id` = genre `id`, `category_name` = `title`; skip the "All" genre `*`) |
| Live channels | `type=itv&action=get_all_channels` (fallback: `get_ordered_list&genre=*&p=N` paginated) | → `get_live_streams`: `stream_id` = `id`, `num` = `number`, `name`, `stream_icon` = `logo` (resolve relative to portal), `category_id` = `tv_genre_id`, `epg_channel_id` = `"s:" + id`, `tv_archive` = `tv_archive` or `archive`, `tv_archive_duration` = `tv_archive_duration` (days). Keep `cmd` server-side only |
| Play live | `type=itv&action=create_link&cmd=<channel cmd>&forced_storage=undefined&disable_ad=0` → `js.cmd` like `ffmpeg http://...` | Strip the `ffmpeg `/`auto ` prefix; links are short-lived, so create one per play; relay through the existing token map |
| Guide | `type=itv&action=get_epg_info&period=<hours>` (all channels), fallback `type=itv&action=get_short_epg&ch_id=<id>&size=10` | Feed the existing guide index keyed `"s:" + channel id`; `start_timestamp`/`stop_timestamp`, `name`, `descr` |
| Catch-up | Programme `id` from the guide, then `type=tv_archive&action=create_link&cmd=auto /media/<prog_id>.mpg` | Only where the guide item has `mark_archive=1`. `/play/timeshift/{id}` maps start time → programme id via the guide index |
| Movie groups | `type=vod&action=get_categories` | → `get_vod_categories` |
| Movies | `type=vod&action=get_ordered_list&category=<id>&p=N&sortby=added` (paginated, usually 14 per page) | → `get_vod_streams`; fetch pages concurrently (max 4) and cache 30 min; `container_extension` from `cmd` or default `mp4` |
| Movie details | the list item itself (`description`, `director`, `actors`, `year`, `rating_imdb`, `screenshot_uri`) | → `get_vod_info` shape |
| Play movie | `type=vod&action=create_link&cmd=<movie cmd>` | Same as live |
| Series | `type=series&action=get_categories` / `get_ordered_list` (or vod items with `is_series=1`, depending on portal) | → `get_series_categories` / `get_series` |
| Seasons / episodes | `get_ordered_list&movie_id=<id>` → seasons; `&season_id=<sid>` → episodes | → `get_series_info` (`episodes` keyed by season number) |
| Play episode | `type=vod&action=create_link&cmd=<season cmd>&series=<episode number>` | Needs a composite episode ID (below) |

### API changes (docs/api/API.md, marked "F-036, not built yet")
- `POST /api/setup` accepts `{"type": "stalker", "portal": "...", "mac": "...", "serial": "", "device_id": "", "device_id2": "", "signature": "", "timezone": ""}`. A missing `type` means `"xtream"` (backward compatible).
- `GET /api/status` adds `provider_type` (`"xtream"` | `"stalker"`) and `mac_hint` (last 2 bytes, Stalker only). `username` is omitted for Stalker.
- `/play/{kind}/{id}.{ext}`: `id` widens from digits to `[A-Za-z0-9_-]{1,64}`. Stalker episode IDs are `"{series_id}_{season_id}_{episode}"`. Xtream IDs are unchanged.
- `/play/timeshift/{id}` keeps `start` and `dur`; the Stalker adapter resolves the programme from `start`.
- No other endpoint changes. Additive, so the API stays version 1.

### Data changes (docs/database/DATA-MODEL.md)
- `config.json` gains `"type"` (absent = `"xtream"`) and, for Stalker: `portal` (as entered), `api` (discovered endpoint), `mac`, `serial`, `device_id`, `device_id2`, `signature`, `timezone`, `user_agent`. The token isn't persisted.
- `userdata.json`: no shape change. Stalker IDs are strings like the Xtream ones. Switching provider type keeps favorites, but they may not match the new provider's IDs. Settings warns about this.

### UI
- Setup screen: a two-option segmented control at the top: "Username and password" / "MAC portal". The MAC field uses a monospace font, `autocapitalize="characters"`, a placeholder `00:1A:79:00:00:00`, and inline validation. Help text: "The portal URL and MAC address your provider gave you, the same ones you entered in iSTB."
- Settings → Provider: "MAC portal · …:A1:B2", account status and expiry.
- Everything else is unchanged.
- **Designed and built in the client (2026-11-01):** see [design/README.md#provider-login-f-036](../design/README.md#provider-login-f-036) and `docs/design/screenshots/*-setup-*.jpg`. `helper/web` sends the setup body above (`type` is always sent; Xtream bodies are unchanged otherwise), shows `provider_type`/`mac_hint` in Settings, and hides "Watching now" when `max_connections` is absent. A helper without F-036 answers a Stalker setup with "server address" errors; the client shows "This HomeTV helper can't connect to MAC portals yet..." instead.

### Household constraint to tell the owner
Stalker portals usually allow **one active session per MAC**. HomeTV, iSTB and any MAG box using the same MAC can log each other out, and the household may get only one stream at a time. Options: use HomeTV instead of iSTB, ask the provider for a second MAC, or ask for Xtream credentials (many providers issue both).

### Mock
backend adds `development/tools/mock_stalker.py` (port 9002), reusing the Xtream mock's media. It must:
- check the `mac` cookie and the Bearer token, and return an auth error after a configurable token lifetime to test renewal;
- serve genres, channels with relative logo paths, a guide with `mark_archive`, paginated VOD (14 per page), series with seasons/episodes, and `create_link` returning `ffmpeg http://127.0.0.1:9002/...` with single-use play tokens;
- reject one MAC as unregistered, and include one channel whose link returns 403.

## Test plan (qa)
- e2e: run the whole suite twice, once against the Xtream mock and once against the Stalker mock (setup with `00:1A:79:12:34:56`), via an env switch in e2e_test.js.
- e2e: wrong MAC format → inline error, no network call; unregistered MAC → error, nothing saved.
- e2e: token expiry mid-session → next channel still plays.
- Unit (after M3, or with the adapter now): MAC normalisation, serial/device-ID derivation, API endpoint discovery, `cmd` prefix stripping, episode ID encode/decode, timeshift start → programme lookup.
- Real portal: owner only, following F-019. Record channel count, time to first frame, and whether iSTB gets logged out.

## Work log
| Date | Agent | What happened |
| --- | --- | --- |
| 2026-11-01 | architect | Spec written after the owner confirmed the provider login is portal URL + MAC only |
| 2026-11-01 | frontend (design chat) | Setup screen (login type, MAC field with formatting and inline validation, one-device notice, Advanced fields, switching notice) and Settings provider card built in `helper/web` and the prototype. Tested: Xtream setup still works against the current helper and mock; Stalker setup on the current helper shows the "can't connect to MAC portals yet" message; e2e green. Helper adapter, mock_stalker.py and the e2e Stalker run are still to do |

## Bugs found
| # | Found by | Description | Fixed in |
| --- | --- | --- | --- |
