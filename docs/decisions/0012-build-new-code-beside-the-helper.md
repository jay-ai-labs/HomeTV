# ADR-0012 Build new code in `apps/` beside the helper, with no `development/` folder

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner
- Related: ADR-0010, docs/03-development-plan.md

## Context
The code was due to move into `development/`, and the plan then replaces the helper and web client with FastAPI and React. Moving code that is about to be replaced adds work and breaks auto-start paths. `development/` is also an extra folder level with no purpose.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Move everything into `development/` | Follows the earlier plan | Extra level; moves code twice |
| Restructure into `apps/` during M1 | End state reached early | Moves code that is about to be rewritten |
| Leave `helper/` in place and build `apps/` beside it | No moves; the working app stays runnable as a reference | Old and new code live side by side until M4 |

## Decision
Remove `development/`. `helper/` and `tools/` stay at the root. New code goes in `apps/api` (M3) and `apps/web` (M4). `helper/` is deleted when `apps/` takes over at the end of M4.

Order: finish the Stalker adapter (F-036) on the current helper, test it on the real portal, then start FastAPI and React, as ADR-0010 sets out.

## Consequences
- Good: no path changes for auto-start or Docker until cutover, and real-provider testing comes before the rewrite.
- Cost: fixes made to `helper/` during M3 and M4 must also reach `apps/`.
