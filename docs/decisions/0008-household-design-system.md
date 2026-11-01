# ADR-0008 Use the household app's design system (Ghar Ledger), dark theme

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner
- Related: F-031, ADR-0006

## Context
HomeTV had its own look (ink blue, amber, Bricolage + Atkinson). The owner wants it to match the family's other app.
The owner first asked for "Noctrane", then "Nocturne", then "the org's default design system inside Claude", and finally "the design system used by the household app".
No design system by those names, and no organisation default, is visible from Claude: the account has only two empty "Design System" artifacts.
The household app is taken to be **Ghar Ledger** (home finance app; prototype https://claude.ai/artifact/Wjqnp9enX3cSCpKMSD4MdG), which defines a complete token set with light and dark themes.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Keep HomeTV's own look | Already built and tested | Doesn't match the family's other app |
| Ghar Ledger, dark theme | Same fonts, colours and components as the household app; dark suits watching TV | Ghar is a phone-only app: HomeTV has to extend it (side rail, TV focus, artwork) |
| Ghar Ledger, light and dark | Closest match | A light video app is uncomfortable in a dark room; twice the screens to test |
| Wait for an org design system | Might be the "official" one | Not available; blocks work |

## Decision
Use Ghar Ledger's dark theme, with its token names, fonts (Figtree, Archivo) and components (button, chip, tab bar, bottom sheet, toast). HomeTV adds only what a video app needs: a side rail styled like the tab bar, a teal focus ring for remotes, poster artwork, and one extra surface step (`surface3`).

## Consequences
- Good: one visual language across the household's apps; tokens carry over to the SwiftUI and Compose apps (`design/tokens.json`).
- Accepted cost: no light theme; the ambient artwork glow from the previous design is gone.
- Follow-ups: if an organisation design system later appears in Claude, compare it with this one and write a new ADR if HomeTV should move. Delete the unused Atkinson/Bricolage fonts during the M1 move.
