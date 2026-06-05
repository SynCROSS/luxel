## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**v1.1 plugin WASM sandbox:** declarative plugin model with WASM isolation for untrusted compile hooks/macros per architecture §8. Trusted JS plugins remain dev-only in separate process/worker.

**HITL:** sandbox threat model review and API sign-off before implementation merge.

## Acceptance criteria

- [ ] Plugin manifest schema and load path documented
- [ ] WASM plugin runs in sandbox; cannot read arbitrary filesystem or network without capability
- [ ] Sample plugin demonstrates hook; integration test proves isolation failure modes
- [ ] Threat model updated for plugin surface
- [ ] Human security review noted on issue

## Blocked by

- https://github.com/SynCROSS/luxel/issues/49
