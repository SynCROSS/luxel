import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import {
  assertOfficialNonKeyedMatrixComplete,
  hasFrameworkBuildArtifact,
  isNoopBuildProdScript,
  krausestFrameworkRebuildArgs,
  missingKrausestComparisonFrameworks,
  runnableKrausestComparisonFrameworks,
  shouldFetchKrausestBuildZip,
} from "../src/bench/krausest/setup-frameworks.ts";
import type { KrausestFrameworkInfo } from "../src/bench/krausest/frameworks.ts";

const REACT_FRAMEWORK: KrausestFrameworkInfo = {
  label: "react-hooks-v19.2.0-keyed",
  driverPath: "keyed/react-hooks",
  type: "keyed",
  directory: "react-hooks",
  hasBuildProdScript: true,
};

const VUE_FRAMEWORK: KrausestFrameworkInfo = {
  label: "vue-v3.6.0-alpha.2-non-keyed",
  driverPath: "non-keyed/vue",
  type: "non-keyed",
  directory: "vue",
  customURL: "/dist",
  hasBuildProdScript: true,
};

const VANILLA_FRAMEWORK: KrausestFrameworkInfo = {
  label: "vanillajs-1-non-keyed",
  driverPath: "non-keyed/vanillajs-1",
  type: "non-keyed",
  directory: "vanillajs-1",
  hasBuildProdScript: true,
};

const LIT_FRAMEWORK: KrausestFrameworkInfo = {
  label: "lit-html-v3.2.0-non-keyed",
  driverPath: "non-keyed/lit-html",
  type: "non-keyed",
  directory: "lit-html",
  hasBuildProdScript: true,
};

const REFLEX_DOM_FRAMEWORK: KrausestFrameworkInfo = {
  label: "reflex-dom-v0.4-non-keyed",
  driverPath: "non-keyed/reflex-dom",
  type: "non-keyed",
  directory: "reflex-dom",
  customURL: "/bundled-dist",
  hasBuildProdScript: true,
};

const DELOREAN_FRAMEWORK: KrausestFrameworkInfo = {
  label: "delorean-v0.1.0-non-keyed",
  driverPath: "non-keyed/delorean",
  type: "non-keyed",
  directory: "delorean",
  hasBuildProdScript: true,
};

function writeFrameworkFile(root: string, frameworkPath: string, filePath: string, contents = ""): void {
  const fullPath = join(root, "frameworks", frameworkPath, filePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, contents);
}

