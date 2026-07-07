import type { DomOp } from "./dom-op.ts";
import type { TemplateExpr } from "./semantic-ir.ts";

export type ForLoopAttachSpec = {
  listId: string;
  itemName: string;
  keyExpr?: string;
  body: DomOp[];
};

export function collectForLoopSpecs(ops: readonly DomOp[]): ForLoopAttachSpec[] {
  const specs: ForLoopAttachSpec[] = [];
  walk(ops, specs);
  return specs;
}

function walk(ops: readonly DomOp[], specs: ForLoopAttachSpec[]): void {
  for (const op of ops) {
    if (op.kind === "forLoop") {
      specs.push({
        listId: op.listId,
        itemName: op.itemName,
        body: op.body,
        ...(op.keyExpr ? { keyExpr: op.keyExpr } : {}),
      });
      walk(op.body, specs);
      continue;
    }
    if (op.kind === "element") walk(op.children, specs);
  }
}

export function collectAttachContextSymbols(
  bindExprs: string[],
  domOps: readonly DomOp[],
): string[] {
  const symbols = new Set(bindExprs);
  for (const spec of collectForLoopSpecs(domOps)) {
    symbols.add(spec.listId);
  }
  return [...symbols];
}

export function memberAccessFromItem(itemName: string, raw: string): string | null {
  if (raw === itemName) return "item";
  if (raw.startsWith(`${itemName}.`)) {
    return `item.${raw.slice(itemName.length + 1)}`;
  }
  return null;
}

export function exprToItemAccess(expr: TemplateExpr, itemName: string): string {
  if (expr.kind === "literal") return JSON.parse(expr.raw) as string;
  const access = memberAccessFromItem(itemName, expr.raw);
  if (access) return access;
  return expr.raw;
}
