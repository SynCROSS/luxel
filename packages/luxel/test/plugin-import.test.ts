import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createSandboxImports,
  loadWasmAddPlugin,
  loadWasmFetchPlugin,
} from "../src/plugin/wasm-sandbox.ts";

const fixtures = join(import.meta.dir, "fixtures/plugins");

describe("plugin import capabilities", () => {
  test("fetch-import wasm fails without network capability", async () => {
    const wasm = await readFile(join(fixtures, "fetch-import.wasm"));
    await expect(loadWasmFetchPlugin(wasm)).rejects.toThrow();
  });

  test("fetch-import wasm runs with network capability stub", async () => {
    const wasm = await readFile(join(fixtures, "fetch-import.wasm"));
    const plugin = await loadWasmFetchPlugin(wasm, ["transform-script", "network"]);
    expect(plugin.run()).toBe(42);
  });

  test("createSandboxImports exposes fetch only with network", () => {
    expect(createSandboxImports(["transform-script"])).toEqual({});
    expect(createSandboxImports(["transform-script", "network"]).env?.fetch).toBeTypeOf("function");
  });

  test("add plugin still needs no imports", async () => {
    const plugin = await loadWasmAddPlugin();
    expect(plugin.run(1, 1)).toBe(2);
  });
});
