---
description: Write today's development-log entry from git history and the session's hand-offs
---
Use the docs-keeper agent to add a DEVLOG entry for this session.

1. Find the last entry's date in docs/devlog/DEVLOG.md. Collect `git log --oneline` since then, plus the HANDOFF blocks and test results from this session.
2. Write one entry at the top (below the template) using the template: surface, features, done, tested, problems, decisions, next.
3. Facts only. No credentials, provider hosts or real channel names.
4. If features changed status, make sure FEATURES.md, CHANGELOG.md and ROADMAP.md agree with the entry.
