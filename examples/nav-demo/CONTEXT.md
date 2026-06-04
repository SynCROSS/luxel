# nav-demo

Phase-1 proof app for **resource store**, **tag revalidation**, and (later) client navigation. Counter stays the prototype regression fixture.

## Dev

From this directory (or anywhere under it):

```bash
bun run --cwd ../../packages/luxel luxel dev
```

CLI picks `examples/nav-demo` via `luxel.config.ts` discovery. From repo root, `luxel dev` still serves **counter**.

## Routes

- `/` — headline from a tagged store resource; refetches after `revalidateTag("nav")`
- `/detail` — static second route for two-route manifest checks
