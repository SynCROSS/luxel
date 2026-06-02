import { ASSET_CLIENT, ASSET_CSS } from "../route/counter.ts";
import { createRenderWorker } from "./render-worker.ts";
import type { Manifest } from "../manifest/types.ts";

export type AppServerOptions = {
  manifest?: Manifest;
  clientBundle: Uint8Array | string;
  css: string;
};

export function createAppFetch(options: AppServerOptions): (req: Request) => Promise<Response> {
  const worker = createRenderWorker();

  return async (req) => {
    const url = new URL(req.url);

    if (url.pathname === `/assets/${ASSET_CSS}`) {
      return new Response(options.css, {
        headers: { "content-type": "text/css; charset=utf-8" },
      });
    }

    if (url.pathname === `/assets/${ASSET_CLIENT}`) {
      const body = typeof options.clientBundle === "string" ? options.clientBundle : options.clientBundle;
      return new Response(body, {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
    }

    if (url.pathname === "/" || url.pathname === "") {
      const { html } = await worker.renderIndex();
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  };
}
