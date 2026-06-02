import { readFile } from "node:fs/promises";
import { compileSemanticIr } from "./semantic-ir.ts";
import { lowerToRenderIr } from "./render-ir.ts";
import { renderSsrDocument } from "../route/counter.ts";
import type { CounterLoadData } from "../route/counter.ts";

export async function compileCounterRouteFromSfc(
  sfcPath: string,
  data: CounterLoadData,
): Promise<string> {
  const source = await readFile(sfcPath, "utf8");
  const semantic = compileSemanticIr(source);
  lowerToRenderIr(semantic);
  return renderSsrDocument(data);
}
