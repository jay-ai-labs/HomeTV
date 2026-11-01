# Changelog

User-visible changes, newest first ([Keep a Changelog](https://keepachangelog.com/) style). docs-keeper adds a line under **Unreleased** for every Done feature. A release moves those lines under a version and date.

## Unreleased
### Changed
- New look from the household app's design system (Ghar Ledger), dark theme: Figtree and Archivo fonts, teal accent, saffron catch-up, its buttons, chips, tab bar and bottom sheets (F-031).
- Neutral graphite background instead of the household app's green-black; selected rows and the current guide programmes are neutral grey with a teal edge (F-031, ADR-0009).
- Development agents: new skills, small, standard and high-risk change sizes, and a guard hook for the helper/data folder. No app change (ADR-0013).

## 0.2.0 — 2026-11-01
### Added
- Home screen with featured hero, On now in favorites, Continue watching and category rows (F-015).
- iPhone and iPad-first layouts: bottom tabs on iPhone, side rail on iPad, safe areas, Home Screen mode (F-016, F-017).
- Full-screen movie and series detail pages; guide info panel.

## 0.1.0 — 2026-11-01
### Added
- Home helper: provider login, API proxy with caching, stream relay with HLS rewrite, XMLTV guide, shared user data (F-001, F-013).
- Web client: Live TV with preview, player with zapping, TV guide, catch-up, movies, series, continue watching, favorites, hidden groups, search, settings, remote/keyboard navigation (F-002–F-014, F-018).
- Windows launcher and auto-start scripts; Docker files for a NAS.
