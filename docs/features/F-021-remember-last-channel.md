# F-021 Open on the last channel or screen used

| Field | Value |
| --- | --- |
| Status | Ready |
| Priority | P1 |
| Area | H W |
| Milestone | M4 |
| Owner agents | architect → backend → frontend → qa → docs-keeper |
| Created | 2026-11-01 |

## Problem
Opening HomeTV from the Home Screen always lands on Home. Most of the time the family just wants the channel they were watching.

## Outcome
A setting "When HomeTV opens" with **Home** (default) or **Last channel**. With Last channel, the app opens Live TV with the last channel playing (iPad, desktop) or ready to tap (iPhone, where autoplay with sound is blocked).

## Acceptance criteria
- [ ] Settings has "When HomeTV opens: Home / Last channel", saved per device (localStorage)
- [ ] The last channel is shared across devices through the helper (`recent[0]` already exists)
- [ ] iPad/desktop: Live TV opens with the last channel in preview
- [ ] iPhone portrait: Live TV opens scrolled to the last channel with a "Resume <channel>" button
- [ ] If the channel no longer exists, the app falls back to Home without an error

## Design notes (architect)
- API: no change. `GET /api/userdata` already returns `recent` (newest first), updated by `/play/live/{id}`.
- Data: no change to userdata.json. The per-device preference is localStorage key `openOn` = `home` | `last`.
- UI: Settings → "This device" card. Live TV view gains an optional `startChannel` argument.

## Test plan (qa)
- e2e: set Last channel, play channel 3, reload → Live TV shows channel 3 (desktop) / resume button (iPhone)
- e2e: remove channel from mock, reload → Home, no console errors

## Work log
| Date | Agent | What happened |
| --- | --- | --- |
| 2026-11-01 | architect | Spec written |

## Bugs found
| # | Found by | Description | Fixed in |
| --- | --- | --- | --- |
