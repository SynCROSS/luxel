# Luxel threat model (surface tables)

Outline for tracking — not a formal audit. Mitigations point to ADRs and docs; **status** is maintainer-owned.

| Status | Meaning |
|--------|---------|
| mitigated | Control in place for current scope |
| partial | Some controls; gaps documented |
| stub | Placeholder / deferred |
| open | Not addressed yet |

## SFC compile

| Threat | Mitigation | Status |
|--------|------------|--------|
| XSS via template interpolation | HTML escape default; `unsafe:html` forbidden ([prototype-slice](./prototype-slice.md)) | mitigated |
| Template expression abuse | Purity whitelist (literals, identifiers, member access) | mitigated |
| Event handler injection | `on:event={handler}` binds script exports; compiler validates refs | mitigated |
| Plugin / macro supply chain | WASM sandbox stub + capability manifest (`plugin/wasm-sandbox.ts`); no user plugins in prod | partial |

## SSR HTML

| Threat | Mitigation | Status |
|--------|------------|--------|
| Reflected XSS in rendered HTML | Escape in `codegen-ssr`; hardening tests (`packages/luxel/test/hardening.test.ts`) | mitigated |
| Stream injection of executable content | Structured Render IR → DOM ops; no raw author HTML in stream | mitigated |
| Session fixation / auth bypass | Auth slice (C4c) — session cookie + store adapter | stub |

## `luxel-data` v2

| Threat | Mitigation | Status |
|--------|------------|--------|
| Executable hydration payload | JSON-only sidecar; version field `2` ([CONTEXT.md](../CONTEXT.md)) | mitigated |
| Client trust of forged snapshot | Server renders sidecar; client merge by generation (≥ wins) | partial |
| Stale sensitive data after logout | Tag/`revalidateTag` + ISR regen (C4b) | stub |

## Client nav

| Threat | Mitigation | Status |
|--------|------------|--------|
| Open redirect via `href` | In-app paths only; `http`/`#` ignored in `setupClientNav` | mitigated |
| DOM clobbering / script in fetched HTML | `DOMParser` + replace `<main>` only; sidecars JSON-parsed | partial |
| CSRF on navigated GET | GET document fetch; mutations use server fns (C4d) | partial |

## Deploy / compression

| Threat | Mitigation | Status |
|--------|------------|--------|
| Manifest tampering at runtime | Build-time manifest; deploy reads `dist/` only ([ADR-0003](./adr/0003-multi-runtime-deploy.md)) | mitigated |
| Compression oracle / BREACH | Size floor + MIME allowlist (`compress.ts`); optional `LUXEL_COMPRESS=0` | partial |
| Deno/Node adapter escape | Thin listen glue; app logic in shared `createAppFetch` | mitigated |

## Server functions (stub)

| Threat | Mitigation | Status |
|--------|------------|--------|
| CSRF on mutations | Origin/Referer + session CSRF token (C4d) | stub |
| Unauthenticated RPC | Manifest ID + schema validation + session | stub |
| Server module leak to client | Build separates client/server graphs | mitigated |

## Related

- [docs/architecture.md](./architecture.md)
- [docs/deploy-matrix.md](./deploy-matrix.md)
- [docs/adr/0003-multi-runtime-deploy.md](./adr/0003-multi-runtime-deploy.md)
