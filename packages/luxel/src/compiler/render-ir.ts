import type { SemanticIr } from "./semantic-ir.ts";
import { LuxelCompileError } from "./diagnostics.ts";
import type { BindPoint, DomOp } from "./dom-op.ts";
import { lowerTemplateToDomOps } from "./lower-template.ts";
import { parseSfc } from "./parse-sfc.ts";

export type RenderIr = {
  domOps: DomOp[];
  bindPoints: BindPoint[];
  boundaryIds: string[];
  headStyle: string;
};

export function lowerToRenderIr(semantic: SemanticIr, sfcSource: string): RenderIr {
  const sfc = parseSfc(sfcSource);
  const { domOps, bindPoints, boundaryIds } = lowerTemplateToDomOps(sfc.template);
  const headStyle = sfc.style.replace(/^\s*scoped\s*/i, "").trim();

  return { domOps, bindPoints, boundaryIds, headStyle };
}
