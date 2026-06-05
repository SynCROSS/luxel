# nav-demo

Phase-1 proof app for **resource store**, **tag revalidation**, and (later) client navigation. Counter stays the prototype regression fixture.

## Dev

From repo root (after `bun install` at root):

```bash
bun run dev:nav-demo
```

From this app directory:

```bash
bun run dev
```

`luxel` comes from `@luxel/luxel` workspace bin. CLI picks `examples/nav-demo` via `luxel.config.ts` when cwd is under this app. From repo root, `bun run dev` (toolchain only) or `bun run dev:counter` serves **counter**.

## Routes

- `/` — headline from a tagged store resource; refetches after `revalidateTag("nav")`
- `/detail` — static second route for two-route manifest checks
