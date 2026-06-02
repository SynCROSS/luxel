export type Manifest = {
  version: number;
  routes: Array<{
    id: string;
    path: string;
    source: string;
    mode: "ssr";
    hasLoad: boolean;
    serverModule: string;
    clientModule: string;
    hydration: Array<{
      id: string;
      directive: string;
      componentId: string;
    }>;
    assets: { css: string; client: string };
  }>;
  components: Array<{
    id: string;
    source: string;
    cssAsset: string;
  }>;
};
