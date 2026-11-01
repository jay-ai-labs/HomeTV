# ADR-0007 Build with a Claude Code agent harness

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner
- Related: docs/02-agentic-harness.md

## Context
Development is done mostly by Claude in the Claude Code CLI on the owner's PC. One long session that does everything loses track of design, tests and documentation; several uncoordinated sessions edit the same files.

## Decision
Use role agents (architect, backend, frontend, qa, docs-keeper) defined in `.claude/agents/`, coordinated by the main session through slash commands. Each agent owns specific folders. Every feature follows the same loop: spec, design, build, test, document, commit.

## Consequences
- Good: tracking (features, API, data model, decisions, devlog) stays current as a side effect of the loop.
- Cost: more steps per feature; small fixes can skip straight to the owning agent plus qa.
- Rules live in CLAUDE.md and the agent files; changing them is a docs change reviewed by the owner.
