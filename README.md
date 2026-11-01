# HomeTV

A private IPTV player for our household: live TV, TV guide, catch-up, movies and series on every
TV, tablet and phone, with favorites and "continue watching" shared between devices.
It works with Xtream Codes logins (server address, username, password) and supplies no content.

## Links (in Claude, cloud snapshots)

- Architecture and development plan: https://claude.ai/artifact/4Xf4vGCUHqP5AoPDFoqPAb
- Clickable UI prototype (sample data): https://claude.ai/artifact/GyjvUcnXkD8NqXS8JD7S3i

## Repository layout

| Path | What it is |
| --- | --- |
| `helper\` | Current home helper and web client. `apps\` replaces it at the end of M4 |
| `tools\` | Mock provider, e2e tests, artwork generator |
| `docs\` | Technical plan, agent harness, features, API, data model, decisions, devlog, test plan, runbook, design |
| `CLAUDE.md` | Rules for Claude Code |
| `.claude\` | Claude Code agents (orchestrator, architect, backend, frontend, qa, docs-keeper), slash commands and permissions |

## Developing with Claude Code

```
cd D:\Projects\HomeTV
claude
```

Then, for example: `/status`, `/feature-build F-019`, `/feature-new Sleep timer`, `/test`, `/devlog`. How it works: `docs\02-agentic-harness.md`.

## Running HomeTV at home

1. Install Python 3 from https://www.python.org/downloads/ and tick **Add python.exe to PATH**.
2. Double-click `helper\start-hometv.bat`. When Windows Firewall asks, allow **Private networks**.
3. Open http://localhost:8080 and enter your provider's login. It's saved only in `helper\data\config.json`.
4. On phones, tablets and the Fire Stick (Silk), open the address shown in the window, then Add to Home Screen.

More: `docs\operations\RUNBOOK.md`. Never commit `data\`: it holds the provider login.

## Status

See `docs\ROADMAP.md` and `docs\features\FEATURES.md`. Phase 1 (helper + web app) is built and redesigned iPhone/iPad-first. Next: M1 (repo and harness), then M2 (real-provider hardening).
