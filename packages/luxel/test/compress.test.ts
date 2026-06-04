import { describe, expect, test } from "bun:test";
import { createTestServer } from "../src/test/server.ts";
import { wrapCompress } from "../src/server/compress.ts";
import { createAppFetch, createAppServerFetch } from "../src/server/handler.ts";
import { compileCounterApp } from "../src/route/compile-app.ts";
import { bundleClient } from "../src/build/client-bundle.ts";
import { loadLuxelConfig } from "../src/config/load.ts";
import {
  resolveCompressOptions,
  resolveProductionCompressOptions,
} from "../src/config/compress.ts";
import { ASSET_CLIENT } from "../src/compiler/codegen-ssr.ts";
import { buildApp } from "../src/build/build-app.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const repoRoot = join(import.meta.dir, "../../..");

async function counterFetch(compress?: Parameters<typeof wrapCompress>[1]) {
  const app = await compileCounterApp(repoRoot);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);
  return wrapCompress(createAppFetch({ app, clientBundle: js }), {
    enabled: true,
    encodings: ["gzip"],
    ...compress,
  });
}

describe("wrapCompress", () => {
  test("buffered HTML is gzip-compressed when enabled and client accepts gzip", async () => {
    const appFetch = await counterFetch({ threshold: 0 });
    const req = new Request("http://test.local/", {
      headers: { "accept-encoding": "gzip" },
    });
    const res = await appFetch(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-encoding")).toBe("gzip");
    const raw = Buffer.from(await res.arrayBuffer());
    const html = gunzipSync(raw).toString("utf8");
    expect(html).toContain("Hello Luxel");
  });

  test("default test server leaves responses identity-encoded", async () => {
    const server = await createTestServer();
    try {
      const res = await fetch(server.url);
      expect(res.headers.get("content-encoding")).toBeNull();
    } finally {
      server.close();
    }
  });

  test("responses below size floor stay identity-encoded", async () => {
    const appFetch = await counterFetch({ threshold: 1024 });
    const res = await appFetch(
      new Request("http://test.local/", { headers: { "accept-encoding": "gzip" } }),
    );
    expect(res.headers.get("content-encoding")).toBeNull();
  });

  test("client JS asset compresses when above size floor", async () => {
    const appFetch = await counterFetch({ threshold: 1024 });
    const res = await appFetch(
      new Request(`http://test.local/assets/${ASSET_CLIENT}`, {
        headers: { "accept-encoding": "gzip" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-encoding")).toBe("gzip");
    expect(res.headers.get("content-type")).toContain("javascript");
  });

  test("stream query skips compression", async () => {
    const appFetch = await counterFetch({ threshold: 0 });
    const res = await appFetch(
      new Request("http://test.local/?stream=1", { headers: { "accept-encoding": "gzip" } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-encoding")).toBeNull();
  });

  test("HEAD responses are not compressed", async () => {
    const appFetch = await counterFetch({ threshold: 0 });
    const res = await appFetch(
      new Request("http://test.local/", {
        method: "HEAD",
        headers: { "accept-encoding": "gzip" },
      }),
    );
    expect(res.headers.get("content-encoding")).toBeNull();
  });

  test("merges Vary: Accept-Encoding when compressing", async () => {
    const inner = async () =>
      new Response("<html></html>", {
        headers: { "content-type": "text/html; charset=utf-8", vary: "Cookie" },
      });
    const res = await wrapCompress(inner, { enabled: true, threshold: 0, encodings: ["gzip"] })(
      new Request("http://test.local/", {
        headers: { "accept-encoding": "gzip" },
      }),
    );
    expect(res.headers.get("vary")).toBe("Cookie, Accept-Encoding");
  });

  test("honors Accept-Encoding quality values", async () => {
    const inner = async () =>
      new Response("x".repeat(64), {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    const res = await wrapCompress(inner, {
      enabled: true,
      threshold: 0,
      encodings: ["zstd", "br", "gzip"],
    })(
      new Request("http://test.local/", {
        headers: { "accept-encoding": "gzip;q=0.5, br;q=1" },
      }),
    );
    expect(res.headers.get("content-encoding")).toBe("br");
  });

  test("skips non-compressible MIME types", async () => {
    const inner = async () =>
      new Response("binary", { headers: { "content-type": "image/png" } });
    const res = await wrapCompress(inner, { enabled: true, threshold: 0, encodings: ["gzip"] })(
      new Request("http://test.local/", { headers: { "accept-encoding": "gzip" } }),
    );
    expect(res.headers.get("content-encoding")).toBeNull();
  });

  test("skips already-encoded responses", async () => {
    const inner = async () =>
      new Response("abc", {
        headers: {
          "content-type": "text/plain",
          "content-encoding": "gzip",
        },
      });
    const res = await wrapCompress(inner, { enabled: true, threshold: 0, encodings: ["gzip"] })(
      new Request("http://test.local/", { headers: { "accept-encoding": "gzip" } }),
    );
    expect(res.headers.get("content-encoding")).toBe("gzip");
    expect(await res.text()).toBe("abc");
  });
});

describe("compress config", () => {
  test("loadLuxelConfig reads optional server.compress", async () => {
    const config = await loadLuxelConfig(join(repoRoot, "examples/counter"));
    expect(config.root).toBe(".");
    expect(config.server?.compress?.threshold ?? "missing").toBe("missing");
  });

  test("resolveCompressOptions applies overrides over config", () => {
    expect(
      resolveCompressOptions({ enabled: true, threshold: 512 }, { enabled: false }),
    ).toEqual({
      enabled: false,
      threshold: 512,
      encodings: ["zstd", "br", "gzip", "deflate"],
    });
  });

  test("resolveProductionCompressOptions enables by default", () => {
    expect(resolveProductionCompressOptions().enabled).toBe(true);
    expect(resolveProductionCompressOptions({ enabled: false }).enabled).toBe(false);
  });

  test("createAppServerFetch compresses when compress.enabled", async () => {
    const app = await compileCounterApp(repoRoot);
    const genRoot = await app.writeCache();
    const { js } = await bundleClient(genRoot);
    const fetch = createAppServerFetch({
      app,
      clientBundle: js,
      compress: { enabled: true, threshold: 0, encodings: ["gzip"] },
    });
    const res = await fetch(
      new Request(`http://test.local/assets/${ASSET_CLIENT}`, {
        headers: { "accept-encoding": "gzip" },
      }),
    );
    expect(res.headers.get("content-encoding")).toBe("gzip");
  });
});

describe("build production compress", () => {
  test("server entry wires productionCompress with enabled true", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    const entry = await readFile(join(outDir, "server", "entry.js"), "utf8");
    expect(entry).toContain("createAppServerFetch");
    expect(entry).toContain('"enabled":true');
    expect(entry).toContain("productionCompress");
  });
});
