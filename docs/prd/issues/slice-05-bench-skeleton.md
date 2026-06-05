## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

Benchmark **harness skeleton**: registry for micro fixtures `counter`, `list`, `table`; **only counter** runner wired. `luxel bench` prints **JSON lines** (`fixture`, `metric`, `value`). List/table marked pending in registry. Competitor runners deferred to slice 13.

## Acceptance criteria

- [ ] Fixture registry layout exists under bench package
- [ ] `luxel bench` emits valid JSON lines for counter (SSR throughput + client JS size or equivalent)
- [ ] List/table fixtures registered but skipped/pending with clear output
- [ ] Unit or smoke test asserts JSON line shape

## Blocked by

None — can start immediately
