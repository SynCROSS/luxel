const RESERVED_SERVER_EXPORTS = new Set(["load", "prefetch"]);

export type OfflineMode = "none" | "static" | "stale" | "custom";

export type ClientHydration = "auto" | "never";

export type ScriptAnalysis = {
  hasPrefetch: boolean;
  prerender: boolean | undefined;
  revalidateSeconds: number | undefined;
  offlineOverride: OfflineMode | undefined;
  readsSession: boolean;
  staticLoadEligible: boolean;
  serverFnNames: string[];
  mode: "ssr" | "ssg" | "isr";
  clientHydration: ClientHydration | undefined;
};

export function analyzeScript(script: string): ScriptAnalysis {
  const hasPrefetch = /\bexport\s+async\s+function\s+prefetch\s*\(/m.test(script);
  const prerenderTrue = /export\s+const\s+prerender\s*=\s*true\b/.test(script);
  const prerenderFalse = /export\s+const\s+prerender\s*=\s*false\b/.test(script);
  const prerender = prerenderFalse ? false : prerenderTrue ? true : undefined;
  const revalidateMatch = /export\s+const\s+revalidate\s*=\s*(\d+)/.exec(script);
  const revalidateSeconds = revalidateMatch ? Number(revalidateMatch[1]) : undefined;
  const offlineOverride = parseOfflineExport(script);
  const readsSession = /\bctx\.session\b/.test(script);
  const staticLoadEligible = inferStaticLoad(script);
  const serverFnNames = discoverServerFunctions(script);
  const clientHydration = parseClientHydrationExport(script);
  const mode = readsSession
    ? "ssr"
    : prerender === true
      ? "ssg"
      : revalidateSeconds !== undefined
        ? "isr"
        : "ssr";

  return {
    hasPrefetch,
    prerender,
    revalidateSeconds,
    offlineOverride,
    readsSession,
    staticLoadEligible,
    serverFnNames,
    mode,
    clientHydration,
  };
}

function parseClientHydrationExport(script: string): ClientHydration | undefined {
  if (!/export\s+const\s+client\s*=/.test(script)) return undefined;
  if (/hydration\s*:\s*['"]never['"]/.test(script)) return "never";
  return "auto";
}

function parseOfflineExport(script: string): OfflineMode | undefined {
  const match = /export\s+const\s+offline\s*=\s*"(none|static|stale|custom)"/.exec(script);
  return match ? (match[1] as OfflineMode) : undefined;
}

function discoverServerFunctions(script: string): string[] {
  const names: string[] = [];
  for (const match of script.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)) {
    const name = match[1]!;
    if (!RESERVED_SERVER_EXPORTS.has(name)) names.push(name);
  }
  return names;
}

/** True when `load` only warms constant resources (no session/request/IO). */
export function inferStaticLoad(script: string): boolean {
  if (!/\bexport\s+async\s+function\s+load\s*\(/.test(script)) return false;
  if (/\bctx\.session\b|\bctx\.request\b|\bheaders\b|\bcookies\b/.test(script)) return false;
  if (/\bfetch\s*\(/.test(script)) return false;
  if (/\bstore\.isStale\s*\(/.test(script)) return false;
  return true;
}

export function inferOfflineMode(
  mode: "ssr" | "ssg" | "isr",
  override?: OfflineMode,
): OfflineMode {
  if (override) return override;
  if (mode === "ssg") return "static";
  if (mode === "isr") return "stale";
  return "none";
}
