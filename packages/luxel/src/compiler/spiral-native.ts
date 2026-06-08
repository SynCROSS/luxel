import type { DomOp } from "./dom-op.ts";
import type { RenderIr } from "./render-ir.ts";
import { LuxelCompileError } from "./diagnostics.ts";

export function spiralNativeEligible(renderIr: RenderIr): boolean {
  return findSpiralTilesForLoop(renderIr.domOps) !== null;
}

export function assertSpiralNativeEligible(renderIr: RenderIr): void {
  if (!spiralNativeEligible(renderIr)) {
    throw new LuxelCompileError(
      'ssr: "native" is only supported for spiral {#each tiles as t} routes',
    );
  }
}

function findSpiralTilesForLoop(ops: readonly DomOp[]): string | null {
  for (const op of ops) {
    if (op.kind === "forLoop" && op.listId === "tiles") {
      return op.listId;
    }
    if (op.kind === "element") {
      const nested = findSpiralTilesForLoop(op.children);
      if (nested) return nested;
    }
  }
  return null;
}
