# Architecture decision records

One file per decision that would be costly to reverse or that someone will later ask "why did we do it this way?".
Written by the architect agent with `/adr <title>`, from [0000-template.md](0000-template.md). A decision is never edited after it's accepted: a new ADR supersedes it.

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-home-helper-relays-browser-traffic.md) | A home helper relays all browser traffic to the provider | Accepted | 2026-11-01 |
| [0002](0002-python-standard-library-helper.md) | The helper uses only the Python standard library | Accepted | 2026-11-01 |
| [0003](0003-plain-web-no-build-step.md) | Plain HTML/CSS/JS with no build step for the web client | Accepted | 2026-11-01 |
| [0004](0004-json-files-for-household-data.md) | JSON files for household data until profiles arrive | Accepted | 2026-11-01 |
| [0005](0005-opaque-stream-tokens.md) | Opaque tokens for stream segment URLs | Accepted | 2026-11-01 |
| [0006](0006-iphone-ipad-first-design.md) | Design for iPhone and iPad first | Accepted | 2026-11-01 |
| [0007](0007-agentic-development-harness.md) | Build with a Claude Code agent harness | Accepted | 2026-11-01 |
| [0008](0008-household-design-system.md) | Use the household app's design system (Ghar Ledger), dark theme | Accepted (background superseded by ADR-0009) | 2026-11-01 |
| [0009](0009-neutral-graphite-background.md) | Neutral graphite background; teal only for accents | Accepted | 2026-11-01 |
| [0010](0010-provider-adapters-xtream-and-stalker.md) | Support Stalker (MAC) portals through provider adapters behind the existing API | Accepted | 2026-11-01 |
| [0011](0011-orchestrator-agent-and-single-harness.md) | An orchestrator agent leads the work, and `.claude/` is the only harness copy | Accepted | 2026-11-01 |
| [0012](0012-build-new-code-beside-the-helper.md) | Build new code in `apps/` beside the helper, with no `development/` folder | Accepted | 2026-11-01 |

Status values: Proposed · Accepted · Superseded by ADR-#### · Rejected.
