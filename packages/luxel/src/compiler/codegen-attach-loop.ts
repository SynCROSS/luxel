import type { DomOp } from "./dom-op.ts";
import {
  collectForLoopSpecs,
  exprToItemAccess,
  memberAccessFromItem,
  type ForLoopAttachSpec,
} from "./attach-loop.ts";

type LoopSlotSpec = {
  /** Expression relative to `row` used once when caching slots. */
  capture: string;
};

function textWrite(elExpr: string, nextExpr: string): string {
  // Template always seeds an empty Text node, so firstChild is present.
  return `${elExpr}.firstChild!.nodeValue = ${nextExpr};`;
}

/**
 * Build create/update bodies for a loop row.
 * - create: unconditional writes via slots + seed cache.
 * - update: last-written vals; text via nodeValue (cheaper than textContent).
 */
function codegenLoopElement(
  op: Extract<DomOp, { kind: "element" }>,
  itemName: string,
  varPrefix: string,
  pathFromRow: string,
  slots: LoopSlotSpec[],
  nextVal: () => number,
): { template: string[]; update: string[]; createFill: string[]; rootVar: string } {
  const rootVar = `${varPrefix}_el`;
  const template: string[] = [`const ${rootVar} = document.createElement(${JSON.stringify(op.tag)});`];
  const update: string[] = [];
  const createFill: string[] = [];

  let updateElCache: string | null = null;
  const updateEl = (): string => {
    if (updateElCache) return updateElCache;
    if (pathFromRow === "row") {
      updateElCache = "row";
      return updateElCache;
    }
    const i = slots.length;
    slots.push({ capture: pathFromRow });
    updateElCache = `slots[${i}]!`;
    return updateElCache;
  };

  for (const [name, value] of Object.entries(op.attrs)) {
    if (name.startsWith("on:")) continue;
    if (name.startsWith("hydrate:")) continue;
    if (value.startsWith("{")) {
      const expr = memberAccessFromItem(itemName, value.slice(1, -1).trim());
      if (expr && name === "class") {
        template.push(`${rootVar}.className = "";`);
        const el = updateEl();
        const vi = nextVal();
        update.push(
          `{ const _next = String(${expr} ?? ""); if (vals[${vi}] !== _next) { vals[${vi}] = _next; ${el}.className = _next; } }`,
        );
        createFill.push(
          `{ const _next = String(${expr} ?? ""); vals[${vi}] = _next; ${el}.className = _next; }`,
        );
        continue;
      }
      if (expr) {
        template.push(`${rootVar}.setAttribute(${JSON.stringify(name)}, "");`);
        const el = updateEl();
        const vi = nextVal();
        update.push(
          `{ const _next = String(${expr} ?? ""); if (vals[${vi}] !== _next) { vals[${vi}] = _next; ${el}.setAttribute(${JSON.stringify(name)}, _next); } }`,
        );
        createFill.push(
          `{ const _next = String(${expr} ?? ""); vals[${vi}] = _next; ${el}.setAttribute(${JSON.stringify(name)}, _next); }`,
        );
        continue;
      }
    }
    if (name === "class") {
      template.push(`${rootVar}.className = ${JSON.stringify(value)};`);
    } else {
      template.push(`${rootVar}.setAttribute(${JSON.stringify(name)}, ${JSON.stringify(value)});`);
    }
  }

  let childIndex = 0;
  for (const child of op.children) {
    if (child.kind === "text") {
      const access = exprToItemAccess(child.expr, itemName);
      template.push(`${rootVar}.appendChild(document.createTextNode(""));`);
      const el = updateEl();
      const vi = nextVal();
      update.push(
        `{ const _next = String(${access} ?? ""); if (vals[${vi}] !== _next) { vals[${vi}] = _next; ${textWrite(el, "_next")} } }`,
      );
      createFill.push(
        `{ const _next = String(${access} ?? ""); vals[${vi}] = _next; ${textWrite(el, "_next")} }`,
      );
      childIndex++;
      continue;
    }
    if (child.kind === "element") {
      const childVar = `${varPrefix}_c${childIndex}`;
      const childPath = `${pathFromRow}.children[${childIndex}]`;
      const nested = codegenLoopElement(child, itemName, childVar, childPath, slots, nextVal);
      template.push(...nested.template);
      template.push(`${rootVar}.appendChild(${nested.rootVar});`);
      update.push(...nested.update);
      createFill.push(...nested.createFill);
      childIndex++;
      continue;
    }
    if (child.kind === "forLoop") {
      throw new Error("nested {#each} in client attach not supported yet");
    }
  }

  for (const [name, value] of Object.entries(op.attrs)) {
    if (!name.startsWith("on:")) continue;
    template.push(`${rootVar}.setAttribute("data-luxel-click", ${JSON.stringify(value)});`);
  }

  return { template, update, createFill, rootVar };
}

