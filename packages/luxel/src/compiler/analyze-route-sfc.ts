import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { SemanticIr } from "./semantic-ir.ts";
import type { RenderIr } from "./render-ir.ts";
import type { ParsedSfc } from "./parse-sfc.ts";
import {
  analyzeScript,
  inferOfflineMode,
  type ClientHydration,
  type ScriptAnalysis,
} from "./analyze-script.ts";
import { inferTemplateBindings } from "./infer-bindings.ts";
import { compileTemplateIr } from "./template-ir.ts";
import { LuxelCompileError } from "./diagnostics.ts";

export type ShipSidecars = {
  data: boolean;
  hydration: boolean;
  clientScript: boolean;
};

export type RouteAnalysis = {
  semantic: SemanticIr;
  renderIr: RenderIr;
  sfc: ParsedSfc;
  script: ScriptAnalysis;
  hasClientBundle: boolean;
  hasClientNav: boolean;
  shipClientRuntime: boolean;
  clientHydration: ClientHydration;
  shipSidecars: ShipSidecars;
  bindings: TemplateBinding[];
  mode: "ssr" | "ssg" | "isr";
  offline: "none" | "static" | "stale" | "custom";
  handlerSymbols: string[];
};

export type AnalyzeRouteSfcOptions = {
  configClientHydration?: ClientHydration;
};

export function analyzeRouteSfc(
  source: string,
  routeId: string,
  options?: AnalyzeRouteSfcOptions,
): RouteAnalysis {
  const { semantic, renderIr, sfc } = compileTemplateIr(source);
  const script = analyzeScript(sfc.script);
  const hasClientBundle = renderIr.boundaryIds.length > 0;
  const hasClientNav = /data-luxel-nav/.test(sfc.template);
  const clientHydration =
    script.clientHydration ?? options?.configClientHydration ?? "auto";
  const { shipSidecars } = resolveDocumentPayload(
    clientHydration,
    renderIr,
    hasClientBundle,
    hasClientNav,
  );
  const shipClientRuntime = shipSidecars.clientScript;
  const bindings = inferTemplateBindings(routeId, semantic, sfc.script, renderIr.domOps);
  const offline = inferOfflineMode(script.mode, script.offlineOverride);
  const handlerSymbols = collectHandlerSymbols(renderIr);

  return {
    semantic,
    renderIr,
    sfc,
    script,
    hasClientBundle,
    hasClientNav,
    shipClientRuntime,
    clientHydration,
    shipSidecars,
    bindings,
    mode: script.mode,
    offline,
    handlerSymbols,
  };
}

function resolveDocumentPayload(
  clientHydration: ClientHydration,
  renderIr: RenderIr,
  hasClientBundle: boolean,
  hasClientNav: boolean,
): { shipSidecars: ShipSidecars } {
  if (clientHydration === "never" && hasClientBundle) {
    throw new LuxelCompileError([
      {
        code: "LUXEL_HYDRATION_CONFLICT",
        message:
          "export const client = { hydration: 'never' } conflicts with hydrate:* boundaries on this route",
      },
    ]);
  }
  if (clientHydration === "never") {
    return {
      shipSidecars: { data: false, hydration: false, clientScript: false },
    };
  }
  return {
    shipSidecars: {
      data: hasClientNav || hasClientBundle,
      hydration: hasClientBundle,
      clientScript: hasClientBundle || hasClientNav,
    },
  };
}

function collectHandlerSymbols(renderIr: RenderIr): string[] {
  const symbols = new Set<string>();
  for (const bind of renderIr.bindPoints) {
    symbols.add(bind.expr);
  }
  return [...symbols];
}
