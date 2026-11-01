---
description: Run the full feature loop (architect → backend → frontend → qa → docs-keeper → commit) for one feature
argument-hint: F-###
---
Build feature $ARGUMENTS using the loop in docs/02-agentic-harness.md. You are the orchestrator: delegate, don't write product code yourself.

1. Read docs/features/FEATURES.md and the spec for $ARGUMENTS. If the spec is missing, stop and suggest /feature-new.
2. Size the change as small, standard or high-risk (rules in .claude/agents/orchestrator.md) and state it. If status is Proposed on a standard or high-risk feature, ask the owner to run `/grill-me` first. Then run the **architect** agent to write design notes, update API/DATA-MODEL docs and any ADR, and set status Ready. Show the owner the design notes and wait for "go" if they include a new dependency, a storage change, a breaking API change or anything irreversible.
3. Set status In progress (docs-keeper). Split the work by owning agent and files. Build shared foundations first, one at a time, then run independent tasks in parallel under the rules in .claude/agents/orchestrator.md. If they can't run in parallel, run **backend**, then **frontend**. Pass each agent the relevant HANDOFF blocks.
4. Merge parallel work one branch at a time. Standard or high-risk: run **code-simplifier** on the changed files, on Sonnet, excluding high-risk code. High-risk: run `/security-review`. Large or high-risk: run `/code-review`. Send findings to the owning agent. All of this finishes before qa.
5. Run **qa** on the merged result. If FAIL, send the bugs to the owning agent and rerun the failed cases, then the full suite. After two failures on the same bug, stop and ask the owner. Any code change after a PASS needs qa again.
6. On PASS, run **docs-keeper**: status Done, CHANGELOG, ROADMAP, work log.
7. Show `git status` and `git diff --stat`, then stage named files only and commit: `$ARGUMENTS: <short summary>`.
8. Finish with a 5-line summary: what was built, tests run, docs updated, anything the owner should check on a real device. Remind the owner to run `/revise-claude-md`, then `/clear`.
