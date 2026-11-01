# ADR-0010 Support Stalker (MAC) portals through provider adapters behind the existing API

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner, architect
- Related: F-036, F-019, F-029, ADR-0001, docs/03-development-plan.md

## Context
The household's provider is a Stalker/MAG portal: the login is a portal URL and a MAC address, with no Xtream username or password. HomeTV only speaks Xtream Codes, so it can't be used or tested with the real provider at all. Stalker differs from Xtream in almost every call: a token handshake, MAG-box headers, genres instead of categories, paginated VOD, and short-lived stream links created per play.
The approved stack upgrade (03-development-plan.md) moves the helper to FastAPI in M3 and plans a `providers/` package.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Stalker-specific endpoints and client code | Exposes every Stalker feature | Two code paths in the client; doubles UI testing |
| Adapter per provider, translating to the Xtream-shaped responses the client already uses | Client barely changes; one e2e suite runs against both mocks; M3/F-029 slot in naturally | Some Stalker-only extras are not exposed; translation must be kept accurate |
| Wait for the FastAPI rewrite (M3) and add Stalker there | Written once | Real-provider testing (M2) is blocked for weeks; the household can't use HomeTV |

## Decision
Add a provider interface with `XtreamProvider` and `StalkerProvider` adapters. The helper's API stays the same (additive changes only): `/api/x` actions and `/play` paths are answered by whichever adapter `config.json` selects. Build it now on the current helper as the first M2 feature, as framework-free Python, so M3 moves the adapters into `apps/api/src/hometv_api/providers/` unchanged apart from the HTTP library.

## Consequences
- Good: the household can use and test HomeTV with its real provider; M3 and M3U (F-029) reuse the same interface.
- Cost: the Stalker protocol varies by portal, so endpoint discovery, header sets and fallbacks are needed, plus a second mock (`mock_stalker.py`).
- Household constraint: portals usually allow one session per MAC, so HomeTV and iSTB may log each other out. The owner may ask the provider for a second MAC or for Xtream credentials.
- `/play` IDs widen to `[A-Za-z0-9_-]{1,64}` for composite Stalker episode IDs.
