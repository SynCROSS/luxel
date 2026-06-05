import { describe, expect, test } from "bun:test";
import { createSandboxImports, loadWasmAddPlugin } from "../src/plugin/wasm-sandbox.ts";
import { validatePluginManifest } from "../src/plugin/manifest.ts";

describe("plugin wasm sandbox", () => {
  test("sample wasm hook runs add without host imports", async () => {
    const plugin = await loadWasmAddPlugin();
    expect(plugin.run(2, 40)).toBe(42);
  });

  test("sandbox import policy is empty without network", () => {
    expect(createSandboxImports(["transform-script"])).toEqual({});
    expect(createSandboxImports(["transform-script", "network"]).env?.fetch).toBeTypeOf("function");
  });

  test("network capability allowed in manifest", () => {
    expect(() =>
      validatePluginManifest({
        id: "net",
        wasmPath: "n.wasm",
        capabilities: ["transform-script", "network"],
      }),
    ).not.toThrow();
  });

  test("manifest rejects unknown capabilities", () => {
    expect(() =>
      validatePluginManifest({
        id: "bad",
        wasmPath: "x.wasm",
        capabilities: ["filesystem" as unknown as "transform-script"],
      }),
    ).toThrow("capability not allowed");
  });
});
