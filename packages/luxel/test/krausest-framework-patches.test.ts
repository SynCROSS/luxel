import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import {
  applyKrausestFrameworkPatches,
  ensureTsconfigSkipLibCheck,
  extractIncrDomPrebuiltFromZip,
  extractWallacePrebuiltFromZip,
  halogenPursBinaryReady,
  INCR_DOM_ZIP_ENTRY,
  WALLACE_ZIP_ENTRY,
  wallaceArtifactReady,
} from "../src/bench/krausest/framework-patches.ts";

function writeFrameworkFile(root: string, frameworkPath: string, filePath: string, contents = ""): void {
  const fullPath = join(root, "frameworks", frameworkPath, filePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, contents);
}

describe("krausest framework patches", () => {
  test("writes aurelia environment.js from production config", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    writeFrameworkFile(
      root,
      "non-keyed/aurelia",
      "config/environment.production.json",
      `${JSON.stringify({ debug: false, testing: false })}\n`,
    );

    applyKrausestFrameworkPatches(root, "non-keyed/aurelia");

    const envJs = readFileSync(
      join(root, "frameworks/non-keyed/aurelia/src/environment.js"),
      "utf8",
    );
    expect(envJs).toContain('"debug": false');
    expect(envJs.startsWith("export default")).toBe(true);
  });

  test("replaces skruv-liten build-prod with cross-platform script", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    writeFrameworkFile(
      root,
      "non-keyed/skruv-liten",
      "package.json",
      `${JSON.stringify({
        scripts: {
          "build-prod":
            "cp -f index-clean.html index.html && (printf '<script>' && esbuild src/index.js --bundle --minify --format=esm | tr -d '\\n\\r' && printf '</script>') >> index.html",
        },
      })}\n`,
    );

    applyKrausestFrameworkPatches(root, "non-keyed/skruv-liten");

    const pkg = JSON.parse(
      readFileSync(join(root, "frameworks/non-keyed/skruv-liten/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["build-prod"]).toBe("node build-prod.mjs");
  });

  test("replaces wallace build-prod with cross-platform webpack mode", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    writeFrameworkFile(
      root,
      "non-keyed/wallace",
      "package.json",
      `${JSON.stringify({ scripts: { "build-prod": "NODE_ENV=production webpack" } })}\n`,
    );

    applyKrausestFrameworkPatches(root, "non-keyed/wallace");

    const pkg = JSON.parse(
      readFileSync(join(root, "frameworks/non-keyed/wallace/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["build-prod"]).toBe("webpack --mode production");
  });

  test("rejects broken wallace eval-dev dist", () => {
    const root = mkdtempSync(join(tmpdir(), "wallace-art-"));
    const cwd = join(root, "frameworks/non-keyed/wallace");
    mkdirSync(join(cwd, "dist"), { recursive: true });
    writeFileSync(
      join(cwd, "dist/main.js"),
      "(()=>{eval('if (wallaceConfig.flags.useStubs) {}')})();",
    );
    expect(wallaceArtifactReady(cwd)).toBe(false);
    writeFileSync(
      join(cwd, "dist/main.js"),
      "(()=>{\"use strict\";function t(){return 1}const root=t();})();".repeat(40),
    );
    expect(wallaceArtifactReady(cwd)).toBe(true);
  });

  test("extracts wallace prebuilt from zip entry", () => {
    const root = mkdtempSync(join(tmpdir(), "wallace-zip-"));
    const staging = join(root, "staging");
    mkdirSync(join(staging, "frameworks/non-keyed/wallace/dist"), { recursive: true });
    const payload = "(()=>{\"use strict\";function t(){return 1}const root=t();})();".repeat(40);
    writeFileSync(join(staging, WALLACE_ZIP_ENTRY), payload);
    const zipPath = join(root, "build.zip");
    const tar = spawnSync(
      "tar",
      ["-cf", zipPath, "-C", staging, "frameworks/non-keyed/wallace/dist/main.js"],
      { encoding: "utf8", windowsHide: true },
    );
    expect(tar.status).toBe(0);
    const dest = join(root, "out/main.js");
    const result = extractWallacePrebuiltFromZip(zipPath, dest);
    expect(result).toEqual({ ok: true });
    expect(readFileSync(dest, "utf8")).toBe(payload);
  });

  test("enables skipLibCheck for mutraction tsconfig (TS 5.7 DOM/node util clash)", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    writeFrameworkFile(
      root,
      "non-keyed/mutraction",
      "tsconfig.json",
      `${JSON.stringify({ compilerOptions: { strict: true }, include: ["src"] })}\n`,
    );
    writeFrameworkFile(
      root,
      "non-keyed/mutraction",
      "package.json",
      `${JSON.stringify({ scripts: { build: "npx tsc && npm run bundle" } })}\n`,
    );

    applyKrausestFrameworkPatches(root, "non-keyed/mutraction");

    const tsconfig = readFileSync(
      join(root, "frameworks/non-keyed/mutraction/tsconfig.json"),
      "utf8",
    );
    expect(tsconfig).toContain('"skipLibCheck": true');
    const pkg = JSON.parse(
      readFileSync(join(root, "frameworks/non-keyed/mutraction/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toBe("npx tsc --skipLibCheck && npm run bundle");
  });

  test("ensureTsconfigSkipLibCheck is idempotent", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    const dir = join(root, "frameworks/non-keyed/mutraction");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "tsconfig.json"),
      `{\n  "compilerOptions": {\n    "skipLibCheck": true,\n    "strict": true\n  }\n}\n`,
    );
    ensureTsconfigSkipLibCheck(dir);
    const tsconfig = readFileSync(join(dir, "tsconfig.json"), "utf8");
    expect(tsconfig.match(/"skipLibCheck"\s*:\s*true/g)?.length).toBe(1);
  });

  test("replaces halogen build-prod with cross-platform script", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    writeFrameworkFile(
      root,
      "non-keyed/halogen",
      "package.json",
      `${JSON.stringify({
        scripts: {
          postinstall: "spago install",
          "build-prod": "spago build && purs-backend-es bundle-app --to output-es/bundle.js",
        },
      })}\n`,
    );

    applyKrausestFrameworkPatches(root, "non-keyed/halogen");

    const pkg = JSON.parse(
      readFileSync(join(root, "frameworks/non-keyed/halogen/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["build-prod"]).toBe("node build-prod.mjs");
  });

  test("halogenPursBinaryReady rejects placeholder purs.bin", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    writeFrameworkFile(root, "non-keyed/halogen", "node_modules/purescript/purs.bin", "placeholder");
    expect(halogenPursBinaryReady(join(root, "frameworks/non-keyed/halogen"))).toBe(false);
  });

  test("replaces incr_dom esy scripts with cross-platform build-prod.mjs", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    writeFrameworkFile(
      root,
      "non-keyed/incr_dom",
      "package.json",
      `${JSON.stringify({
        scripts: {
          "prebuild-prod": "esy @esy install",
          "build-prod": "esy @esy b dune build --root . -j 8 --verbose --profile release",
          "postbuild-prod": "sh copy.sh",
        },
      })}\n`,
    );

    applyKrausestFrameworkPatches(root, "non-keyed/incr_dom");

    const pkg = JSON.parse(
      readFileSync(join(root, "frameworks/non-keyed/incr_dom/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["build-prod"]).toBe("node build-prod.mjs");
    expect(pkg.scripts["prebuild-prod"]).toBeUndefined();
    expect(pkg.scripts["postbuild-prod"]).toBeUndefined();
  });

  test("extractIncrDomPrebuiltFromZip copies Entrypoint.bc.js from chrome build.zip layout", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-patches-"));
    const zip = join(root, "build.zip");
    const payloadRoot = join(root, "payload");
    const payloadFile = join(payloadRoot, INCR_DOM_ZIP_ENTRY);
    mkdirSync(join(payloadFile, ".."), { recursive: true });
    writeFileSync(payloadFile, "fake-entrypoint-bc-js");
    const pack = spawnSync("tar", ["-cf", zip, "-C", payloadRoot, INCR_DOM_ZIP_ENTRY], {
      stdio: "pipe",
      encoding: "utf8",
      windowsHide: true,
    });
    expect(pack.status).toBe(0);

    const dest = join(root, "dist", "Entrypoint.bc.js");
    const result = extractIncrDomPrebuiltFromZip(zip, dest);
    expect(result.ok).toBe(true);
    expect(readFileSync(dest, "utf8")).toBe("fake-entrypoint-bc-js");
  });
});
