## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Phase-B deploy exit:** production smoke for **counter + nav-demo** built `dist/` on Node and Deno starters. **CI must run Deno deploy tests** (install Deno in workflow; remove permanent `skipIf(!deno)` on main path). Update deploy matrix for v1.0 Bun toolchain vs v1.1 parity.

## Acceptance criteria

- [ ] Node integration tests pass for counter and nav-demo built dist
- [ ] Deno integration tests pass in CI and locally when Deno present
- [ ] nav-demo deploy test asserts v2 `luxel-data` on Node (post #35)
- [ ] `docs/deploy-matrix.md` matches ADR-0003 v1.0/v1.1 split
- [ ] GitHub Actions workflow installs Deno and runs Deno deploy test job

## Blocked by

- https://github.com/SynCROSS/luxel/issues/35
