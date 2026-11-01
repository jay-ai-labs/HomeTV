# HomeTV development plan: enterprise structure and stack

Status: Approved by the owner, M1 in progress · Last updated: 2026-11-01

Where this plan differs from `CLAUDE.md`, `ROADMAP.md`, the technical plan or the ADRs, those stay in force until M1 updates them.

## Context

The owner wants a cleaner, enterprise-level project with a modern stack (FastAPI, React and so on). Decisions so far: FastAPI, TypeScript, and the React move after real-provider testing (M2).

**Principle:** adopt enterprise practices (structure, contracts, tests, CI, security, releases). Don't adopt enterprise infrastructure. HomeTV serves one household from a PC or NAS, so anything needing servers to run or babysit adds cost with no benefit.

**Outcome:** same features, API paths and Ghar Ledger look (ADR-0008), on a stack that's typed, tested and releasable.

## Recommended tech stack

| Area | Today | Recommended | Why |
| --- | --- | --- | --- |
| Backend | `http.server` | **FastAPI + Uvicorn** | Routing, validation, generated OpenAPI |
| Validation/settings | Hand-written | **Pydantic v2, pydantic-settings** | Typed API models and env config |
| Provider HTTP | `urllib` | **httpx** (async for streams) | Async streaming, connection control |
| Python tooling | None | **uv, Ruff, mypy, pytest** | Locked installs, lint, types, tests |
| Household data | JSON files | **SQLite + SQLAlchemy 2 + Alembic** (with profiles) | Real migrations, no database server |
| Frontend | Plain JS | **React + TypeScript + Vite** | Components, types, fast builds |
| Server state | Custom `S` object | **TanStack Query** | Caching and retries for lists and guide |
| UI state | Custom | **Zustand** | Small store for player and preferences |
| Long lists | Custom chunking | **TanStack Virtual** | 20,000+ channel lists |
| Styling | `app.css` | **Keep CSS, move to CSS Modules gradually** | Preserves Ghar Ledger tokens |
| Playback | hls.js, mpegts.js | **Keep, pinned through npm** | Already proven |
| API contract | Hand-kept docs | **OpenAPI + openapi-typescript** | Client types generated from the server |
| JS tooling | None | **pnpm, ESLint, Prettier, Vitest, Testing Library** | Standard quality gates |
| E2E | Script with no assertions | **Playwright Test** | Real pass/fail, traces, device profiles |
| CI/CD | None | **GitHub Actions, Dependabot, gitleaks, pre-commit** | Every change checked automatically |
| Deployment | `.bat` + Docker | **Multi-stage Docker + versioned images; Windows service/installer script** | Repeatable installs |
| Observability | `print` logs | **structlog JSON logs, `/health`** | Diagnosable with no credentials in logs |

**Deliberately not recommended:** PostgreSQL, Redis, Kafka/Celery, Kubernetes, microservices, Next.js/SSR, cloud hosting, a CSS rewrite. Revisit only if HomeTV stops being a single-household LAN app. Hosting it for others would also change its legal and security position.

## Target project structure

There is no `development/` folder. `helper/` and `tools/` stay where they are, and new code is built in `apps/` beside them (ADR-0012). `helper/` is deleted when `apps/` takes over at the end of M4, and `tools/` moves into `tests/` then. The tree below is the end state.

```
hometv/
  apps/
    api/                 FastAPI service
      src/hometv_api/
        core/            settings, logging, errors, security
        providers/       Xtream and Stalker adapters (ADR-0010, F-036), future M3U (F-029)
        catalog/         lists, cache
        epg/             XMLTV download, parse, index
        streaming/       relay, playlist rewrite, tokens
        household/       favorites, progress, profiles
        main.py          app factory, lifespan
      tests/  pyproject.toml  uv.lock
    web/                 React client
      src/
        app/             shell, providers, layouts
        features/        home, live, guide, vod, search, settings, player
        shared/          api, ui, hooks, lib, nav
        styles/
      public/  package.json
    apple/  android/     Phases 2 and 3
  packages/
    api-contract/        generated openapi.json + TS types
    design-tokens/       tokens.json as single source (web, Swift, Compose)
  tests/
    e2e/                 Playwright
    mock-provider/       mock_provider.py + media scripts
  deploy/
    docker/              Dockerfile, compose.yaml
    windows/             start, autostart scripts
  docs/                  kept: existing docs carried over (see below)
    01-technical-plan.md  02-agentic-harness.md  ROADMAP.md  CHANGELOG.md
    api/  database/  decisions/  devlog/  features/  operations/  testing/
    design/              moved from root design/ (includes prototype, screenshots)
  .github/workflows/     ci.yml, release.yml
  .claude/               the only harness copy: agents, commands, settings
  .env.example  .editorconfig  .pre-commit-config.yaml
  README.md  CLAUDE.md  CONTRIBUTING.md  SECURITY.md  CHANGELOG.md
```

## Clean-up list

- Delete unused Atkinson and Bricolage fonts (already required by ADR-0008).
- Keep one icon set; the same icons exist in `helper/web/` and the prototype.
- Keep `docs/` as the existing source of truth; its files keep their current names and locations.
- Keep the harness only in `.claude/` (ADR-0011).
- Move runtime data out of the code tree with `HOMETV_DATA_DIR`, so an update can't touch the login.
- Replace `.gitignore` paths for the new layout; add `.env`.
- Fix stale paths: `helper/README.md`, `.claude/agents/frontend.md`.
- Rebuild `design/prototype` as a Vite demo mode, removing `window.DEMO` from player code.

