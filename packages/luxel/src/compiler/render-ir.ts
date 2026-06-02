import type { SemanticIr } from "./semantic-ir.ts";
import { LuxelCompileError } from "./diagnostics.ts";

export type RenderIr = {
  messageBinding: string;
  countBinding: string;
  hydrateLoad: boolean;
};

export function lowerToRenderIr(semantic: SemanticIr): RenderIr {
  if (!semantic.hasHydrateLoad) {
    throw new LuxelCompileError([
      {
        code: "LUXEL_MISSING_HYDRATE_BOUNDARY",
        message: "Prototype fixture requires hydrate:load boundary",
      },
    ]);
  }

  return {
    messageBinding: "message",
    countBinding: "count",
    hydrateLoad: true,
  };
}
