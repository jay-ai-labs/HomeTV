---
description: Run the HomeTV test suite against the mock provider (never the real helper) and report
argument-hint: "[optional: e2e case name or F-###]"
---
Use the qa agent to run the tests. Scope: $ARGUMENTS (empty = everything).

1. Start the mock provider in the background: `py tools\mock_provider.py 9001` (skip if port 9001 already answers).
2. Make a throwaway helper copy without data: `robocopy helper %TEMP%\hometv-test /E /XD data` (or the equivalent cp in Git Bash), then start it there with HOMETV_PORT=8099 in the background. Never use port 8080 or helper\data.
3. If the test helper isn't configured, POST /api/setup to http://localhost:8099 with server 127.0.0.1:9001, user demo, password "p@ss+1 23".
4. Run unit tests if helper\tests exists, then `node e2e_test.js` in tools with HOMETV_URL=http://localhost:8099.
5. Look at the iPhone and iPad screenshots for the affected screens.
6. Stop both background processes. Report: passed/failed counts, failures with likely owner agent, console errors, screenshots reviewed.
