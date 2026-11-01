---
name: grill-me
description: Interview the owner about a plan or feature until every decision is settled. Use before writing or approving a feature's design, or when the owner asks to be grilled.
disable-model-invocation: true
---

Based on `grilling` from mattpocock/skills (MIT, Copyright (c) 2026 Matt Pocock). This copy is adapted for HomeTV.

Interview the owner until you reach a shared understanding. Map the plan as a design tree: every decision branches into the decisions that depend on it.

Work in rounds. The frontier is every decision whose prerequisites are settled. Ask the whole frontier in one round, numbering each question and giving your recommended answer, then wait for the replies.

```
Q1 - <question title>: <question, with choices if useful>
Recommended: <your answer>
```

Word each question so "yes" accepts your recommendation. Recompute the frontier after each round.

Find facts yourself and never ask the owner for them. Check the spec, ADRs, docs and code first. Never ask for credentials, the MAC address or the provider's address.

The session ends when the frontier is empty and the owner confirms you share the same understanding. Don't build anything. Hand the answers to architect for the spec's design notes, or to `/adr` for a real choice. HomeTV's specs replace any other design document.
