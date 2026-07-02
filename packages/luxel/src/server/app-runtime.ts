import type { LoadContext } from "../resource-store/load-context.ts";
import type { LuxelDataV2, TemplateBinding } from "../resource-store/luxel-data.ts";
import type { ResourceStore } from "../resource-store/store.ts";
import type { Manifest } from "../manifest/types.ts";

export type AppRoute = {
  path: string;
  routeId: string;
  mode: "ssr" | "ssg" | "isr";
  revalidateSeconds?: number;
  offline: import("../runtime/trisomorphic-sw.ts").OfflineMode;
  bindings: TemplateBinding[];
  load: (ctx: LoadContext) => Promise<void>;
  prefetch?: (ctx: LoadContext) => Promise<void>;
  renderFromStore: (store: ResourceStore) => string;
  renderStreamFromStore: (store: ResourceStore) => ReadableStream<Uint8Array>;
  /** Set at compile time when `load` is constant-only; skips per-request load + render. */
  precomputedHtml?: string;
  precomputedData?: LuxelDataV2;
  /** When set, render worker delegates spiral SSR to luxel-renderd. */
  spiralRenderd?: { routePath: string; headStyle: string };
};

export type AppRuntime = {
  manifest: Manifest;
  getRoute: (path: string) => AppRoute | undefined;
};
