## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Docs site (C4f):** new Luxel app `examples/docs-site` in Bun workspace. Dogfoods SSG/ISR, auth, server functions, deploy (Node/Deno smoke). Serves as benchmark **app-class** fixture for slice 13.

## Acceptance criteria

- [ ] `examples/docs-site` builds and serves via `luxel dev` and production dist
- [ ] At least one static (SSG), one ISR, one authenticated, one server-fn flow documented in site
- [ ] Deployable on Node/Deno starters like other examples
- [ ] Linked from root README or docs index
- [ ] CI builds docs-site without breaking workspace

## Blocked by

- https://github.com/SynCROSS/luxel/issues/40
- https://github.com/SynCROSS/luxel/issues/41
- https://github.com/SynCROSS/luxel/issues/43
- https://github.com/SynCROSS/luxel/issues/44
