import { escapeHtml } from "../html/escape.ts";
import type { DomOp } from "./dom-op.ts";
import type { RenderIr } from "./render-ir.ts";

export const ASSET_CLIENT = "client.dev0.js";

export type CodegenSsrOptions = {
  routePath: string;
  routeId: string;
  clientModule: string;
};

export function codegenSsrDocument(
  ir: RenderIr,
  data: Record<string, unknown>,
  options: CodegenSsrOptions,
): string {
  const body = renderDomOps(ir.domOps, data, 6);
  const dataJson = JSON.stringify(data);
  const hydrationJson = JSON.stringify({
    routeId: options.routeId,
    boundaries: ir.boundaryIds.map((id) => ({
      id,
      directive: "load",
      clientModule: options.clientModule,
    })),
  });
  const styleBlock = ir.headStyle
    ? `    <style>\n${indentCss(ir.headStyle, 6)}\n    </style>\n`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Luxel</title>
${styleBlock}  </head>
  <body>
    <main data-luxel-route="${options.routePath}">
${body}
    </main>

    <script type="application/json" id="luxel-data">
      ${dataJson}
    </script>
    <script type="application/json" id="luxel-hydration">
      ${hydrationJson}
    </script>
    ${ir.boundaryIds.length > 0 ? `<script type="module" src="/assets/${ASSET_CLIENT}"></script>` : ""}
  </body>
</html>`;
}

function renderDomOps(ops: DomOp[], data: Record<string, unknown>, indent: number): string {
  const pad = " ".repeat(indent);
  return ops
    .map((op) => {
      if (op.kind === "boundaryStart") {
        return `${pad}<!-- luxel:boundary-start id="${op.id}" directive="${op.directive}" -->`;
      }
      if (op.kind === "boundaryEnd") {
        return `${pad}<!-- luxel:boundary-end id="${op.id}" -->`;
      }
      if (op.kind === "text") {
        const value = resolveExpr(op.expr.raw, data);
        return `${pad}${escapeHtml(String(value))}`;
      }
      const { attrs, innerHtml } = buildElement(op, data, indent + 2);
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join("");
      if (!innerHtml) {
        return `${pad}<${op.tag}${attrStr}></${op.tag}>`;
      }
      return `${pad}<${op.tag}${attrStr}>${innerHtml}</${op.tag}>`;
    })
    .join("\n");
}

function buildElement(
  op: Extract<DomOp, { kind: "element" }>,
  data: Record<string, unknown>,
  childIndent: number,
): { attrs: Record<string, string>; innerHtml: string } {
  const attrs: Record<string, string> = {};
  for (const [name, value] of Object.entries(op.attrs)) {
    if (name.startsWith("on:")) continue;
    if (name.startsWith("hydrate:")) continue;
    attrs[name] = value;
  }

  const innerParts: string[] = [];
  for (const child of op.children) {
    if (child.kind === "text" && child.expr.raw === "count") {
      attrs["data-luxel-text"] = "count";
      innerParts.push("0");
      continue;
    }
    if (child.kind === "text") {
      innerParts.push(escapeHtml(String(resolveExpr(child.expr.raw, data))));
      continue;
    }
    if (child.kind === "element") {
      const nested = buildElement(child, data, childIndent);
      const attrStr = Object.entries(nested.attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join("");
      innerParts.push(`<${child.tag}${attrStr}>${nested.innerHtml}</${child.tag}>`);
    }
  }

  return { attrs, innerHtml: innerParts.join("") };
}

function resolveExpr(raw: string, data: Record<string, unknown>): unknown {
  if (raw.includes(".")) {
    const [head, ...rest] = raw.split(".");
    let cur: unknown = data[head!];
    for (const key of rest) {
      cur = (cur as Record<string, unknown>)?.[key];
    }
    return cur;
  }
  return data[raw];
}

function indentCss(css: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return css
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}
