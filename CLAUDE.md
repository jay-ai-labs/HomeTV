# HomeTV: instructions for Claude Code

HomeTV is a private IPTV player for one household. It uses an Xtream Codes login and supplies no content.
Current focus: the **web app** (home helper + web client), iPhone and iPad first. Native Apple and Android apps come later.
**The household's provider is a Stalker/MAG portal (portal URL + MAC address, no username/password).** Supporting it is F-036, the first M2 feature ([ADR-0010](docs/decisions/0010-provider-adapters-xtream-and-stalker.md)). The MAC is a credential: same rules as the password.

Read before working: `docs/README.md` (how tracking works), `docs/01-technical-plan.md`, `docs/02-agentic-harness.md`, `docs/features/FEATURES.md`, `docs/ROADMAP.md`.

## Golden rules

1. **Never touch real credentials.** Don't read, print or edit `development/helper/data/` (denied in settings). Never ask the owner to paste the provider login. Tests use only the mock provider.
2. **Never run tests against the real helper** (port 8080). Use a throwaway copy on port 8099, as in `docs/testing/TEST-PLAN.md`.
3. **Docs move with code.** API change → `docs/api/API.md`; stored-data change → `docs/database/DATA-MODEL.md` (+ `schema_version` and migration); a real choice → an ADR. Same commit.
4. **No new runtime dependencies** in the helper (Python stdlib only) or the client (no bundler or framework) without an ADR.
5. **iPhone/iPad first.** Every UI change is checked at 390×844 (iPhone portrait) and 1180×820 (iPad landscape) before desktop and TV.
6. **e2e green before and after** every refactor.
7. Work through the agents and the feature loop in `docs/02-agentic-harness.md`. One commit per feature: `F-###: summary`.

## Layout

```
CLAUDE.md                 this file
.claude/                 the harness: agents (orchestrator + 5 roles), slash commands, settings. Only copy; edit here
development/              ALL source code
  helper/                 home helper: server.py (+ hometv/ package after F-032), web/ client, data/ (secret, ignored)
  helper/web/             index.html, app.css, app.js, fonts/, lib/ (hls.js, mpegts.js)
  prototype/              cloud prototype build (sample data, demo.js)
  tools/                  mock_provider.py, e2e_test.js, gen-art.js, package.json
  apple/  android/        later phases (empty)
docs/                     plan, harness, features, api, database, decisions, devlog, testing, operations, design
```

**First-time setup (M1):**
1. Check with the owner that no other Claude session is editing the project.
2. Stop the helper. Run `development\move-into-development.bat`, or `git mv` the same folders: helper, prototype, tools, apple and android go into `development\`; design goes into `docs\design\`.
3. `git init`, then commit everything as the baseline: `M1: baseline`. `.claude/` is committed too.
4. Remind the owner to re-run `development\helper\install-autostart.bat`, because the path changed.

## Commands (Windows, from the repo root)

| Task | Command |
| --- | --- |
| Run the helper (owner's real one) | `development\helper\start-hometv.bat` (port 8080). Don't use it for tests |
| Mock provider | `py development\tools\mock_provider.py 9001` |
| Test helper | copy `development\helper` to `%TEMP%\hometv-test` without `data`, then `set HOMETV_PORT=8099 && py server.py` there |
| e2e tests | `cd development\tools && npm install && set HOMETV_URL=http://localhost:8099 && node e2e_test.js` |
| Helper unit tests (after F-032) | `cd development\helper && py -m unittest discover -s tests` |
| Prototype artwork | `cd development\tools && node gen-art.js` |

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
