import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import {
  isKrausestBuildZipExtracted,
  krausestBuildZipMarker,
} from "../src/bench/krausest/setup-build-zip.ts";

describe("krausest build.zip cache", () => {
  test("marker records chrome150 pin", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "krausest-zip-"));
    mkdirSync(join(repoRoot, ".cache", "krausest-build-zip", "chrome150"), { recursive: true });
    writeFileSync(krausestBuildZipMarker(repoRoot), '{"pin":"chrome150"}\n');
    expect(isKrausestBuildZipExtracted(repoRoot)).toBe(true);
  });

  test("missing marker means not extracted", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "krausest-zip-miss-"));
    expect(isKrausestBuildZipExtracted(repoRoot)).toBe(false);
  });
});
