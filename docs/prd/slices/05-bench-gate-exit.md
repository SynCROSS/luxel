## Parent

#51

## What to build

Phase 0 exit verification: `luxel bench --gate` passes tier-2 spiral and counter ISR cells with geo-mean factor ≤ 1.08 vs executed competitors in the same run. Publish updated WinRK artifacts (`winrk-spiral-latest`, counter ISR row).

If spiral still misses 1.08 after slices 1–4, file a follow-up for Phase 0.5 static subtree freeze (do not implement in this slice).

## Acceptance criteria

- [x] `luxel bench --gate` passes spiral tier-2 cell: `rps_fastest / rps_luxel` ≤ 1.08
- [x] `luxel bench --gate` passes counter ISR cell: factor ≤ 1.08
- [x] WinRK results written to `docs/benchmarks/runs/` with updated RPS
- [x] Phase 0 exit documented; Phase 0.5 not opened (spiral gate passed)

## Blocked by

- #54
- #55
- #53
