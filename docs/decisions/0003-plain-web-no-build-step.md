# ADR-0003 Plain HTML/CSS/JS with no build step for the web client

- Status: Accepted
- Date: 2026-11-01
- Deciders: owner, architect

## Context
The client must load fast on iPhones, iPads, old Fire tablets and the Fire TV Silk browser, and be easy for agents to change and test. Only two third-party libraries are needed (hls.js, mpegts.js) and they ship as single files.

## Options considered
| Option | Pros | Cons |
| --- | --- | --- |
| React/Vue + Vite | Components, ecosystem | Build step, node_modules, bigger bundles, more moving parts for agents |
| Plain JS, one file | Zero tooling | `app.js` grows large |
| Plain JS as native ES modules | Zero tooling, split files, supported by all targets | Many small requests (fine on a LAN) |

## Decision
Keep plain HTML/CSS/JS with no bundler. Split `app.js` into native ES modules in M4 (F-033). Libraries are vendored in `web/lib/`.

## Consequences
- Good: edit-and-reload development; the helper serves files as they are; nothing to compile for the NAS.
- Cost: no type checking (JSDoc comments where it helps); discipline on module boundaries.
