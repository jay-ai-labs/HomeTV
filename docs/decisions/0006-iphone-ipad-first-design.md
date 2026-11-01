# ADR-0006 Design for iPhone and iPad first

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner
- Related: F-015, F-016, F-017

## Context
The household watches mostly on iPhones and iPads, often from the Home Screen. Apple TV can't run a web app at all, and the Fire TV is served by TiviMate until the Phase 3 app.

## Decision
Every screen is designed and tested first at iPhone portrait (≤700 px) and iPad (701–1180 px), touch-first, with safe areas and Home Screen standalone mode. Desktop and TV-size layouts (>1180 px, remote/keyboard) must keep working, but come second.

## Consequences
- Good: the most-used devices get the best experience; design tokens carry over to the SwiftUI app.
- Cost: TV-browser polish waits for the native TV apps.
- Every UI change is checked at iPhone portrait and iPad landscape sizes (definition of done).
