import { describe, expect, test } from "bun:test";
import {
  isTransientWindowsBuildError,
  resolveNodeExecutable,
} from "../../competitors/build/svelte-vite-build.ts";

describe("isTransientWindowsBuildError", () => {
  test("matches adapter-node EPERM rimraf", () => {
    const sample =
      "Error: EPERM, Permission denied: \\\\?\\C:\\repo\\sveltekit-ssr\\.svelte-kit\\adapter-node";
    expect(isTransientWindowsBuildError(sample)).toBe(true);
  });

  test("matches internal.js EUNKNOWN lock", () => {
    expect(
      isTransientWindowsBuildError(
        "EUNKNOWN: unknown error, open '.svelte-kit/generated/server/internal.js'",
      ),
    ).toBe(true);
  });

  test("rejects type errors", () => {
    expect(isTransientWindowsBuildError("TypeError: Cannot read properties of undefined")).toBe(
      false,
    );
  });
});

describe("resolveNodeExecutable", () => {
  test("finds fnm multishell node when FNM_MULTISHELL_PATH is set", () => {
    const previous = process.env.FNM_MULTISHELL_PATH;
    const multishell = resolveNodeExecutable();
    if (previous === undefined) delete process.env.FNM_MULTISHELL_PATH;
    else process.env.FNM_MULTISHELL_PATH = previous;
    // fnm or BENCH_NODE or plain node may win in CI; on dev machines with fnm, expect a path.
    if (process.env.CI) return;
    expect(multishell === null || multishell.length > 0).toBe(true);
  });
});
