import { escapeHtml } from "../html/escape.ts";
import { serializeLuxelData, type TemplateBinding } from "../resource-store/luxel-data.ts";
import type { ResourceSnapshot } from "../resource-store/types.ts";
import type { DomOp } from "./dom-op.ts";
import type { RenderIr } from "./render-ir.ts";
import type { TemplateExpr } from "./semantic-ir.ts";

export const ASSET_CLIENT = "client.dev0.js";

export type CodegenSsrOptions = {
  routePath: string;
  routeId: string;
  clientModule: string;
  shipClientRuntime?: boolean;
  shipDataSidecar?: boolean;
  shipHydrationSidecar?: boolean;
};

export function codegenSsrDocumentFromBody(
  body: string,
  resources: ResourceSnapshot,
  options: CodegenSsrOptions,
  bindings: readonly TemplateBinding[],
  boundaryIds: readonly string[] = [],
  headStyle = "",
): string {
  const paddedBody = body
    .split("\n")
    .map((line) => (line.length ? `      ${line}` : line))
    .join("\n");
  return wrapSsrShell(paddedBody, resources, options, bindings, boundaryIds, headStyle);
}

export function codegenSsrDocument(
  ir: RenderIr,
  templateData: Record<string, unknown>,
  resources: ResourceSnapshot,
  options: CodegenSsrOptions,
  bindings: readonly TemplateBinding[],
): string {
  const body = renderDomOps(ir.domOps, templateData, 6);
  return wrapSsrShell(body, resources, options, bindings, ir.boundaryIds, ir.headStyle);
}

function wrapSsrShell(
  body: string,
  resources: ResourceSnapshot,
  options: CodegenSsrOptions,
  bindings: readonly TemplateBinding[],
  boundaryIds: readonly string[],
  headStyle: string,
): string {
  const styleBlock = headStyle
    ? `    <style>\n${indentCss(headStyle, 6)}\n    </style>\n`
    : "";
  const sidecarBlocks: string[] = [];
  if (options.shipDataSidecar) {
    sidecarBlocks.push(`
    <script type="application/json" id="luxel-data">
      ${serializeLuxelData(resources)}
    </script>`);
  }
  if (options.shipHydrationSidecar) {
    sidecarBlocks.push(`
    <script type="application/json" id="luxel-hydration">
      ${JSON.stringify({
        routeId: options.routeId,
        bindings,
        boundaries: boundaryIds.map((id) => ({
          id,
          directive: "load",
          clientModule: options.clientModule,
        })),
      })}
    </script>`);
  }
  if (options.shipClientRuntime) {
    sidecarBlocks.push(`
    <script type="module" src="/assets/${ASSET_CLIENT}"></script>`);
  }
  const sidecarSection = sidecarBlocks.length ? `\n${sidecarBlocks.join("")}` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Luxel</title>
${styleBlock}  </head>
  <body>
    <main data-luxel-route="${options.routePath}">
${body}
    </main>${sidecarSection}
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
      if (op.kind === "forLoop") {
        return renderForLoop(op, data, indent);
      }
      if (op.kind === "text") {
        const value = resolveTemplateExpr(op.expr, data);
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
      innerParts.push(escapeHtml(String(resolveTemplateExpr(child.expr, data))));
      continue;
    }
    if (child.kind === "element") {
      const nested = buildElement(child, data, childIndent);
      const attrStr = Object.entries(nested.attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join("");
      innerParts.push(`<${child.tag}${attrStr}>${nested.innerHtml}</${child.tag}>`);
      continue;
    }
    if (child.kind === "forLoop") {
      innerParts.push(renderForLoop(child, data, childIndent).trim());
    }
  }

  return { attrs, innerHtml: innerParts.join("") };
}

function renderForLoop(
  op: Extract<DomOp, { kind: "forLoop" }>,
  data: Record<string, unknown>,
  indent: number,
): string {
  const list = data[op.listId];
  if (!Array.isArray(list)) return "";
  const pad = " ".repeat(indent);
  return list
    .map((item) => {
      const loopData = { ...data, [op.itemName]: item };
      return renderDomOps(op.body, loopData, indent);
    })
    .join("\n");
}

function resolveTemplateExpr(expr: TemplateExpr, data: Record<string, unknown>): unknown {
  if (expr.kind === "literal") {
    return JSON.parse(expr.raw) as unknown;
  }
  return resolveExpr(expr.raw, data);
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
