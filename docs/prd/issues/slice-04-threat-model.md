## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

`docs/threat-model.md` **surface tables**: rows per surface (SFC compile, SSR HTML, `luxel-data` v2, client nav, deploy/compression, server-fn stub); columns threat, mitigation pointer (ADR/doc), status. Expand prototype inline table — not a full formal audit.

## Acceptance criteria

- [ ] Doc exists and is linked from architecture or CONTEXT
- [ ] All six surfaces have at least one row
- [ ] Mitigation pointers reference ADR-0001/0002/0003 or explicit “deferred”
- [ ] Status column usable for tracking (e.g. open / mitigated / stub)

## Blocked by

None — can start immediately
