import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  KRAUSEST_CHROME_PIN,
  KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES,
} from "../src/bench/krausest/contract.ts";
import { resolveKrausestOfficialNonKeyedFrameworks } from "../src/bench/krausest/frameworks.ts";

function writeOfficialStub(root: string, directory: string): void {
  const dir = join(root, "frameworks", "non-keyed", directory);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify({
      scripts: { "build-prod": "echo 0" },
      "js-framework-benchmark": {
        frameworkVersion: "1.0.0",
        frameworkHomeURL: "https://example.com/",
        language: "JavaScript",
      },
    })}\n`,
  );
  writeFileSync(join(dir, "package-lock.json"), "{}\n");
  writeFileSync(join(dir, "index.html"), "");
}

describe("krausest chrome150 official allowlist", () => {
  test("pins chrome150 with exactly 66 official non-keyed directories", () => {
    expect(KRAUSEST_CHROME_PIN).toBe("chrome150");
    expect(KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES).toHaveLength(66);
    expect(KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES).toContain("vanillajs");
    expect(KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES).toContain("mikado");
    expect(KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES).not.toContain("luxel");
  });

  test("resolveKrausestOfficialNonKeyedFrameworks returns luxel plus allowlisted dirs only", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-official-"));
    writeOfficialStub(root, "vanillajs");
    writeOfficialStub(root, "mikado");
    writeOfficialStub(root, "luxel");
    const extra = join(root, "frameworks", "non-keyed", "hand-rolled-react");
    mkdirSync(extra, { recursive: true });
    writeFileSync(join(extra, "package.json"), "{}\n");
    writeFileSync(join(extra, "package-lock.json"), "{}\n");

    const selected = resolveKrausestOfficialNonKeyedFrameworks(root);

    expect(selected.map((framework) => framework.directory).sort()).toEqual([
      "luxel",
      "mikado",
      "vanillajs",
    ]);
    expect(selected.every((framework) => framework.type === "non-keyed")).toBe(true);
  });
});
