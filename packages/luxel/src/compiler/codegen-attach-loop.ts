import type { DomOp } from "./dom-op.ts";
import {
  collectForLoopSpecs,
  exprToItemAccess,
  memberAccessFromItem,
  type ForLoopAttachSpec,
} from "./attach-loop.ts";

function codegenLoopElement(
  op: Extract<DomOp, { kind: "element" }>,
  itemName: string,
  varPrefix: string,
  updateTarget: string,
): { create: string[]; update: string[]; rootVar: string } {
  const rootVar = `${varPrefix}_el`;
  const create: string[] = [`const ${rootVar} = document.createElement(${JSON.stringify(op.tag)});`];
  const update: string[] = [];

  for (const [name, value] of Object.entries(op.attrs)) {
    if (name.startsWith("on:")) continue;
    if (name.startsWith("hydrate:")) continue;
    if (value.startsWith("{")) {
      const expr = memberAccessFromItem(itemName, value.slice(1, -1).trim());
      if (expr && name === "class") {
        create.push(`${rootVar}.className = String(${expr} ?? "");`);
        update.push(`${updateTarget}.className = String(${expr} ?? "");`);
        continue;
      }
      if (expr) {
        create.push(`${rootVar}.setAttribute(${JSON.stringify(name)}, String(${expr} ?? ""));`);
        update.push(`${updateTarget}.setAttribute(${JSON.stringify(name)}, String(${expr} ?? ""));`);
        continue;
      }
    }
    create.push(`${rootVar}.setAttribute(${JSON.stringify(name)}, ${JSON.stringify(value)});`);
  }

  let childIndex = 0;
  for (const child of op.children) {
    if (child.kind === "text") {
      const access = exprToItemAccess(child.expr, itemName);
      if (op.children.length === 1 && op.children[0]?.kind === "text") {
        create.push(`${rootVar}.textContent = String(${access} ?? "");`);
        update.push(`${updateTarget}.textContent = String(${access} ?? "");`);
      } else {
        const childTarget = `${updateTarget}.children[${childIndex}]`;
        create.push(`${rootVar}.textContent = String(${access} ?? "");`);
        update.push(`(${childTarget} as HTMLElement).textContent = String(${access} ?? "");`);
      }
      childIndex++;
      continue;
    }
    if (child.kind === "element") {
      const childVar = `${varPrefix}_c${childIndex}`;
      const childTarget = `${updateTarget}.children[${childIndex}]`;
      const nested = codegenLoopElement(child, itemName, childVar, childTarget);
      create.push(...nested.create);
      create.push(`${rootVar}.appendChild(${nested.rootVar});`);
      update.push(...nested.update);
      childIndex++;
      continue;
    }
    if (child.kind === "forLoop") {
      throw new Error("nested {#each} in client attach not supported yet");
    }
  }

  for (const [name, value] of Object.entries(op.attrs)) {
    if (!name.startsWith("on:")) continue;
    create.push(`bindClick(${rootVar}, ctx.${value} as () => void);`);
  }

  return { create, update, rootVar };
}

function codegenLoopBodyFunctions(spec: ForLoopAttachSpec): { createName: string; updateName: string; lines: string[] } {
  const createName = `create_${spec.listId}_row`;
  const updateName = `update_${spec.listId}_row`;
  const root = spec.body.find((op) => op.kind === "element");
  if (!root || root.kind !== "element") {
    throw new Error(`{#each ${spec.listId}} body must be a single root element`);
  }
  const { create, update, rootVar } = codegenLoopElement(root, spec.itemName, "row", "row");
  const lines = [
    `function ${createName}(_item: unknown, _index: number): HTMLElement {`,
    `  const item = _item as Record<string, unknown>;`,
    `  void _index;`,
    ...create.map((l) => `  ${l}`),
    `  return ${rootVar};`,
    `}`,
    ``,
    `function ${updateName}(row: HTMLElement, _item: unknown, _index: number): void {`,
    `  const item = _item as Record<string, unknown>;`,
    `  void _index;`,
    ...update.map((l) => `  ${l}`),
    `}`,
  ];
  return { createName, updateName, lines };
}

export function codegenForLoopAttachHelpers(specs: ForLoopAttachSpec[]): string[] {
  const lines: string[] = [];
  for (const spec of specs) {
    lines.push(...codegenLoopBodyFunctions(spec).lines);
  }
  return lines;
}

export function codegenForLoopAttachBody(specs: ForLoopAttachSpec[]): string[] {
  const lines: string[] = [];
  for (const spec of specs) {
    const fns = codegenLoopBodyFunctions(spec);
    const keyAccess = spec.keyExpr
      ? memberAccessFromItem(spec.itemName, spec.keyExpr)
      : null;
    if (spec.keyExpr && !keyAccess) {
      throw new Error(`invalid keyed each key expression: ${spec.keyExpr}`);
    }
    const reconcileCall = spec.keyExpr
      ? [
          `    reconcileKeyedList(`,
          `      ${spec.listId}Container,`,
          `      ctx.${spec.listId}.value as unknown[],`,
          `      (item) => String((${keyAccess}) ?? ""),`,
          `      ${fns.createName},`,
          `      ${fns.updateName},`,
          `    );`,
        ]
      : [
          `    reconcileNonKeyedList(`,
          `      ${spec.listId}Container,`,
          `      ctx.${spec.listId}.value as unknown[],`,
          `      ${fns.createName},`,
          `      ${fns.updateName},`,
          `    );`,
        ];
    lines.push(
      `  const ${spec.listId}Container = queryLuxelAttrFirst(root, "data-luxel-each", "${spec.listId}");`,
      `  if (!${spec.listId}Container) throw new Error('missing [data-luxel-each=${spec.listId}]');`,
      `  effect(() => {`,
      ...reconcileCall,
      `  });`,
    );
  }
  return lines;
}

export { collectForLoopSpecs };
