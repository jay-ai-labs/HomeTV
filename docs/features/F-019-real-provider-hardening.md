# F-019 Real-provider hardening

| Field | Value |
| --- | --- |
| Status | Ready |
| Priority | P0 |
| Area | H W T |
| Milestone | M2 |
| Owner agents | owner (real tests) → backend / frontend (fixes) → qa (mock coverage) → docs-keeper |
| Depends on | F-036 (the household's provider is a Stalker/MAC portal) |
| Created | 2026-11-01 |

## Problem
HomeTV has only been tested against the mock provider. Real Xtream servers differ: redirects to load balancers, missing guide IDs, odd containers (mkv), AC-3 audio, tight device limits.

## Outcome
HomeTV works with the household's real provider on iPhone, iPad, Android phone, Android tablet, Fire tablet and Fire TV (Silk), and every real-world difference is covered by the mock so it can't regress.

## Acceptance criteria
- [ ] Owner logs in on the helper with the portal URL + MAC (F-036) and channel count matches what iSTB shows
- [ ] Owner notes whether iSTB on another device gets logged out while HomeTV plays (one session per MAC)
- [ ] 10 live channels across 3 groups start in under 3 s on iPhone and iPad (time recorded in DEVLOG)
- [ ] Guide shows now/next for at least 90% of favorite channels
- [ ] One catch-up programme plays from the start
- [ ] One movie and one episode play, resume works on a second device
- [ ] Device-limit error shows the friendly message when a third device starts
- [ ] Every failure found is written below as a bug, fixed, and reproduced in mock_provider.py

## Design notes (architect)
- No credentials, hosts or channel names from the real provider go into the repo. Bugs are described generically ("playlist uses absolute URLs on a second host").
- Owner shares only sanitised samples (for example a playlist with hosts replaced by `example.net`).

## Test plan (qa)
- Device checklist in docs/testing/TEST-PLAN.md on all 6 devices
- New mock cases for each bug found

## Work log
| Date | Agent | What happened |
| --- | --- | --- |
| 2026-11-01 | architect | Spec written |

## Bugs found
| # | Found by | Description | Fixed in |
| --- | --- | --- | --- |
