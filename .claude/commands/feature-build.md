---
description: Run the full feature loop (architect → backend → frontend → qa → docs-keeper → commit) for one feature
argument-hint: F-###
---
Build feature $ARGUMENTS using the loop in docs/02-agentic-harness.md. You are the orchestrator: delegate, don't write product code yourself.

1. Read docs/features/FEATURES.md and the spec for $ARGUMENTS. If the spec is missing, stop and suggest /feature-new.
2. If status is Proposed: run the **architect** agent to write design notes, update API/DATA-MODEL docs and any ADR, and set status Ready. Show the owner the design notes and wait for "go" if they include a new dependency, a storage change, a breaking API change or anything irreversible.
3. Set status In progress (docs-keeper). Split the work by owning agent and files. Build shared foundations first, one at a time, then run independent tasks in parallel under the rules in .claude/agents/orchestrator.md. If they can't run in parallel, run **backend**, then **frontend**. Pass each agent the relevant HANDOFF blocks.
4. Merge parallel work one branch at a time, then run **qa** on the merged result. If FAIL, send the bugs to the owning agent and run qa again. After two failures on the same bug, stop and ask the owner.
5. On PASS, run **docs-keeper**: status Done, CHANGELOG, ROADMAP, work log.
6. Show `git status` and `git diff --stat`, then commit: `$ARGUMENTS: <short summary>`.
7. Finish with a 5-line summary: what was built, tests run, docs updated, anything the owner should check on a real device.
