---
description: Run the HomeTV test suite against the mock provider (never the real helper) and report
argument-hint: "[optional: e2e case name or F-###]"
---
Use the qa agent to run the tests. Scope: $ARGUMENTS (empty = everything).

1. One-time setup if missing: `cd tools && npm install && npx playwright install chromium`, plus the test media in `tools\media` (ffmpeg commands in tools\README.md).
2. Run unit tests if `helper\tests` exists: `cd helper && py -m unittest discover -s tests`.
3. Run `cd tools && npm run e2e`. It starts the mock provider (9001) and a throwaway helper copy made without `data` (8099), logs it in to the mock, runs the suite, and always cleans up. Never use port 8080 or helper\data. Exit code 0 = pass, 1 = failures, 2 = setup problem.
4. Look at the iPhone and iPad screenshots for the affected screens in `%TEMP%\hometv-shots`.
5. Report: passed/failed counts (note any FLAKY lines), failures with likely owner agent, console errors, screenshots reviewed.
