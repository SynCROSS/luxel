import type { TemplateExpr } from "./semantic-ir.ts";

export type DomOp =
  | { kind: "element"; tag: string; attrs: Record<string, string>; children: DomOp[] }
  | { kind: "text"; expr: TemplateExpr }
  | { kind: "forLoop"; listId: string; itemName: string; body: DomOp[] }
  | { kind: "boundaryStart"; id: string; directive: string }
  | { kind: "boundaryEnd"; id: string };

export type BindPoint = {
  id: string;
  kind: "text" | "click";
  expr: string;
};
