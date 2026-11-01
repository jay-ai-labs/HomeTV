# ADR-0011 An orchestrator agent leads the work, and `.claude/` is the only harness copy

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner
- Related: ADR-0007, docs/02-agentic-harness.md

## Context
The owner wants work to run in parallel, with a lead that can start several backend and frontend engineers. The main session had no agent definition of its own, so it had no fixed model or parallel rules. The harness also existed twice, in `harness/` and in `.claude/`.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Lead as a subagent | Nesting is supported | The owner talks to it indirectly; harder for it to stop and ask |
| Lead as the main session | The owner talks to it directly; it can start the role agents | Loads for every session in this project |
| Extra files such as `backend-2.md` | None; each launch already creates a new instance | Duplicated rules that drift |

## Decision
Add an `orchestrator` agent on Opus 5.5 and make it the project's default main session (`"agent": "orchestrator"` in `.claude/settings.json`). It may start copies of the five role agents, up to 4 engineers at once, using git worktrees. `.claude/` is the only harness copy, committed to git; `harness/` is removed.

Models: orchestrator Opus 5.5; architect, backend, frontend and qa Sonnet; docs-keeper Haiku.

## Consequences
- Good: faster builds on independent work, one place to edit the harness, and consistent rules for every session.
- Cost: parallel runs spend more tokens at once, and the lead has to merge results.
- Parallel work needs git and a first commit; until then the orchestrator works sequentially.
- If remote tools can't write to `.claude/`, harness edits must be made in Claude Code on the PC.
