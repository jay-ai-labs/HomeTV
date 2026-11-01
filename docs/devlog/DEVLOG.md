# Development log

What actually happened, session by session, newest first. docs-keeper adds an entry at the end of every working session (`/devlog`).
Entries are facts: what changed, what was tested and how, what broke, what's next. Plans belong in the specs and the roadmap.

Entry template:

```
## YYYY-MM-DD · <session focus>
Surface: Claude Code CLI | claude.ai chat | manual
Features: F-###, F-###
Done:
- ...
Tested:
- /test → N passed, M failed (which)
- Devices: ...
Problems / surprises:
- ...
Decisions: ADR-#### (or "none")
Next:
- ...
```

---

## 2026-11-01 · Repo baseline and folder decision
Surface: Claude Code CLI
Features: none (process)
Done:
- Created the git repo and baseline commit; the owner pushed it to GitHub.
- Removed `development/`. `helper/` and `tools/` stay at the root, and new code goes in `apps/` (ADR-0012). All paths in docs and agents updated. DEVLOG history left as written.
Tested: docs and paths only; searched for leftover `development/` references.
Problems / surprises:
- A cleanup script deleted `CLAUDE.md`: a helper function named `Rd` resolved to PowerShell's `rd` alias for `Remove-Item`. Restored from the baseline commit with nothing lost.
Decisions: ADR-0012.
Next:
- Owner installs Node.js, ffmpeg and Python, and confirms no other session is editing.
- e2e assertions and baseline, then F-036 helper adapter.

## 2026-11-01 · Orchestrator agent and harness install
Surface: Claude Code CLI
Features: none (process)
Done:
- Added the `orchestrator` agent (Opus 5.5) as the default main session, with parallel rules (ADR-0011).
- Set models: architect, backend, frontend and qa Sonnet; docs-keeper Haiku.
- Installed the harness into `.claude/`, now the only copy. Added PowerShell to agent tools for this Windows machine.
Tested: copied files matched by hash. Agents not run yet.
Decisions: ADR-0011.
Next:
- Owner deletes `harness/` and restarts Claude Code.
- Remaining M1 steps.

## 2026-11-01 · F-036 UI: MAC portal login
Surface: claude.ai chat (cloud), "Mobile-friendly design feedback"
Features: F-036
Done:
- Setup screen: segmented control "Username and password" / "MAC portal"; Stalker form with Portal URL, MAC address (monospace, auto-formats to `00:1A:79:XX:XX:XX`, accepts dashes and lower case, inline validation before any request), one-device-per-MAC notice, Advanced (serial, device IDs, signature, time zone); notice when switching login type; iPhone full-screen layout.
- Settings: provider card shows Login type, Portal host, MAC as `…:A1:B2`, account and expiry ("Not reported" if missing); "Watching now" only when the provider reports it; one-device notice for MAC portals.
- `helper/web/index.html`, `app.js`, `app.css` updated; prototype (`docs/design/prototype`, cloud) defaults to a MAC portal login and simulates an unregistered MAC (`00:1A:79:00:00:00`). Design spec, tokens (segmented, monoField, fieldError, notice) and screenshots updated.
Tested:
- Against the current helper (port 8085 copy) + Xtream mock: Xtream setup through the new form works; MAC portal setup shows "This HomeTV helper can't connect to MAC portals yet..."; full e2e green.
- Prototype at 393×852 and 1180×820: MAC formatting, inline errors, portal rejection, type switching, arrow keys on the segmented control; no page errors.
Decisions: none (follows the F-036 spec and ADR-0010).
Next: F-036 helper adapter (`providers/stalker.py`) and `mock_stalker.py` in Claude Code; then run e2e against both mocks.

## 2026-11-01 · Provider is a Stalker (MAC) portal
Surface: claude.ai chat (cloud)
Features: F-036 (new), F-019
Done:
- Owner confirmed the provider login is **portal URL + MAC address only** (as entered in iSTB). HomeTV supports only Xtream Codes, so it can't log in to the real provider yet.
- Wrote F-036 (Stalker/MAC portal support, P0, first in M2) with the portal protocol mapping, API and data changes, UI and a Stalker mock. Recorded ADR-0010 (provider adapters behind the existing API).
- Updated FEATURES, ROADMAP (M2 = F-036, F-019, F-020), technical plan, 03-development-plan (providers/ and M2 row), API.md and DATA-MODEL.md (marked "not built yet"), TEST-PLAN.
Tested: docs only.
Problems / surprises:
- Stalker portals usually allow one session per MAC: HomeTV and iSTB may log each other out. Owner to decide: replace iSTB, ask for a second MAC, or ask the provider for Xtream credentials.
Decisions: ADR-0010.
Next: M1 (move, git baseline), then F-036 in Claude Code.

