## Parent

#51

## What to build

Compiler-inferred document payload policy end-to-end: zero-client routes (spiral) ship minimal HTML without `luxel-data`, `luxel-hydration`, or client `<script>`; interactive routes (counter) keep full document shape.

Support `export const client = { hydration: 'never' | 'auto' }` in route SFC (SFC wins over `luxel.config.ts` when both set). Config `routes[path].client.hydration` applies only when SFC omits client export. `hydration: 'never'` plus any `hydrate:*` → compile error. `hydrate:*` boundaries still force client artifacts when attach ops exist.

Manifest records resolved `client.hydration` and `shipSidecars` flags. Update contract and deploy-parity tests to be route-mode-aware.

## Acceptance criteria

- [ ] Spiral SSR HTML omits `luxel-data`, `luxel-hydration`, and client script (inference default)
- [ ] Counter SSR HTML still includes all sidecars and client script
- [ ] `export const client = { hydration: 'never' }` strips client artifacts on applicable routes
- [ ] `luxel.config.ts` per-route hydration applies when SFC omits `export const client`; SFC export wins on conflict
- [ ] `hydration: 'never'` + `hydrate:load` (or any `hydrate:*`) → compile error
- [ ] Manifest exposes resolved hydration / shipSidecars flags
- [ ] `contracts.test.ts` and deploy-parity tests pass with updated expectations

## Blocked by

- #54
