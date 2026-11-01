# ADR-0013 Harness tooling and precedence

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner
- Related: ADR-0007, ADR-0011

## Context
The owner chose these development-only tools: grill-me, graphify, Superpowers, claude-mem, context-mode, frontend-design and code-simplifier. Also in use are Anthropic's design skills, claude-md-management, and the built-in /security-review and /code-review.

Several overlap with the orchestrator loop (ADR-0011) and with each other, so precedence has to be written down. None of them ship in the product. Golden rule 4 on runtime dependencies is unchanged.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Replace the orchestrator with Superpowers workflows | One well-known workflow | Two competing loops, loses our spec/status/work-log records |
| Keep memory only in repo records | Nothing extra to install, fully reviewable | Weak search across past sessions |
| Install the full mattpocock-skills plugin | Gets grill-me with no copying | Overlaps Superpowers |
| Orchestrator stays, tools added with limits (chosen) | One workflow, useful aids kept | More moving parts |

## Decision
1. The orchestrator loop stays the one workflow. The harness beats any skill text. The CLAUDE.md "Tools and precedence" table settles overlaps.
2. Superpowers contributes only TDD (backend), systematic debugging and verification. Eight workflow skills are denied in settings: brainstorming, writing-plans, executing-plans, subagent-driven-development, dispatching-parallel-agents, using-git-worktrees, finishing-a-development-branch, requesting-code-review.
3. grill-me is a vendored MIT copy in `.claude/skills/grill-me`, because the full plugin overlaps Superpowers.
4. graphify is a local CLI, without its CLAUDE.md section or PreToolUse hook. Code graph only; `graphify-out/` is ignored.
5. claude-mem covers main sessions only, with redaction on (including MAC addresses and stream URLs), Chroma off, telemetry off and no cloud sync. It is a search aid, not the source of truth. It needs Bun on the machine.
6. context-mode's sandbox tools go to backend, frontend and qa as a trial, decided by the owner on 2026-11-01 (previously qa only). Keep the helper/data guard hook active. The trial covers the iPhone guide fix and the /api/status stall investigation: compare /ctx-stats with the added start-up cost (about 4,900 tokens per agent), and keep it only if the saving is clearly larger. Architect stays out because it has no shell on purpose. Backend and frontend already have Bash, so the sandbox adds little new capability. It is under the Elastic License 2.0, acceptable for private household use.
7. Changes are sized small, standard or high-risk. High-risk work gets /security-review and /code-review. code-simplifier runs once on Sonnet and skips high-risk code.

## Consequences
- Good: one workflow, with the useful tools kept and bounded; the repo records stay the source of truth.
- Bad / accepted cost: more moving parts per machine.
- Bad / accepted cost: plugin hooks run third-party code on tool calls.
- Bad / accepted cost: the guard hook matches command text, so it is a safety net and not a sandbox.
- Bad / accepted cost: design: and engineering: skills depend on the owner's claude.ai account.
- Follow-ups: keep the CLAUDE.md "Tools and precedence" table in step with this ADR; a new tool or a change to the denied list needs a new ADR.
