## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Stability matrix (C4h):** strict semver policy doc + enforcement hooks. **Frozen diagnostic codes**, **versioned manifest schema**, public API surface (`luxel` CLI, manifest contract, server/deploy subpaths). Breaking compiler output or manifest shape **major-only** with codemods noted. Migrations doc template per major.

**HITL:** maintainer sign-off on API surface list and first major boundary.

## Acceptance criteria

- [ ] `docs/stability-matrix.md` (or equivalent) lists public API and semver rules
- [ ] Manifest schema version field enforced in tests
- [ ] Diagnostic codes documented; test prevents accidental renumbering
- [ ] CONTRIBUTING or release doc describes major migration expectations
- [ ] Human review completed on API freeze list (comment on issue)

## Blocked by

- https://github.com/SynCROSS/luxel/issues/35
- https://github.com/SynCROSS/luxel/issues/46
