import type { ParsedSfc } from "./parse-sfc.ts";
import { parseSfc } from "./parse-sfc.ts";
import {
  compileSemanticIrFromSfc,
  type SemanticIr,
} from "./semantic-ir.ts";
import { lowerToRenderIrFromSfc, type RenderIr } from "./render-ir.ts";

export type TemplateIr = {
  semantic: SemanticIr;
  renderIr: RenderIr;
  sfc: ParsedSfc;
};

/** Single-parse template pipeline: semantic IR + render IR. */
export function compileTemplateIr(source: string): TemplateIr {
  const sfc = parseSfc(source);
  return compileTemplateIrFromSfc(sfc, source);
}

export function compileTemplateIrFromSfc(sfc: ParsedSfc, source: string): TemplateIr {
  const semantic = compileSemanticIrFromSfc(sfc, source);
  const renderIr = lowerToRenderIrFromSfc(sfc);
  return { semantic, renderIr, sfc };
}
