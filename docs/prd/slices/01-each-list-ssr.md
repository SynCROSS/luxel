## Parent

#51

## What to build

End-to-end `{#each}` list SSR tracer: a minimal Luxel route where `load()` writes an array to the resource store, the template uses `{#each items as i}` … `{/each}` (close tag required), and the compiled route renders correct HTML through the normal render worker / `renderRouteDocumentFromStore` path.

Compiler must parse block syntax, infer list binding to default store key `${routeId}:items` (with explicit `store.set("custom:key", …)` override supported), emit a native `for` loop in generated server render code (not N static `DomOp` nodes), and error on missing `{/each}`.

Verify with integration test: compile route → run `load` + render → HTML contains expected list markup. Generated render module must not embed a huge `renderIr` JSON blob for the list body.

## Acceptance criteria

- [ ] `{#each expr as item}` … `{/each}` compiles and renders a list from store data written in `load()`
- [ ] Default binding key `${routeId}:${listId}` works without author hand-wiring
- [ ] Explicit `ctx.store.set("custom:key", array)` overrides default key when inferred from script
- [ ] Missing `{/each}` produces a compile error
- [ ] Generated `renderRouteDocumentFromStore` uses a `for` loop, not interpreted `renderDomOps` for the list body
- [ ] Integration test proves HTML output for a minimal list route

## Blocked by

None — can start immediately.