function codegenLoopBodyFunctions(spec: ForLoopAttachSpec): {
  createName: string;
  updateName: string;
  lines: string[];
} {
  const createName = `create_${spec.listId}_row`;
  const updateName = `update_${spec.listId}_row`;
  const templateName = `${spec.listId}_row_template`;
  const ensureName = `ensure_${spec.listId}_row_template`;
  const cacheName = `${spec.listId}_row_cache`;
  const root = spec.body.find((op) => op.kind === "element");
  if (!root || root.kind !== "element") {
    throw new Error(`{#each ${spec.listId}} body must be a single root element`);
  }
  const slots: LoopSlotSpec[] = [];
  let valCount = 0;
  const nextVal = () => valCount++;
  const { template, update, createFill, rootVar } = codegenLoopElement(
    root,
    spec.itemName,
    "row",
    "row",
    slots,
    nextVal,
  );
  const lines = [
    `let ${templateName}: HTMLElement | null = null;`,
    `const ${cacheName} = new WeakMap<HTMLElement, { slots: HTMLElement[]; vals: string[] }>();`,
    `function ${ensureName}(): HTMLElement {`,
    `  if (${templateName}) return ${templateName};`,
    ...template.map((l) => `  ${l}`),
    `  ${templateName} = ${rootVar};`,
    `  return ${templateName};`,
    `}`,
    ``,
    `function ${createName}(_item: unknown, _index: number): HTMLElement {`,
    `  const row = ${ensureName}().cloneNode(true) as HTMLElement;`,
    `  const item = _item as Record<string, unknown>;`,
    `  void _index;`,
    `  const slots = [${slots.map((s) => `${s.capture} as HTMLElement`).join(", ")}];`,
    `  const vals = Array(${valCount}) as string[];`,
    ...createFill.map((l) => `  ${l}`),
    `  ${cacheName}.set(row, { slots, vals });`,
    `  return row;`,
    `}`,
    ``,
    `function ${updateName}(row: HTMLElement, _item: unknown, _index: number): void {`,
    `  const item = _item as Record<string, unknown>;`,
    `  void _index;`,
    `  let cache = ${cacheName}.get(row);`,
    `  if (!cache) {`,
    `    cache = {`,
    `      slots: [${slots.map((s) => `${s.capture} as HTMLElement`).join(", ")}],`,
    `      vals: Array(${valCount}).fill("") as string[],`,
    `    };`,
    `    ${cacheName}.set(row, cache);`,
    `  }`,
    `  const slots = cache.slots;`,
    `  const vals = cache.vals;`,
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
      `  bindDelegatedClicks(${spec.listId}Container, (name, event) => {`,
      `    const handler = rowCtx[name as keyof typeof rowCtx];`,
      `    if (typeof handler === "function") (handler as (event: MouseEvent) => void)(event);`,
      `  });`,
      `  effect(() => {`,
      ...reconcileCall,
      `  });`,
    );
  }
  return lines;
}

export { collectForLoopSpecs };
