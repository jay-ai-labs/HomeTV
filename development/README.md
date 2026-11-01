# development/

All HomeTV source code lives here.

| Folder | What | Owner agent |
| --- | --- | --- |
| `helper/` | Home helper (`server.py`, later the `hometv/` package and `tests/`), launch scripts, Docker files | backend |
| `helper/web/` | Web client: `index.html`, `app.css`, `app.js`, `fonts/`, `lib/` | frontend |
| `helper/data/` | Provider login and household data. **Secret, git-ignored, never read by agents** | nobody |
| `prototype/` | The cloud prototype build (same client + `demo.js` fake API + sample art) | frontend |
| `tools/` | `mock_provider.py` (backend), `e2e_test.js` and test tooling (qa), `gen-art.js` | backend / qa |
| `apple/`, `android/` | Phase 2 and Phase 3 native apps (not started) | later |

## Moving the existing code here (one time)

When this folder was created, the code was still at the repo root (`helper\`, `prototype\`, `tools\`, `apple\`, `android\`, `design\`), and a separate design chat was still editing it.
Once that chat is finished:

1. Close the HomeTV helper window if it's running.
2. Double-click `move-into-development.bat` in this folder. It moves each code folder here and `design\` to `docs\design\`, and skips anything already moved.
3. Run `helper\install-autostart.bat` again if you use auto-start (the path changed).

Or let Claude Code do it as step 1 of milestone M1 (see `CLAUDE.md`).
