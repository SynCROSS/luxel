import type { RenderIr } from "./render-ir.ts";
import { collectAttachContextSymbols, collectForLoopSpecs } from "./attach-loop.ts";
import { codegenForLoopAttachBody, codegenForLoopAttachHelpers } from "./codegen-attach-loop.ts";

export function codegenAttachModule(ir: RenderIr): string {
  const textBinds = ir.bindPoints.filter((b) => b.kind === "text");
  const clickBinds = ir.bindPoints.filter((b) => b.kind === "click");
  const forLoops = collectForLoopSpecs(ir.domOps);

  const ctxFields = collectAttachContextSymbols(
    [...textBinds, ...clickBinds].map((b) => b.expr),
    ir.domOps,
  );

  const ctxType = `{ ${ctxFields
    .map((f) => `${f}: import("../../runtime/signal.ts").Signal<unknown> | (() => void)`)
    .join("; ")} }`;

  const helperLines = forLoops.length > 0 ? codegenForLoopAttachHelpers(forLoops) : [];
  const attachBodyLines: string[] = [];
  const rowCtxLines =
    forLoops.length > 0
      ? [`let rowCtx: ${ctxType};`, ``]
      : [];

  for (const b of textBinds) {
    attachBodyLines.push(
      `  const el_${b.id} = root.querySelector('[data-luxel-text="${b.id}"]');`,
      `  bindTextSignal(el_${b.id}, ctx.${b.expr} as Signal<number>);`,
    );
  }
  for (const b of clickBinds) {
    attachBodyLines.push(
      `  for (const _el of queryLuxelAttr(root, "data-luxel-click", "${b.expr}")) {`,
      `    bindClick(_el, ctx.${b.expr} as (event: MouseEvent) => void);`,
      `  }`,
    );
  }
  if (forLoops.length > 0) {
    attachBodyLines.push(...codegenForLoopAttachBody(forLoops));
  }

  return [
    `import { bindTextSignal, bindClick, bindDelegatedClicks, queryLuxelAttr, queryLuxelAttrFirst } from "../../../../runtime/bind.ts";`,
    `import { effect } from "../../../../runtime/signal.ts";`,
    `import { reconcileNonKeyedList } from "../../../../runtime/list-reconcile.ts";`,
    `import { reconcileKeyedList } from "../../../../runtime/list-reconcile-keyed.ts";`,
    `import type { Signal } from "../../../../runtime/signal.ts";`,
    ``,
    ...rowCtxLines,
    ...helperLines,
    ``,
    `export function attach(root: HTMLElement, ctx: ${ctxType}): void {`,
    ...(forLoops.length > 0 ? [`  rowCtx = ctx;`] : []),
    ...attachBodyLines,
    `}`,
    ``,
  ].join("\n");
}

export { collectAttachContextSymbols };
