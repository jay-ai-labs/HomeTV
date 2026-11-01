# Feature register

The single list of every HomeTV feature and where it stands. docs-keeper keeps it current. Each feature with work left has a spec in this folder (`F-###-short-name.md`, from [_template.md](_template.md)).

**Status values:** Proposed → Ready (designed by architect) → In progress → In review (QA) → Done · or Dropped.
**Priority:** P0 must have now · P1 next · P2 later · P3 nice to have.
**Area:** H = helper (backend), W = web client (frontend), T = tests/tools, D = docs/design.

Last updated: 2026-11-01

F-034 and F-035 are reserved for the FastAPI backend and the React client in [03-development-plan.md](../03-development-plan.md).

## Done (Phase 1 baseline, 2026-11-01)

| ID | Feature | Area | Status | Tests |
| --- | --- | --- | --- | --- |
| F-001 | Provider login, validation and account status | H W | Done | e2e: setup, settings |
| F-002 | Live TV: groups, channel list, now playing, progress | H W | Done | e2e: live |
| F-003 | Channel preview (tap once preview, again full screen) | W | Done | e2e: live preview |
| F-004 | Full-screen player with OSD, channel up/down | W | Done | e2e: player, zapping |
| F-005 | TV guide grid with now line and info panel | H W | Done | e2e: guide |
| F-006 | Catch-up (timeshift) with provider time-zone conversion | H W | Done | e2e: catch-up |
| F-007 | Movies: categories, posters, detail page, play | W | Done | e2e: movies |
| F-008 | Series: seasons, episodes, next episode | W | Done | e2e: series |
| F-009 | Continue watching, synced across devices | H W | Done | e2e: progress saved |
| F-010 | Favorites (channels, movies, series), synced | H W | Done | e2e: favorites |
| F-011 | Hide groups, synced | H W | Done | manual |
| F-012 | Search across channels, movies and series | W | Done | e2e: search |
| F-013 | Playback fallback (HLS → MPEG-TS), reconnect, provider error messages, Open in VLC | H W | Done | e2e: blocked channel, TS |
| F-014 | Remote and keyboard spatial navigation, Back closes layers | W | Done | e2e: keyboard |
| F-015 | Home screen: featured hero, On now, Continue watching, rows | W | Done | e2e: home |
| F-016 | iPhone/iPad-first responsive layouts and safe areas | W D | Done | e2e: phone; screenshots |
| F-017 | Add to Home Screen (manifest, icons, standalone mode) | W | Done | device checklist |
| F-018 | Settings: account, devices in use, refresh, stream format | H W | Done | e2e: settings |
| F-031 | Design-system alignment: the household app's system (Ghar Ledger), dark theme ([ADR-0008](../decisions/0008-household-design-system.md)) | W D | Done | e2e: full suite; screenshots at all sizes |

## Backlog

| ID | Feature | Area | Priority | Status | Milestone | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| F-036 | **Stalker (MAC address) portal support**: the household's provider is portal URL + MAC only | H W T | P0 | In progress (UI done; helper adapter next) | M2 (first) | [spec](F-036-stalker-mac-portal.md) |
| F-019 | Real-provider hardening: test on 6 devices, fix differences, extend mock (needs F-036) | H W T | P0 | Ready | M2 | [spec](F-019-real-provider-hardening.md) |
| F-020 | Helper always on: Windows auto-start verified, Synology Docker verified | H D | P0 | Proposed | M2 | to write |
| F-021 | Open on the last channel or screen used | H W | P1 | Ready | M4 | [spec](F-021-remember-last-channel.md) |
| F-022 | Phone player fills the screen in landscape | W | P1 | Proposed | M4 | to write |
| F-023 | Local HTTPS so Android/desktop can fully install the app | H D | P2 | Proposed | later | to write |
| F-024 | Profiles: favorites and history per family member | H W | P2 | Proposed | M6 | to write |
| F-025 | Parental PIN for chosen groups/channels | H W | P2 | Proposed | M6 | to write |
| F-026 | Multiview: 2–4 channels at once | W | P2 | Proposed | M6 | to write |
| F-027 | Guide re-matching for channels with missing/wrong guide | H W | P3 | Proposed | later | to write |
| F-028 | Programme reminders | W | P3 | Proposed | later | to write |
| F-029 | M3U playlist providers (third adapter, ADR-0010) | H | P3 | Proposed | later | to write |
| F-030 | Optional household PIN for the helper | H W | P2 | Proposed | M6 | to write |
| F-032 | Split the helper into modules + unit tests (no behaviour change) | H T | P1 | Proposed | M3 | to write |
| F-033 | Split app.js into ES modules (no behaviour change) | W | P1 | Proposed | M4 | to write |

## Dropped

| ID | Feature | Reason |
| --- | --- | --- |
| none yet | | |
