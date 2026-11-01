# ADR-0002 The helper uses only the Python standard library

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner, architect

## Context
The helper runs on a family Windows PC or a Synology NAS, maintained by one person. Installing and updating packages (pip, virtualenvs, Node) on those machines is the most likely thing to break.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| Node.js + Express | Familiar web stack | npm install on the PC/NAS; dependency updates |
| Python + FastAPI/aiohttp | Async, tidy routing | pip packages; version drift |
| Python standard library | Install Python and run; Docker image is tiny | More hand-written routing; threads instead of async |

## Decision
The helper uses only the Python 3 standard library (tested on 3.13, supports 3.10+). Test tools may use packages; the runtime may not.

## Consequences
- Good: `start-hometv.bat` is the whole install; Docker image is `python:3.12-slim` plus two folders.
- Cost: thread-per-request; manual routing. Fine for a few devices.
- A runtime dependency needs a new ADR.
