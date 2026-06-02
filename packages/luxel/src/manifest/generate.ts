import type { Manifest } from "./types.ts";
import { ASSET_CLIENT, ASSET_CSS } from "../route/counter.ts";

export function generateCounterManifest(): Manifest {
  return {
    version: 1,
    routes: [
      {
        id: "route:index",
        path: "/",
        source: "examples/counter/src/routes/index.luxel",
        mode: "ssr",
        hasLoad: true,
        serverModule: "server/routes/index.js",
        clientModule: "client/routes/index.js",
        hydration: [
          {
            id: "boundary:0",
            directive: "load",
            componentId: "sfc:index",
          },
        ],
        assets: {
          css: `assets/${ASSET_CSS}`,
          client: `assets/${ASSET_CLIENT}`,
        },
      },
    ],
    components: [
      {
        id: "sfc:index",
        source: "examples/counter/src/routes/index.luxel",
        cssAsset: `assets/${ASSET_CSS}`,
      },
    ],
  };
}
