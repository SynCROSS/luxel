## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Server functions (C4d):** compile-time manifest IDs; schema validation; **HTML forms and JSON RPC** in one ID namespace. **CSRF:** `Origin`/`Referer` check + session-bound token (hidden field / `X-Luxel-CSRF`). JSON / structured-clone-safe payloads only.

## Acceptance criteria

- [ ] At least one demo route invokes server fn via form POST and via JSON RPC
- [ ] Unknown manifest ID rejected; schema mismatch returns safe error
- [ ] Missing/wrong CSRF or Origin fails; valid session + token succeeds
- [ ] Client bundle cannot import server modules — manifest IDs only
- [ ] Integration tests for form and RPC happy path and CSRF rejection

## Blocked by

- https://github.com/SynCROSS/luxel/issues/41
