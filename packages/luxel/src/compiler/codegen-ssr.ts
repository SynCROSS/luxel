import { escapeHtml } from "../html/escape.ts";
import {
  serializeLuxelData,
  serializeLuxelHydration,
  type TemplateBinding,
} from "../resource-store/luxel-data.ts";
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
  return wrapSsrShell(body, resources, options, bindings, boundaryIds, headStyle);
}

export function codegenSsrDocument(
  ir: RenderIr,
  templateData: Record<string, unknown>,
  resources: ResourceSnapshot,
  options: CodegenSsrOptions,
  bindings: readonly TemplateBinding[],
): string {
  const body = renderDomOps(ir.domOps, templateData);
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
  const bodyMarkup = compactHtmlFragment(body);
  const styleBlock = headStyle ? `<style>${compactCss(headStyle)}</style>` : "";
  const sidecarBlocks: string[] = [];
  if (options.shipDataSidecar) {
    sidecarBlocks.push(
      `<script type="application/json" id="luxel-data">${serializeLuxelData(resources)}</script>`,
    );
  }
  if (options.shipHydrationSidecar) {
    sidecarBlocks.push(
      `<script type="application/json" id="luxel-hydration">${serializeLuxelHydration({
        routeId: options.routeId,
        bindings,
        boundaries: boundaryIds.map((id) => ({
          id,
          directive: "load",
          clientModule: options.clientModule,
        })),
      })}</script>`,
    );
  }
  if (options.shipClientRuntime) {
    sidecarBlocks.push(`<script type="module" src="/assets/${ASSET_CLIENT}"></script>`);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title>${styleBlock}</head><body><main data-luxel-route="${options.routePath}">${bodyMarkup}</main>${sidecarBlocks.join("")}</body></html>`;
}

function compactHtmlFragment(html: string): string {
  return html
    .split("\n")
    .map((line) => line.trim())
    .join("");
}

function compactCss(css: string): string {
  return css
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*;\s*/g, ";")
    .replace(/\s*{\s*/g, "{")
    .replace(/\s*}\s*/g, "}");
}

function renderDomOps(ops: DomOp[], data: Record<string, unknown>): string {
  return ops
    .map((op) => {
      if (op.kind === "boundaryStart") {
        return `<!-- luxel:boundary-start id="${op.id}" directive="${op.directive}" -->`;
      }
      if (op.kind === "boundaryEnd") {
        return `<!-- luxel:boundary-end id="${op.id}" -->`;
      }
      if (op.kind === "forLoop") {
        return renderForLoop(op, data);
      }
      if (op.kind === "text") {
        const value = resolveTemplateExpr(op.expr, data);
        return escapeHtml(String(value));
      }
      const { attrs, innerHtml } = buildElement(op, data);
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join("");
      if (!innerHtml) {
        return `<${op.tag}${attrStr}></${op.tag}>`;
      }
      return `<${op.tag}${attrStr}>${innerHtml}</${op.tag}>`;
    })
    .join("\n");
}

function buildElement(
  op: Extract<DomOp, { kind: "element" }>,
  data: Record<string, unknown>,
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
      const nested = buildElement(child, data);
      const attrStr = Object.entries(nested.attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join("");
      innerParts.push(`<${child.tag}${attrStr}>${nested.innerHtml}</${child.tag}>`);
      continue;
    }
    if (child.kind === "forLoop") {
      innerParts.push(renderForLoop(child, data).trim());
    }
  }

  return { attrs, innerHtml: innerParts.join("") };
}

function renderForLoop(
  op: Extract<DomOp, { kind: "forLoop" }>,
  data: Record<string, unknown>,
): string {
  const list = data[op.listId];
  if (!Array.isArray(list)) return "";
  return list
    .map((item) => {
      const loopData = { ...data, [op.itemName]: item };
      return renderDomOps(op.body, loopData);
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