## 2026-11-01 · Neutral background (F-031 follow-up)
Surface: claude.ai chat (cloud), "Mobile-friendly design feedback"
Features: F-031
Done:
- Owner: "This green background doesn't look good." A first set of three near-black options was too subtle to tell apart, so I fixed it directly instead.
- `helper/web/app.css`: graphite neutrals (ground #0F1013, surface #1A1C20, surface2 #24272C, surface3 #2E3238, lines #383C43/#272A2F, ink #F2F3F5/#B4B8BF/#868B94) with clearer steps between layers. `--accent-soft` is now neutral (surface3), so selected rows, focus and the guide's current programmes are grey with a teal edge. Teal stays on primary buttons, progress, the now line and the active tab. Overlays use the ground token through `color-mix()` instead of hardcoded hex.
- Manifest and theme colour `#0F1013`. Design tokens, spec and 44 screenshots updated. Prototype republished.
Tested:
- e2e against a throwaway helper + mock provider: all playback flows passed. Touch/keyboard flows at iPhone, iPad, desktop and TV sizes: no page errors.
Decisions: ADR-0009 (supersedes ADR-0008's background only).
Next: M1 move and git baseline; F-019.

## 2026-11-01 · Household design system (F-031)
Surface: claude.ai chat (cloud), "Mobile-friendly design feedback"
Features: F-031
Done:
- Owner asked for "the design system used by the household app". "Noctrane", "Nocturne" and the org default could not be found from Claude (no org/default design system visible; two empty Design System artifacts). Took the household app to be Ghar Ledger and applied its dark theme.
- `helper/web/app.css` re-tokenised with Ghar Ledger names (ground, surface, surface2, ink, ink2, ink3, line, line2, us, in, good, warn, crit); fonts swapped to Figtree + Archivo (`helper/web/fonts/`); Ghar's buttons, chips, tab bar, bottom sheets, toast; page-wide ambient glow removed. No JS behaviour changes.
- `helper/server.py`: serves `.woff2` as `font/woff2`. Manifest and theme colour now `#0B1211`.
- `design/README.md`, `design/tokens.json` and all 44 screenshots regenerated. Cloud prototype republished.
Tested:
- e2e (`tools/e2e_test.js`, updated for the Home screen) against a throwaway helper + mock provider with generated test media: home, preview, zapping, blocked channel, MPEG-TS, guide, catch-up, movie resume, episodes, favorites, search, settings, keyboard, phone. Passed.
- Touch and keyboard flows at 393×852 (iPhone), 820×1180 and 1180×820 (iPad), 852×393 (iPhone landscape), 1440×900 and 1920×1080. No page errors.
Problems / surprises:
- The design-system name was unclear; ADR-0008 records the interpretation so it can be revisited.
- The old Atkinson/Bricolage files are still in `helper/web/fonts/` (unused). Delete them during the M1 move.
Decisions: ADR-0008.
Next: M1 move (`development\move-into-development.bat`) and git baseline; then F-019.

## 2026-11-01 · Development harness and docs
Surface: claude.ai chat (cloud)
Features: none (process)
Done:
- Wrote the web-app technical plan, the agent harness, and tracking docs (features, API, data model, ADRs 0001–0007, test plan, runbook).
- Added CLAUDE.md and the agent harness in `harness/` (architect, backend, frontend, qa, docs-keeper agents; six slash commands; permissions). It installs into `.claude/` with `harness\install-harness.bat`, because remote tools may not write to `.claude/`.
- Created `development/` with a move script; the code moves there once the design chat finishes.
Tested: docs only.
Decisions: ADR-0001 to ADR-0007 recorded (all describe choices already made).
Next:
- Run `harness\install-harness.bat`, then `development\move-into-development.bat`, `git init`, baseline commit.
- M2: F-019 real-provider hardening.

## 2026-11-01 · iPhone/iPad-first redesign
Surface: claude.ai chat (cloud), "Mobile-friendly design feedback"
Features: F-015, F-016, F-017
Done:
- New Home screen, side rail / bottom tabs, detail pages, guide info panel, new type and colour system; design spec, tokens and 44 screenshots in `design/`.
Tested:
- e2e against the mock provider at iPhone, iPad and desktop sizes: playback, zapping, MPEG-TS, catch-up, movies, episodes, phone. Passed.
Next: Design-system alignment (Noctrane) under discussion.

## 2026-11-01 · Phase 1 build
Surface: claude.ai chat (cloud)
Features: F-001–F-014, F-018
Done:
- Built the home helper (`server.py`) and web client; mock Xtream provider; e2e suite.
- Published the cloud prototype and the architecture plan; delivered the project to `D:\Projects\HomeTV`.
Tested:
- e2e: preview, full screen, zapping, blocked-channel message, MPEG-TS fallback, guide (82 programmes), catch-up with provider time zone, movie resume, series next episode, favorites, search, keyboard navigation, phone layout. All passed.
Problems / surprises:
- Cloud sandbox can't reach Android build hosts or run macOS. Native apps stay in Phases 2–3.
Next: real-provider test (owner).
