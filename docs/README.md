# HomeTV documentation

Everything about how HomeTV is designed, built and tracked. Source code is in `../helper/` and `../tools/`, with new code going in `../apps/`. Rules for Claude Code are in `../CLAUDE.md`.

| Need | Go to |
| --- | --- |
| How the web app is built (architecture, stack, milestones) | [01-technical-plan.md](01-technical-plan.md) |
| How Claude agents build it | [02-agentic-harness.md](02-agentic-harness.md) |
| Proposed structure and stack upgrade (FastAPI, React) | [03-development-plan.md](03-development-plan.md) |
| What's done, what's next | [features/FEATURES.md](features/FEATURES.md) · [ROADMAP.md](ROADMAP.md) |
| Helper API contract | [api/API.md](api/API.md) |
| Stored data and database design | [database/DATA-MODEL.md](database/DATA-MODEL.md) |
| Why things are the way they are | [decisions/](decisions/README.md) |
| What actually happened, by session | [devlog/DEVLOG.md](devlog/DEVLOG.md) · [CHANGELOG.md](CHANGELOG.md) |
| Testing | [testing/TEST-PLAN.md](testing/TEST-PLAN.md) |
| Running the helper at home | [operations/RUNBOOK.md](operations/RUNBOOK.md) |
| Design spec, tokens, screenshots | [design/](design/README.md) (moved from the repo root) |

## How tracking works

| Thing | Tracked in | ID | Updated by | When |
| --- | --- | --- | --- | --- |
| Feature | `features/FEATURES.md` + one spec per feature | F-### | docs-keeper (status), architect (design) | Created with `/feature-new`; status changes through the loop |
| API endpoint | `api/API.md` + its change log | API version | architect (contract), backend (sync) | Same commit as the code |
| Stored data | `database/DATA-MODEL.md` + its change log | `schema_version` | architect, backend | Same commit as the code, with a migration |
| Decision | `decisions/NNNN-*.md` + index | ADR-#### | architect | `/adr` whenever a real choice is made |
| Development history | `devlog/DEVLOG.md` | date | docs-keeper | End of every session (`/devlog`) |
| User-visible change | `CHANGELOG.md` | version | docs-keeper | When a feature is Done |
| Milestone progress | `ROADMAP.md` | M# | docs-keeper | When a feature is Done |

Commit messages carry the IDs (`F-021: open on last channel`, `ADR-0008: move to SQLite`), so `git log` links code to docs.

The cloud copies (the architecture plan and the clickable prototype in Claude) are snapshots for review. This folder is the source of truth.