## Engineering improvements

- **Quality gates:** lint, types, unit tests and e2e must pass before merge. Protect `main` and use pull requests.
- **Tests:** `tools/e2e_test.js` has no assertions today, so fix this first. Add contract tests from OpenAPI, and coverage targets for `streaming/` and `epg/`.
- **Security:**
  - Keep credentials out of logs. `httpx` logs full URLs at INFO, so silence it.
  - Add secret scanning and dependency audits.
  - Bring the household PIN (F-030) forward, because the LAN has no login today.
  - Add security headers and restrict file permissions on the login.
- **Operations:** health endpoint, structured logs, backup/restore for household data, versioned releases with semantic versions.
- **Docs:** generate API reference from OpenAPI, so `docs/api/API.md` can't drift. Add `CONTRIBUTING.md` and `SECURITY.md`.

## Harness and docs updates

Both folders change alongside the code, in the same commits.

**`.claude/`**

- `agents/backend.md`: owns `apps/api/**`; FastAPI, Pydantic, pytest rules replace stdlib-only rules.
- `agents/frontend.md`: owns `apps/web/**`; React and TypeScript rules replace "no build step"; `dangerouslySetInnerHTML` banned in place of `esc()`.
- `agents/qa.md`: owns `tests/**`; Playwright Test, mock provider path.
- `agents/architect.md`, `agents/docs-keeper.md`: new paths; architect owns OpenAPI contract changes.
- `commands/test.md`: run lint, types, unit tests, client build, then e2e on port 8099.
- `commands/feature-build.md`, `status.md`, `feature-new.md`, `adr.md`, `devlog.md`: update any old paths.
- `settings.json`: allow uv, pnpm and pytest; deny the new data location.
- `agents/orchestrator.md`: update its paths for the new layout.

**`docs/`**

- `01-technical-plan.md`: architecture, stack, backend, frontend, security and milestone sections.
- `02-agentic-harness.md`: role table, owned paths, definition of done.
- `ROADMAP.md`, `features/FEATURES.md`: new milestones; drop F-032 and F-033; add F-034 and F-035 with specs.
- `decisions/`: new ADRs for FastAPI, React, project structure and SQLite; mark ADR-0002, 0003 and 0004 superseded when replaced; update the index.
- `api/API.md`: OpenAPI as generated source, with caching and `/health` additions.
- `database/DATA-MODEL.md`: data location, then SQLite at M6.
- `testing/TEST-PLAN.md`, `operations/RUNBOOK.md`: new commands, CI, install, backup.
- `design/`: moved from the root, with tokens linked to `packages/design-tokens/`.
- `CHANGELOG.md`, `devlog/DEVLOG.md`, `README.md`: updated for each milestone.

Root `CLAUDE.md` and `README.md` get the new layout, commands and rules at M1.

## Milestones

| # | Milestone | Scope | Exit criteria | Size |
| --- | --- | --- | --- | --- |
| Pre | Prerequisites | Confirm no other session is editing; install Git, Node, ffmpeg, real Python | Tools work | S |
| M1 | Foundation | Remove `development/`, harness path updates, `git init`, clean-up list, CI skeleton, e2e assertions and baseline | CI green; e2e passes on old stack | M |
| M2 | Real-provider support and hardening | F-036 (Stalker/MAC portal, built on the current helper as framework-free adapters), F-019, F-020 | Works on 6 devices with the household's MAC portal | M |
| M3 | FastAPI backend | Modules, Pydantic models, httpx relay, pytest, new packaging | Old client passes e2e unchanged | L |
| M4 | React client | Typed client, screen-by-screen port, cutover, then F-021, F-022 | e2e and device checks pass; `helper/` deleted | L |
| M5 | Design system | F-031 | Done (ADR-0008) | Done |
| M6 | Household features | SQLite migration, profiles, PINs, multiview | Migration tested with backup/restore | L |
| M7 | Release and operations | Release pipeline, images, logs, backups, runbooks | Clean install from a release | M |

Feature changes: drop F-032 and F-033; add F-034 (FastAPI) and F-035 (React). New ADRs: superseding ADR-0002 and ADR-0003, plus SQLite replacing ADR-0004 at M6.

## Key risks

| Risk | Mitigation |
| --- | --- |
| Dropped clients leave upstream streams open, using up 1 or 2 provider connections | Close upstream on disconnect; unit test it |
| React remounts `<video>`, restarting streams and slowing zapping | Player engine stays outside React; one video element attached by ref |
| FastAPI defaults change API behaviour | Keep `{"error"}`, 400s, redirects, `Range`, `HEAD`, 410; test against baseline |
| Installs get harder for the household | Docker on NAS; Windows script creates the environment |
| Old Fire tablets and Silk can't run the new build | Target ES2020; test on real devices before cutover |
| Tooling outweighs the product | Add tools per milestone, not all at M1 |

## Verification

- M1: CI runs on a test commit, and e2e fails when a selector is deliberately broken.
- M3: e2e matches baseline; logs contain no mock password or upstream URLs.
- M4: budgets from `docs/01-technical-plan.md` section 9 hold; screenshots at 390×844 and 1180×820.
- M6: restore a backup into a clean install.
- M7: fresh install from a release on Windows and Docker.

All automated checks use the mock provider and port 8099, never the real helper on 8080.
