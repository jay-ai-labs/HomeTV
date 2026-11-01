# F-### Feature name

| Field | Value |
| --- | --- |
| Status | Proposed / Ready / In progress / In review / Done / Dropped |
| Priority | P0 / P1 / P2 / P3 |
| Area | H (helper) / W (web) / T (tests) / D (docs, design) |
| Milestone | M# |
| Owner agents | architect → backend → frontend → qa → docs-keeper |
| Created | YYYY-MM-DD |

## Problem
What the household can't do today, in one or two sentences.

## Outcome
What they can do when this is done. Written from the user's side.

## Acceptance criteria
- [ ] Criterion that QA can check, with the device or layout it applies to
- [ ] ...

## Design notes (architect)
- UI: screens and layouts affected (≤700 / 701–1180 / >1180 px), with design-spec references
- API changes: endpoint, request, response (also update docs/api/API.md)
- Data changes: file, field, schema_version bump and migration (also update docs/database/DATA-MODEL.md)
- Decisions: ADR link, if any

## Test plan (qa)
- e2e cases to add in development/tools/e2e_test.js
- Unit tests (helper)
- Device checklist items

## Work log
| Date | Agent | What happened |
| --- | --- | --- |
| YYYY-MM-DD | | |

## Bugs found
| # | Found by | Description | Fixed in |
| --- | --- | --- | --- |
