import type { ParsedSfc } from "./parse-sfc.ts";
import type { SemanticIr } from "./semantic-ir.ts";
import type { BindPoint, DomOp } from "./dom-op.ts";
import { lowerTemplateToDomOps } from "./lower-template.ts";
import { parseSfc } from "./parse-sfc.ts";

export type RenderIr = {
  domOps: DomOp[];
  bindPoints: BindPoint[];
  boundaryIds: string[];
  headStyle: string;
};

export function lowerToRenderIr(_semantic: SemanticIr, sfcSource: string): RenderIr {
  return lowerToRenderIrFromSfc(parseSfc(sfcSource));
}

export function lowerToRenderIrFromSfc(sfc: ParsedSfc): RenderIr {
  const { domOps, bindPoints, boundaryIds } = lowerTemplateToDomOps(sfc.template);
  const headStyle = sfc.style.replace(/^\s*scoped\s*/i, "").trim();
  return { domOps, bindPoints, boundaryIds, headStyle };
}
