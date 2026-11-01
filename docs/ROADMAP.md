# Roadmap

Milestones for the web app (details in the [technical plan](01-technical-plan.md#11-milestones-web-app)). docs-keeper updates the Status and Progress columns; the owner changes order or scope.
Last updated: 2026-11-01

| # | Milestone | Features | Status | Progress |
| --- | --- | --- | --- | --- |
| M0 | Phase 1 baseline | F-001–F-018 | Done | 18/18 |
| M1 | Repo and agent harness | (process) | In progress | Harness installed, repo pushed, `development/` removed (ADR-0012); e2e assertions and CI pending |
| M2 | Real-provider support and hardening | **F-036** (Stalker/MAC portal), F-019, F-020 | Next | 0/3 |
| M3 | Helper modules + unit tests | F-032 | Planned | 0/1 |
| M4 | Client modules + Home Screen polish | F-021, F-022, F-033 | Planned | 0/3 |
| M5 | Design-system alignment | F-031 | Done (ADR-0008) | 1/1 |
| M6 | Household features | F-024, F-025, F-026, F-030 | Planned | 0/4 |

After the web app: Phase 2 Apple apps (SwiftUI) and Phase 3 Fire TV/Android (Kotlin). See the [architecture plan in Claude](https://claude.ai/artifact/4Xf4vGCUHqP5AoPDFoqPAb).

## Current focus
M1 → M2. Next feature to build: **F-036 Stalker (MAC) portal support**. The household's provider is portal URL + MAC only, so nothing can be tested for real until it lands. Then F-019 (needs the owner on the real provider).
