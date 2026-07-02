import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { ManifestNativeDiagnostics } from "../config/native-mode.ts";
import type { ManifestGpuDiagnostics } from "../config/native-gpu.ts";

export type Manifest = {
  version: number;
  native?: ManifestNativeDiagnostics;
  gpu?: ManifestGpuDiagnostics;
  routes: Array<{
    id: string;
    path: string;
    source: string;
    mode: "ssr" | "ssg" | "isr";
    /** SSR execution backend; default ts. native = luxel-core hot path when eligible. */
    ssr?: "ts" | "native";
    /** Spiral native SSR: inline NAPI vs luxel-renderd child process. */
    nativeRuntime?: "inline" | "process";
    revalidateSeconds?: number;
    hasLoad: boolean;
    hasPrefetch?: boolean;
    bindings: TemplateBinding[];
    serverModule: string;
    clientModule: string;
    hydration: Array<{
      id: string;
      directive: string;
      componentId: string;
    }>;
    assets: { client: string; css?: string };
    serverFunctions?: Array<{ id: string; name: string }>;
    offline: "none" | "static" | "stale" | "custom";
    client: { hydration: "auto" | "never" };
    shipSidecars: { data: boolean; hydration: boolean; clientScript: boolean };
  }>;
  components: Array<{
    id: string;
    source: string;
    cssAsset?: string;
  }>;
};
