# ADR-0004 JSON files for household data until profiles arrive

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner, architect
- Related: F-009, F-010, F-011, F-024

## Context
Shared data is small: a few dozen favorites, up to 300 resume points, 30 recent channels. Writes are rare (seconds apart), and there's one household.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| JSON files with a lock and atomic writes | Readable, easy backup, zero setup | Whole-file rewrite; last write wins |
| SQLite (stdlib `sqlite3`) | Queries, per-row updates, concurrency | Schema migrations from day one; overkill now |
| No server storage (localStorage only) | Simplest | No sync between devices |

## Decision
Use `userdata.json` and `config.json` with a process lock and atomic replace. Move to SQLite when profiles or recordings start (design in DATA-MODEL.md), through a new ADR.

## Consequences
- Good: the household can back up or inspect one file.
- Cost: migrating later; `schema_version` must be added now (F-032) to make that clean.
