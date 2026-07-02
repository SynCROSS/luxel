import type { DomOp } from "./dom-op.ts";
import type { RenderIr } from "./render-ir.ts";
import { LuxelCompileError } from "./diagnostics.ts";

export type NativeSsrRouteKind = "spiral" | "counter";

export function spiralNativeEligible(renderIr: RenderIr): boolean {
  return findSpiralTilesForLoop(renderIr.domOps) !== null;
}

export function counterNativeEligible(renderIr: RenderIr): boolean {
  if (spiralNativeEligible(renderIr)) return false;
  return (
    renderIr.boundaryIds.length > 0 &&
    domOpsHaveTextExpr(renderIr.domOps, "message") &&
    renderIr.bindPoints.some((bp) => bp.id === "count" && bp.kind === "text")
  );
}

export function nativeSsrRouteKind(renderIr: RenderIr): NativeSsrRouteKind | null {
  if (spiralNativeEligible(renderIr)) return "spiral";
  if (counterNativeEligible(renderIr)) return "counter";
  return null;
}

export function assertSpiralNativeEligible(renderIr: RenderIr): void {
  assertNativeSsrEligible(renderIr);
}

export function assertNativeSsrEligible(renderIr: RenderIr): void {
  if (!nativeSsrRouteKind(renderIr)) {
    throw new LuxelCompileError(
      'ssr: "native" is only supported for spiral {#each tiles as t} or counter fixture routes',
    );
  }
}

function findSpiralTilesForLoop(ops: readonly DomOp[]): string | null {
  for (const op of ops) {
    if (op.kind === "forLoop" && op.listId === "tiles" && forLoopIsSpiralTileLayout(op)) {
      return op.listId;
    }
    if (op.kind === "element") {
      const nested = findSpiralTilesForLoop(op.children);
      if (nested) return nested;
    }
  }
  return null;
}

/** Spiral native SSR only for positioned `.tile` loops (`t.x` / `t.y`), not generic `{#each tiles}`. */
function forLoopIsSpiralTileLayout(op: Extract<DomOp, { kind: "forLoop" }>): boolean {
  for (const child of op.body) {
    if (child.kind !== "element" || child.tag !== "div") continue;
    const className = child.attrs.class ?? child.attrs.className ?? "";
    if (!className.split(/\s+/).includes("tile")) continue;
    const style = child.attrs.style ?? "";
    if (style.includes("t.x") && style.includes("t.y")) return true;
  }
  return false;
}

function domOpsHaveTextExpr(ops: readonly DomOp[], expr: string): boolean {
  for (const op of ops) {
    if (op.kind === "text" && op.expr.kind === "identifier" && op.expr.raw === expr) return true;
    if (op.kind === "element" && domOpsHaveTextExpr(op.children, expr)) return true;
  }
  return false;
}
