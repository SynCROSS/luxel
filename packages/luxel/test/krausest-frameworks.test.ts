import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { detectKrausestFrameworks } from "../src/bench/krausest/frameworks.ts";

function writePackage(
  root: string,
  type: "keyed" | "non-keyed",
  name: string,
  pkg: Record<string, unknown>,
  lock: Record<string, unknown>,
): void {
  const dir = join(root, "frameworks", type, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(join(dir, "package-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  writeFileSync(join(dir, "index.html"), "");
}

describe("krausest framework detection", () => {
  test("detects official framework metadata and ignores non-krausest dirs", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-detect-"));
    writePackage(
      root,
      "keyed",
      "react-hooks",
      {
        scripts: { "build-prod": "webpack" },
        "js-framework-benchmark": {
          frameworkVersionFromPackage: "react",
          frameworkHomeURL: "https://reactjs.org/",
          language: "JavaScript",
        },
      },
      { packages: { "node_modules/react": { version: "19.2.0" } } },
    );
    writePackage(
      root,
      "non-keyed",
      "luxel",
      {
        scripts: { "build-prod": "echo 0" },
        "js-framework-benchmark": {
          frameworkVersion: "0.0.0",
          frameworkHomeURL: "https://github.com/SynCROSS/luxel",
          language: "TypeScript",
        },
      },
      { packages: {} },
    );
    const nonKrausest = join(root, "frameworks", "non-keyed", "hand-rolled-react");
    mkdirSync(nonKrausest, { recursive: true });
    writeFileSync(join(nonKrausest, "package.json"), "{}\n");
    writeFileSync(join(nonKrausest, "package-lock.json"), "{}\n");

    const frameworks = detectKrausestFrameworks(root);

    expect(frameworks.map((framework) => framework.label)).toEqual([
      "luxel-v0.0.0-non-keyed",
      "react-hooks-v19.2.0-keyed",
    ]);
    expect(frameworks.map((framework) => framework.driverPath)).toEqual([
      "non-keyed/luxel",
      "keyed/react-hooks",
    ]);
  });
});
