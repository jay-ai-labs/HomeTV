# ADR-0009 Neutral graphite background; teal only for accents

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner
- Related: F-031, supersedes the background part of ADR-0008

## Context
ADR-0008 adopted the household app's (Ghar Ledger) dark theme, including its green-black ground (#0B1211) and green-tinted surfaces and text.
On HomeTV, which is mostly dark screens, that tint covers the whole app, and teal-tinted selections and guide blocks add more green. The owner said the green background doesn't look good.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Keep Ghar's green-black | Exact match with the household app | Owner rejected it |
| Neutral graphite, teal for accents only | Artwork and channel logos carry the colour; layers easier to tell apart; keeps Ghar's fonts, accents and components | Background no longer matches Ghar exactly |
| Blue slate or warm charcoal | Some character | At these darknesses the difference from graphite is barely visible; still a tint |

## Decision
Use neutral graphite surfaces (ground #0F1013, surface #1A1C20, surface2 #24272C, surface3 #2E3238; ink #F2F3F5 / #B4B8BF / #868B94; lines #383C43 / #272A2F). Selections and the current programme are neutral grey with a teal edge or ring. Teal is used only for primary buttons, selected chips, progress, the now line and the active tab. Everything else from ADR-0008 stays.

## Consequences
- Good: no colour cast; clearer hierarchy between background, panels and controls.
- Accepted cost: HomeTV's background differs from the household app's.
- Follow-ups: tokens.json and the design spec updated; native apps use these neutrals.
