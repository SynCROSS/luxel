import { describe, expect, test } from "bun:test";
import {
  buildKrausestRunOptions,
  parseKrausestBenchArgv,
  type KrausestBenchMode,
} from "../src/bench/krausest/cli.ts";
import type { KrausestFrameworkInfo } from "../src/bench/krausest/frameworks.ts";

const luxel: KrausestFrameworkInfo = {
  label: "luxel-v0.0.0-non-keyed",
  driverPath: "non-keyed/luxel",
  type: "non-keyed",
  directory: "luxel",
  hasBuildProdScript: true,
};

describe("parseKrausestBenchArgv", () => {
  test("returns null when --krausest absent", () => {
    expect(parseKrausestBenchArgv(["--gate"])).toBeNull();
  });

  test("defaults to slice1 luxel-only smoke", () => {
    expect(parseKrausestBenchArgv(["--krausest"])).toEqual({
      fullMatrix: false,
      allFrameworks: false,
      compareSet: false,
      allScenarios: false,
      gate: false,
      writeArtifacts: false,
    });
  });

  test("--full enables non-keyed matrix + artifacts", () => {
    expect(parseKrausestBenchArgv(["--krausest", "--full"])).toEqual({
      fullMatrix: true,
      allFrameworks: false,
      compareSet: false,
      allScenarios: true,
      gate: false,
      writeArtifacts: true,
    });
  });

  test("--all-frameworks enables keyed + non-keyed matrix + artifacts", () => {
    expect(parseKrausestBenchArgv(["--krausest", "--all-frameworks"])).toEqual({
      fullMatrix: true,
      allFrameworks: true,
      compareSet: false,
      allScenarios: true,
      gate: false,
      writeArtifacts: true,
    });
  });

  test("--compare enables default comparison set + artifacts", () => {
    expect(parseKrausestBenchArgv(["--krausest", "--compare"])).toEqual({
      fullMatrix: false,
      allFrameworks: false,
      compareSet: true,
      allScenarios: true,
      gate: false,
      writeArtifacts: true,
    });
  });

  test("--all-scenarios is luxel-only full scenario set", () => {
    expect(parseKrausestBenchArgv(["--krausest", "--all-scenarios", "--gate"])).toEqual({
      fullMatrix: false,
      allFrameworks: false,
      compareSet: false,
      allScenarios: true,
      gate: true,
      writeArtifacts: false,
    });
  });
});

describe("buildKrausestRunOptions", () => {
  const repoRoot = "/repo";

  test("slice1 default runs luxel only", () => {
    const mode: KrausestBenchMode = {
      fullMatrix: false,
      allFrameworks: false,
      compareSet: false,
      allScenarios: false,
      gate: false,
      writeArtifacts: false,
    };
    expect(buildKrausestRunOptions(repoRoot, mode, luxel)).toEqual({
      repoRoot,
      skipComparisonFrameworkSetup: true,
      frameworkLabels: [luxel.label],
    });
  });

  test("all-scenarios runs luxel with duration memory transfer", () => {
    const mode: KrausestBenchMode = {
      fullMatrix: false,
      allFrameworks: false,
      compareSet: false,
      allScenarios: true,
      gate: false,
      writeArtifacts: false,
    };
    const opts = buildKrausestRunOptions(repoRoot, mode, luxel);
    expect(opts.frameworkLabels).toEqual([luxel.label]);
    expect(opts.scenarios?.length).toBe(9);
    expect(opts.memoryScenarios?.length).toBe(3);
    expect(opts.transferScenarios?.length).toBe(3);
  });

  test("full matrix selects official chrome150 non-keyed allowlist", () => {
    const mode: KrausestBenchMode = {
      fullMatrix: true,
      allFrameworks: false,
      compareSet: false,
      allScenarios: true,
      gate: false,
      writeArtifacts: true,
    };
    const opts = buildKrausestRunOptions(repoRoot, mode, luxel);
    expect(opts.includeAllFrameworks).toBe(true);
    expect(opts.includeKeyedFrameworks).toBe(false);
    expect(opts.requireOfficialNonKeyedMatrix).toBe(true);
    expect(opts.frameworkLabels).toBeUndefined();
    expect(opts.scenarios?.length).toBe(9);
    expect(opts.memoryScenarios?.length).toBe(3);
    expect(opts.transferScenarios?.length).toBe(3);
  });

  test("all-frameworks matrix includes keyed implementations", () => {
    const mode: KrausestBenchMode = {
      fullMatrix: true,
      allFrameworks: true,
      compareSet: false,
      allScenarios: true,
      gate: false,
      writeArtifacts: true,
    };
    const opts = buildKrausestRunOptions(repoRoot, mode, luxel);
    expect(opts.includeAllFrameworks).toBe(true);
    expect(opts.includeKeyedFrameworks).toBe(true);
  });

  test("compare set selects luxel plus default non-keyed competitors", () => {
    const detected = [
      luxel,
      {
        label: "vanillajs-1-non-keyed",
        driverPath: "non-keyed/vanillajs-1",
        type: "non-keyed" as const,
        directory: "vanillajs-1",
        hasBuildProdScript: false,
      },
      {
        label: "lit-html-v3.2.0-non-keyed",
        driverPath: "non-keyed/lit-html",
        type: "non-keyed" as const,
        directory: "lit-html",
        hasBuildProdScript: true,
      },
    ];
    const mode: KrausestBenchMode = {
      fullMatrix: false,
      allFrameworks: false,
      compareSet: true,
      allScenarios: true,
      gate: false,
      writeArtifacts: true,
    };
    const opts = buildKrausestRunOptions(repoRoot, mode, luxel, detected);
    expect(opts.frameworkLabels).toEqual([
      "luxel-v0.0.0-non-keyed",
      "vanillajs-1-non-keyed",
      "lit-html-v3.2.0-non-keyed",
    ]);
    expect(opts.transferScenarios?.length).toBe(3);
  });
});
