# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — system-wide ADRs. Also check context-scoped ADR dirs when they exist (see map below).

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure (this repo)

Multi-context layout:

```
/
├── CONTEXT-MAP.md
├── CONTEXT.md                         ← Luxel product glossary + prototype planning
├── docs/adr/                          ← system-wide decisions
├── packages/luxel/
│   ├── CONTEXT.md                     ← toolchain (when present)
│   └── docs/adr/
├── packages/bench/
│   ├── CONTEXT.md                     ← benchmarks (when present)
│   └── docs/adr/
└── examples/counter/
    └── CONTEXT.md                     ← counter demo app (when present)
```

See `CONTEXT-MAP.md` for the authoritative context list.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids (e.g. use **Luxel**, not "the framework"; use **progressive boundary hydration**, not "hydration" alone).

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (…) — but worth reopening because…_
