import type { TemplateBinding } from "../resource-store/luxel-data.ts";

export type Manifest = {
  version: number;
  routes: Array<{
    id: string;
    path: string;
    source: string;
    mode: "ssr" | "ssg" | "isr";
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
