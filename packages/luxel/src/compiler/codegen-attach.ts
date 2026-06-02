import type { RenderIr } from "./render-ir.ts";

export function codegenAttachModule(ir: RenderIr): string {
  const textBinds = ir.bindPoints.filter((b) => b.kind === "text");
  const clickBinds = ir.bindPoints.filter((b) => b.kind === "click");

  const ctxFields = new Set<string>();
  for (const b of textBinds) ctxFields.add(b.expr);
  for (const b of clickBinds) ctxFields.add(b.expr);

  const ctxType = `{ ${[...ctxFields].map((f) => `${f}: import("../../runtime/signal.ts").Signal<number> | (() => void)`).join("; ")} }`;

  const lines: string[] = [
    `import { bindTextSignal, bindClick } from "../../../../runtime/bind.ts";`,
    `import type { Signal } from "../../../../runtime/signal.ts";`,
    ``,
    `export function attach(root: HTMLElement, ctx: ${ctxType}): void {`,
  ];

  for (const b of textBinds) {
    lines.push(
      `  const el_${b.id} = root.querySelector('[data-luxel-text="${b.id}"]');`,
      `  bindTextSignal(el_${b.id}, ctx.${b.expr} as Signal<number>);`,
    );
  }
  for (const b of clickBinds) {
    const anchor = textBinds[0]?.id ?? b.id;
    lines.push(`  bindClick(root.querySelector('[data-luxel-text="${anchor}"]'), ctx.${b.expr} as () => void);`);
  }

  lines.push(`}`, ``);
  return lines.join("\n");
}
