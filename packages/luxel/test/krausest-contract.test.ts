import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KRAUSEST_DOM_BUTTON_IDS, KRAUSEST_TABLE_SELECTOR } from "../src/bench/krausest/contract.ts";

const repoRoot = join(import.meta.dir, "../../..");
const krausestSfc = join(repoRoot, "examples/krausest-table/src/routes/index.luxel");

describe("krausest DOM contract", () => {
  test("example table route includes required buttons and table selector", async () => {
    const source = await readFile(krausestSfc, "utf8");
    for (const id of KRAUSEST_DOM_BUTTON_IDS) {
      expect(source).toContain(`id="${id}"`);
    }
    expect(source).toContain("test-data");
  });
});