describe("krausest comparison framework setup", () => {
  test("treats source-only competitor dirs as missing until build artifact exists", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-frameworks-"));
    writeFrameworkFile(root, "keyed/react-hooks", "index.html");

    expect(missingKrausestComparisonFrameworks(root, [REACT_FRAMEWORK]).map((fw) => fw.label)).toEqual([
      "react-hooks-v19.2.0-keyed",
    ]);

    writeFrameworkFile(root, "keyed/react-hooks", "dist/main.js");
    expect(missingKrausestComparisonFrameworks(root, [REACT_FRAMEWORK])).toEqual([]);
  });

  test("accepts index.html for noop build-prod frameworks like vanillajs", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-frameworks-"));
    writeFrameworkFile(
      root,
      "non-keyed/vanillajs-1",
      "package.json",
      `${JSON.stringify({ scripts: { "build-prod": "echo 0" } })}\n`,
    );
    writeFrameworkFile(root, "non-keyed/vanillajs-1", "index.html");
    expect(missingKrausestComparisonFrameworks(root, [VANILLA_FRAMEWORK])).toEqual([]);
  });

  test("accepts dist/bundle.js for webpack and rollup style builds", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-frameworks-"));
    writeFrameworkFile(root, "non-keyed/fast", "dist/bundle.js");
    const fast: KrausestFrameworkInfo = {
      label: "fast-v2.0.1-non-keyed",
      driverPath: "non-keyed/fast",
      type: "non-keyed",
      directory: "fast",
      hasBuildProdScript: true,
    };
    expect(missingKrausestComparisonFrameworks(root, [fast])).toEqual([]);
  });

  test("accepts package.json main for vode style builds", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-frameworks-"));
    writeFrameworkFile(
      root,
      "non-keyed/vode",
      "package.json",
      `${JSON.stringify({ main: "main.mjs", scripts: { "build-prod": "npm run bundle" } })}\n`,
    );
    writeFrameworkFile(root, "non-keyed/vode", "main.mjs");
    const vode: KrausestFrameworkInfo = {
      label: "vode-v1.2.0-non-keyed",
      driverPath: "non-keyed/vode",
      type: "non-keyed",
      directory: "vode",
      hasBuildProdScript: true,
    };
    expect(missingKrausestComparisonFrameworks(root, [vode])).toEqual([]);
  });

  test("accepts dist/index.js for lit-html style builds", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-frameworks-"));
    writeFrameworkFile(root, "non-keyed/lit-html", "dist/index.js");
    expect(missingKrausestComparisonFrameworks(root, [LIT_FRAMEWORK])).toEqual([]);
  });

  test("accepts customURL artifact without root index.html", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-frameworks-"));
    writeFrameworkFile(root, "non-keyed/reflex-dom", "bundled-dist/index.html");
    expect(missingKrausestComparisonFrameworks(root, [REFLEX_DOM_FRAMEWORK])).toEqual([]);
  });

  test("accepts noop prebuilt frameworks with bundled-dist artifacts", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-frameworks-"));
    writeFrameworkFile(
      root,
      "non-keyed/delorean",
      "package.json",
      `${JSON.stringify({
        scripts: {
          "build-prod":
            "echo This is a no-op. && echo Due to heavy dependencies, the generated javascript is already provided.",
        },
      })}\n`,
    );
    writeFrameworkFile(root, "non-keyed/delorean", "index.html");
    writeFrameworkFile(root, "non-keyed/delorean", "bundled-dist/index.js");
    expect(isNoopBuildProdScript(root, DELOREAN_FRAMEWORK)).toBe(true);
    expect(hasFrameworkBuildArtifact(root, DELOREAN_FRAMEWORK)).toBe(true);
    expect(missingKrausestComparisonFrameworks(root, [DELOREAN_FRAMEWORK])).toEqual([]);
  });

  test("passes upstream rebuild args as type/name paths", () => {
    expect(krausestFrameworkRebuildArgs([REACT_FRAMEWORK, VUE_FRAMEWORK])).toEqual([
      "keyed/react-hooks",
      "non-keyed/vue",
    ]);
  });

  test("runnableKrausestComparisonFrameworks keeps luxel and built competitors only", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-frameworks-"));
    writeFrameworkFile(root, "non-keyed/luxel", "index.html");
    writeFrameworkFile(root, "non-keyed/vanillajs-1", "package.json", `${JSON.stringify({ scripts: { "build-prod": "echo 0" } })}\n`);
    writeFrameworkFile(root, "non-keyed/vanillajs-1", "index.html");
    writeFrameworkFile(root, "keyed/react-hooks", "index.html");

    const luxel: KrausestFrameworkInfo = {
      label: "luxel-v0.0.0-non-keyed",
      driverPath: "non-keyed/luxel",
      type: "non-keyed",
      directory: "luxel",
      hasBuildProdScript: true,
    };
    const runnable = runnableKrausestComparisonFrameworks(root, [
      luxel,
      VANILLA_FRAMEWORK,
      REACT_FRAMEWORK,
    ]);
    expect(runnable.map((fw) => fw.label)).toEqual([
      "luxel-v0.0.0-non-keyed",
      "vanillajs-1-non-keyed",
    ]);
  });

  test("shouldFetchKrausestBuildZip skips zip when matrix artifacts already present", () => {
    expect(shouldFetchKrausestBuildZip([], { useBuildZip: true }, "/repo")).toBe(false);
    expect(shouldFetchKrausestBuildZip([VANILLA_FRAMEWORK], { useBuildZip: true }, "/repo")).toBe(
      true,
    );
    expect(shouldFetchKrausestBuildZip([VANILLA_FRAMEWORK], { useBuildZip: false }, "/repo")).toBe(
      false,
    );
    expect(shouldFetchKrausestBuildZip([VANILLA_FRAMEWORK], { useBuildZip: true })).toBe(false);
  });

  test("assertOfficialNonKeyedMatrixComplete throws when official dir missing artifact", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-official-fail-"));
    writeFrameworkFile(root, "non-keyed/vanillajs", "index.html");
    const vanillajs: KrausestFrameworkInfo = {
      label: "vanillajs-non-keyed",
      driverPath: "non-keyed/vanillajs",
      type: "non-keyed",
      directory: "vanillajs",
      hasBuildProdScript: true,
    };
    expect(() =>
      assertOfficialNonKeyedMatrixComplete(root, [vanillajs], true),
    ).toThrow(/incomplete/);
  });
});
