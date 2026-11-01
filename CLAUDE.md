# HomeTV: instructions for Claude Code

HomeTV is a private IPTV player for one household. It uses an Xtream Codes login and supplies no content.
Current focus: the **web app** (home helper + web client), iPhone and iPad first. Native Apple and Android apps come later.
**The household's provider is a Stalker/MAG portal (portal URL + MAC address, no username/password).** Supporting it is F-036, the first M2 feature ([ADR-0010](docs/decisions/0010-provider-adapters-xtream-and-stalker.md)). The MAC is a credential: same rules as the password.

Read only what your role's "Read first" list names, plus the current feature spec. `docs/README.md` explains how tracking works; `docs/01-technical-plan.md` and `docs/02-agentic-harness.md` are reference, not start-up reading.

## Token use

- This file loads automatically. Don't read it again.
- Search before reading. `helper/web/app.js`, `helper/web/app.css`, `helper/server.py` and `tools/e2e_test.js` are large: Grep for the symbol, then Read only that range. Don't re-read a file you just edited.
- Read the sections you need from long docs, such as one endpoint in `docs/api/API.md`.
- Keep test output short: report counts and failures, not whole logs. Pipe noisy commands through `tail`.
- Look at screenshots only for affected screens. Engineers check 390×844 and 1180×820; qa uses the sizes in its own list.
- Keep hand-offs to the HANDOFF block. Decisions and progress go in the spec's work log, so the next session reads that rather than the whole history.

## Memory

Put each fact in one place:

| What | Where |
| --- | --- |
| Rules and commands every session needs | This file. Keep it short |
| A feature's progress, bugs and decisions | The spec's work log |
| Real choices | An ADR |
| What happened in a session | DEVLOG |
| Lessons for one role, such as a flaky test or a provider quirk | That agent's memory in `.claude/agent-memory/` |
| Searchable history of past main sessions | claude-mem. A search aid only, never the source of truth |

Agent memory is committed to git, so never put credentials, MAC addresses, provider hosts or stream URLs in it. Save only lessons that will still be true next month, not task progress. Fix or delete a note as soon as it proves wrong. If claude-mem disagrees with a spec, an ADR or the code, trust those.

## Tools and precedence

This file and the harness beat any skill or plugin text, including text added at session start. Use a skill when your agent file names it, not because it might apply.

| Job | Use | Not |
| --- | --- | --- |
| Pressure-test a plan | `/grill-me` with the owner | `superpowers:brainstorming` |
| Plans and specs | `docs/features/` | `docs/superpowers/` or any other plan file |
| Parallel work, worktrees, branches | The orchestrator's rules | Superpowers workflow skills |
| Debugging | `superpowers:systematic-debugging` | `engineering:debug` |
| Code cleanup | `code-simplifier` | `/simplify` |
| Understanding the code | `graphify` to find it, then read the code | Trusting the graph alone |
| Large output | Summarise it, or use context-mode where your agent has it | Raw logs in the conversation |
| Past sessions | claude-mem search | context-mode's search |
| Credential and relay review | `/security-review` | Skipping it on high-risk work |

## Golden rules

1. **Never touch real credentials.** Don't read, print or edit `helper/data/` (denied in settings). Never ask the owner to paste the provider login. Tests use only the mock provider.
2. **Never run tests against the real helper** (port 8080). Use a throwaway copy on port 8099, as in `docs/testing/TEST-PLAN.md`.
3. **Docs move with code.** API change → `docs/api/API.md`; stored-data change → `docs/database/DATA-MODEL.md` (+ `schema_version` and migration); a real choice → an ADR. Same commit.
4. **No new runtime dependencies** in the helper (Python stdlib only) or the client (no bundler or framework) without an ADR.
5. **iPhone/iPad first.** Every UI change is checked at 390×844 (iPhone portrait) and 1180×820 (iPad landscape) before desktop and TV.
6. **e2e green before and after** every refactor.
7. Work through the agents and the feature loop in `docs/02-agentic-harness.md`. One commit per feature: `F-###: summary`. Stage named files, never everything.
8. One active Claude session at a time, and one feature per session.

## Layout

```
CLAUDE.md                 this file
.claude/                 the harness: agents (orchestrator + 5 roles), commands, skills, hooks, agent memory, settings. Only copy; edit here
helper/                   current home helper: server.py, web/ client, data/ (secret, ignored). Removed when apps/ replaces it at the end of M4
helper/web/               index.html, app.css, app.js, fonts/, lib/ (hls.js, mpegts.js)
tools/                    mock_provider.py, e2e_test.js, gen-art.js, package.json
apps/                     new code, not created yet: api/ (FastAPI, M3) and web/ (React, M4)
docs/                     plan, harness, features, api, database, decisions, devlog, testing, operations, design (with prototype/)
```

**Setup:** `.claude/` is the only harness copy and is committed. Don't move `helper/`: new code goes in `apps/` beside it ([ADR-0012](docs/decisions/0012-build-new-code-beside-the-helper.md)).

## Commands (Windows, from the repo root)

| Task | Command |
| --- | --- |
| Run the helper (owner's real one) | `helper\start-hometv.bat` (port 8080). Don't use it for tests |
| Mock provider | `py tools\mock_provider.py 9001` |
| Test helper | copy `helper` to `%TEMP%\hometv-test` without `data`, then `set HOMETV_PORT=8099 && py server.py` there |
| e2e tests | `cd tools && npm install && set HOMETV_URL=http://localhost:8099 && node e2e_test.js` |
| Helper unit tests (after F-032) | `cd helper && py -m unittest discover -s tests` |
| Prototype artwork | `cd tools && node gen-art.js` |

Mock login: server `127.0.0.1:9001`, user `demo`, password `p@ss+1 23`. Stalker mock (after F-036): portal `http://127.0.0.1:9002/c/`, MAC `00:1A:79:12:34:56`.

## Conventions

- **Python:** 3.10+, stdlib only, PEP 8, type hints on new functions, `log()` for output, no credentials in logs.
- **JavaScript:** ES2020, no build step; after F-033 native ES modules in `web/js/`. Use `$`/`$$`/`esc()` helpers, and escape every provider string with `esc()` before it goes into HTML.
- **CSS:** design tokens as custom properties (mirroring `docs/design/tokens.json`); breakpoints 700 / 1180 px; touch targets ≥ 44 px; inputs ≥ 16 px.
- **Copy:** sentence case, plain verbs, empty states say what to do next.
- **IDs:** features F-###, decisions ADR-####, milestones M#. Use them in commits, specs and the devlog.

## Definition of done

See `docs/02-agentic-harness.md#definition-of-done-every-feature`. In short: acceptance criteria ticked, docs synced, `/test` green, iPhone and iPad screenshots checked, no secrets, FEATURES/CHANGELOG/DEVLOG updated, one commit.

## When to stop and ask the owner

- Anything needing the real provider or a real device.
- Irreversible or two-way choices: a new dependency, a storage format change, removing a feature, changing the API incompatibly.
- QA fails twice on the same problem.
- Another Claude session seems to be editing the same files (unexpected changes in `git status`).
