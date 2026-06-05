# Luxel

Bun-first, Vite-free web framework for fast, secure, trisomorphic apps.

- **Docs:** [docs/architecture.md](./docs/architecture.md) · [prototype slice](./docs/prototype-slice.md)
- **Glossary:** [CONTEXT.md](./CONTEXT.md)
- **PRD (delivered):** [docs/prd/prototype-slice-delivered.md](./docs/prd/prototype-slice-delivered.md) · [post-prototype](./docs/prd/post-prototype-resource-store.md)
- **ADR:** [resource store phase 1](./docs/adr/0001-resource-store-phase-1.md)

## Status

**Prototype slice + M11 complete** on `examples/counter`: `compileCounterApp` (Semantic IR → Render IR → SSR/attach codegen), progressive boundary hydration, `luxel dev|build|bench`, multi-route (`/` + `/about`), streaming SSR spike (`?stream=1`).

- **Examples:** [counter](./examples/counter) · [nav-demo](./examples/nav-demo) · [docs-site](./examples/docs-site)

```bash
bun test packages/luxel/test
bun run test:e2e
bun packages/luxel/src/cli.ts dev
```

## Packages (planned)

| Package | Role |
|---------|------|
| `@luxel/core` | Runtime, signals, hydration |
| `@luxel/compiler` | SFC → IR → targets |
| `@luxel/cli` | `luxel dev`, `luxel build` |
| `@luxel/db-postgres` / `@luxel/db-sqlite` | Official DB helpers |

## License

TBD
