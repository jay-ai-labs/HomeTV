# ADR-0001 A home helper relays all browser traffic to the provider

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner, architect
- Related: F-001, F-013

## Context
Xtream providers serve APIs and streams over plain `http://` and send no CORS headers. A browser page can't call them from another origin, and an `https://` page may not load `http://` media at all. The provider password would also have to sit on every device, and appear in every stream URL.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Browser talks to provider directly | No extra software | Blocked by CORS and mixed content; password on every device |
| Cloud relay | Nothing at home | Providers block data-centre IPs and count each IP as a device; streams double the bandwidth |
| Home helper on the LAN | Same IP as the household; holds the password; can rewrite playlists | Needs an always-on PC or NAS |

## Decision
A small helper on the home network serves the web client and relays every API call and stream to the provider.

## Consequences
- Good: works in every browser; one login for all devices; the helper also caches lists and the guide and stores shared data.
- Cost: the PC or NAS must be on while watching. Native apps (Phases 2–3) talk to the provider directly and use the helper only for sync.
- Follow-ups: F-020 (always-on helper), F-030 (optional PIN).
