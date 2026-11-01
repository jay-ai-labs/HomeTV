# ADR-0005 Opaque tokens for stream segment URLs

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner, architect
- Related: F-013

## Context
HLS playlists list segment URLs that often embed the username and password, or provider tokens. The client must fetch every segment through the helper, so the rewritten URLs must not reveal the upstream URL, and the helper must not become an open proxy.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Base64 of the upstream URL | Stateless | Anyone on the LAN can decode the password; open proxy |
| Signed upstream URL (HMAC) | Stateless, not an open proxy | URL still readable |
| Random token → URL map in memory | Reveals nothing; only URLs the helper produced work | Tokens die on restart (players re-request the playlist) |

## Decision
Random 12-byte URL-safe tokens map to upstream URLs in memory (max 30,000, least recently used evicted). `/t/{token}` relays only mapped URLs.

## Consequences
- Good: devices never see credentials; no open proxy.
- Cost: a helper restart mid-stream causes a short reconnect (handled by the client's retry).
