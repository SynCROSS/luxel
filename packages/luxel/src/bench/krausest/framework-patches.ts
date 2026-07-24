import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { KRAUSEST_CHROME_PIN } from "./contract.ts";
import { runKrausestNpmSync, frameworkKrausestNpmEnv } from "./setup-driver.ts";
import { findNode20Executable, findNodeExecutable } from "../../util/find-node.ts";

export const INCR_DOM_ZIP_ENTRY = "frameworks/non-keyed/incr_dom/dist/Entrypoint.bc.js";
export const WALLACE_ZIP_ENTRY = "frameworks/non-keyed/wallace/dist/main.js";

function npmCliPath(nodeExecutable: string): string | null {
  const cli = join(dirname(nodeExecutable), "node_modules", "npm", "bin", "npm-cli.js");
  return existsSync(cli) ? cli : null;
}

function runNpmCliSync(
  nodeExecutable: string,
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): { status: number | null; stdout: string; stderr: string } {
  const cli = npmCliPath(nodeExecutable);
  if (!cli) {
    return { status: 1, stdout: "", stderr: `npm-cli.js not found for ${nodeExecutable}` };
  }
  const result = spawnSync(nodeExecutable, [cli, ...args], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export { runNpmCliSync, npmCliPath };

const SKRUV_LITEN_BUILD_SCRIPT = `import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dir = dirname(fileURLToPath(import.meta.url));
copyFileSync(join(dir, "index-clean.html"), join(dir, "index.html"));
const esbuild = require("esbuild");
const result = esbuild.buildSync({
  entryPoints: [join(dir, "src/index.js")],
  bundle: true,
  minify: true,
  format: "esm",
  write: false,
});
const code = result.outputFiles[0].text.replace(/[\\n\\r]/g, "");
appendFileSync(join(dir, "index.html"), \`<script>\${code}</script>\`);
mkdirSync(join(dir, "dist"), { recursive: true });
writeFileSync(join(dir, "dist", ".built"), "1");
`;

const INCR_DOM_COPY_SCRIPT = `import { cpSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)));

function findFiles(dir, suffix) {
  const matches = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "_esy" || name === ".git") continue;
      matches.push(...findFiles(path, suffix));
      continue;
    }
    if (path.endsWith(suffix) && path.includes(\`\${sep}src\${sep}\`)) {
      matches.push(path);
    }
  }
  return matches;
}

const releasePath = join(root, "dist");
mkdirSync(releasePath, { recursive: true });

for (const suffix of [".bc.js", ".bc.map"]) {
  const files = findFiles(root, suffix);
  for (const file of files) {
    const base = file.split(sep).pop();
    if (base) cpSync(file, join(releasePath, base), { force: true });
  }
}
`;

const INCR_DOM_BUILD_SCRIPT = `import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const artifact = join(dir, "dist", "Entrypoint.bc.js");

function runNodeScript(name) {
  const result = spawnSync(process.execPath, [join(dir, name)], {
    cwd: dir,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform === "win32") {
  if (!existsSync(artifact)) {
    console.error("incr_dom: dist/Entrypoint.bc.js missing on Windows (chrome150 prebuild required)");
    process.exit(1);
  }
  process.exit(0);
}

const esy = join(dir, "node_modules", "esy", "bin", "esy");
if (!existsSync(esy)) {
  console.error(\`incr_dom: esy binary missing at \${esy}\`);
  process.exit(1);
}

function runEsy(args) {
  const result = spawnSync(esy, args, { cwd: dir, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runEsy(["install"]);
runEsy(["b", "dune", "build", "--root", ".", "-j", "8", "--verbose", "--profile", "release"]);
runNodeScript("copy-prod.mjs");
`;

const VANJS_BUILD_SCRIPT = `import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dir = dirname(fileURLToPath(import.meta.url));
const esbuild = require("esbuild");
const { minify } = require("terser");
mkdirSync(join(dir, "dist"), { recursive: true });
const bundled = esbuild.buildSync({
  entryPoints: [join(dir, "src/Main.js")],
  bundle: true,
  write: false,
}).outputFiles[0].text;
writeFileSync(join(dir, "dist/bundle.js"), bundled);
const minified = await minify(bundled, {
  compress: true,
  mangle: { toplevel: true, properties: { keep_quoted: true } },
  format: { wrap_func_args: false },
});
if (!minified.code) process.exit(1);
writeFileSync(join(dir, "dist/bundle.out.js"), minified.code);
`;

const DOOHTML_BUILD_SCRIPT = `import { cpSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const dist = join(dir, "dist");
mkdirSync(dist, { recursive: true });
cpSync(join(dir, "node_modules/doohtml/dist/doohtml.mjs"), join(dist, "doohtml.mjs"));
`;

const MARKO_BUILD_SCRIPT = `import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const markoRun = join(dir, "node_modules", ".bin", process.platform === "win32" ? "marko-run.cmd" : "marko-run");
const build = spawnSync(markoRun, ["build"], {
  cwd: dir,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
  shell: process.platform === "win32",
});
process.exit(build.status ?? 1);
`;

const HALOGEN_BUILD_SCRIPT = `import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const win = process.platform === "win32";
const node = process.execPath;

function runScript(relPath, args) {
  const script = join(dir, relPath);
  const result = spawnSync(node, [script, ...args], { cwd: dir, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

mkdirSync(join(dir, "output-es"), { recursive: true });
runScript("node_modules/spago/bin/bundle.js", ["build"]);
runScript("node_modules/purs-backend-es/index.js", ["bundle-app", "--to", "output-es/bundle.js"]);
`;

function hasFrameworkTooling(cwd: string, tool: string): boolean {
  const win = process.platform === "win32";
  return existsSync(join(cwd, "node_modules", ".bin", win ? `${tool}.cmd` : tool));
}

function frameworkNodeExecutable(frameworkPath: string): string | null {
  if (frameworkPath === "non-keyed/halogen") {
    return findNode20Executable() ?? findNodeExecutable();
  }
  return findNodeExecutable();
}

function runFrameworkLocalBin(
  cwd: string,
  name: string,
  args: string[],
  npmEnv: NodeJS.ProcessEnv,
  frameworkPath = "",
): { status: number | null; stdout: string; stderr: string } {
  const win = process.platform === "win32";
  const shim = join(cwd, "node_modules", ".bin", win ? `${name}.cmd` : name);
  if (existsSync(shim)) {
    const result = spawnSync(shim, args, {
      cwd,
      env: npmEnv,
      stdio: "pipe",
      encoding: "utf8",
      shell: win,
      windowsHide: true,
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  const node = frameworkNodeExecutable(frameworkPath);
  if (!node) {
    return { status: 1, stdout: "", stderr: `${name} missing and node executable not found` };
  }

  const scriptCandidates: Record<string, string> = {
    "install-purescript": join(
      cwd,
      "node_modules",
      "purescript-installer",
      "install-purescript",
      "index.js",
    ),
    spago: join(cwd, "node_modules", "spago", "bin", "bundle.js"),
    "purs-backend-es": join(cwd, "node_modules", "purs-backend-es", "index.js"),
  };
  const script = scriptCandidates[name];
  if (!script || !existsSync(script)) {
    return { status: 1, stdout: "", stderr: `${name} shim and fallback script missing` };
  }

  const result = spawnSync(node, [script, ...args], {
    cwd,
    env: npmEnv,
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function frameworkRebuildNpmEnv(cwd: string, frameworkPath: string): NodeJS.ProcessEnv {
  const env = { ...frameworkKrausestNpmEnv(cwd) };
  // NODE_ENV=production makes `npm ci/install` skip devDependencies (webpack, etc.).
  delete env.NODE_ENV;
  if (frameworkPath !== "non-keyed/halogen") {
    return env;
  }
  const node20 = findNode20Executable();
  if (!node20) {
    return env;
  }
  const nodeDir = dirname(node20);
  const npm = join(nodeDir, process.platform === "win32" ? "npm.cmd" : "npm");
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const delimiter = process.platform === "win32" ? ";" : ":";
  const current = env[pathKey] ?? "";
  const prefix = [nodeDir, join(cwd, "node_modules", ".bin"), cwd].join(delimiter);
  return {
    ...env,
    npm_config_build_from_source: "false",
    [pathKey]: `${prefix}${delimiter}${current}`,
    KRAUSEST_FRAMEWORK_NPM: existsSync(npm) ? npm : undefined,
  };
}

function halogenNode20Required(): string {
  return "halogen requires Node 20 LTS for spago (better-sqlite3 has no prebuild for Node 24). Install Node 20 via fnm/nvm and retry.";
}

function halogenNode20OrError(): { ok: true; node: string } | { ok: false; detail: string } {
  const node = findNode20Executable();
  if (!node) {
    return { ok: false, detail: halogenNode20Required() };
  }
  return { ok: true, node };
}

function halogenPursWorking(
  cwd: string,
  npmEnv: NodeJS.ProcessEnv,
  frameworkPath: string,
): boolean {
  const verify = runFrameworkLocalBin(cwd, "purs", ["--version"], npmEnv, frameworkPath);
  return verify.status === 0 && verify.stdout.trim().length > 0;
}

function halogenSpagoReady(cwd: string): boolean {
  const spagoDir = join(cwd, ".spago");
  if (!existsSync(spagoDir)) return false;
  try {
    return statSync(spagoDir).isDirectory();
  } catch {
    return false;
  }
}

function rebuildHalogenNativeModules(
  cwd: string,
  node20: string,
  npmEnv: NodeJS.ProcessEnv,
): { ok: true } | { ok: false; detail: string } {
  const rebuild = runNpmCliSync(node20, cwd, ["rebuild", "better-sqlite3"], npmEnv);
  if (rebuild.status === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    detail: `toolchain failed (npm rebuild better-sqlite3):\n${meaningfulBuildFailure(rebuild.stdout, rebuild.stderr)}`,
  };
}

function halogenPursReady(cwd: string): boolean {
  const pursBin = join(cwd, "node_modules", "purescript", "purs.bin");
  try {
    return statSync(pursBin).size > 10_000;
  } catch {
    return false;
  }
}

function installHalogenPurescript(
  cwd: string,
  npmEnv: NodeJS.ProcessEnv,
  frameworkPath: string,
): { ok: true } | { ok: false; detail: string } {
  const pursExe = join(cwd, "purs.exe");
  const pursBin = join(cwd, "node_modules", "purescript", "purs.bin");
  if (!existsSync(pursExe)) {
    const install = runFrameworkLocalBin(
      cwd,
      "install-purescript",
      ["--purs-ver=0.15.15"],
      npmEnv,
      frameworkPath,
    );
    if (install.status !== 0) {
      return {
        ok: false,
        detail: `toolchain failed (install-purescript --purs-ver=0.15.15):\n${meaningfulBuildFailure(install.stdout, install.stderr)}`,
      };
    }
  }
  if (!existsSync(pursExe)) {
    return { ok: false, detail: "toolchain failed: install-purescript did not produce purs.exe" };
  }
  mkdirSync(join(cwd, "node_modules", "purescript"), { recursive: true });
  copyFileSync(pursExe, pursBin);

  const verify = runFrameworkLocalBin(cwd, "purs", ["--version"], npmEnv, frameworkPath);
  if (verify.status !== 0 || !verify.stdout.trim()) {
    return {
      ok: false,
      detail: `toolchain failed (purs --version):\n${meaningfulBuildFailure(verify.stdout, verify.stderr)}`,
    };
  }
  return { ok: true };
}

function installFrameworkToolchain(
  cwd: string,
  frameworkPath: string,
  npmEnv: NodeJS.ProcessEnv,
): { ok: true } | { ok: false; detail: string } {
  if (frameworkPath !== "non-keyed/halogen") {
    return { ok: true };
  }
  const node20Result = halogenNode20OrError();
  if (!node20Result.ok) {
    return { ok: false, detail: node20Result.detail };
  }
  const node20 = node20Result.node;

  if (!halogenPursWorking(cwd, npmEnv, frameworkPath)) {
    const purs = installHalogenPurescript(cwd, npmEnv, frameworkPath);
    if (!purs.ok) {
      return { ok: false, detail: `${purs.detail}\nframework: ${frameworkPath}` };
    }
  }

  const native = rebuildHalogenNativeModules(cwd, node20, npmEnv);
  if (!native.ok) {
    return { ok: false, detail: `${native.detail}\n${halogenNode20Required()}\nframework: ${frameworkPath}` };
  }

  if (!halogenSpagoReady(cwd)) {
    const spago = runFrameworkLocalBin(cwd, "spago", ["install"], npmEnv, frameworkPath);
    if (spago.status !== 0) {
      return {
        ok: false,
        detail: `toolchain failed (spago install):\n${meaningfulBuildFailure(spago.stdout, spago.stderr)}\nframework: ${frameworkPath}`,
      };
    }
  }
  return { ok: true };
}

function meaningfulBuildFailure(stdout: string, stderr: string): string {
  const combined = `${stdout}\n${stderr}`;
  const lines = combined
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/DeprecationWarning|trace-deprecation/i.test(line));
  const tail = lines.slice(-12).join("\n");
  return tail.length > 0 ? tail : combined.trim();
}

function rewritePackageScript(
  frameworkDir: string,
  scriptName: string,
  newValue: string,
): void {
  const pkgPath = join(frameworkDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  pkg.scripts ??= {};
  pkg.scripts[scriptName] = newValue;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function writeBuildScript(
  frameworkDir: string,
  filename: string,
  contents: string,
): void {
  writeFileSync(join(frameworkDir, filename), contents);
  rewritePackageScript(frameworkDir, "build-prod", `node ${filename}`);
}

function patchAureliaEnvironment(frameworkDir: string): void {
  const envPath = join(frameworkDir, "config", "environment.production.json");
  const outPath = join(frameworkDir, "src", "environment.js");
  mkdirSync(join(frameworkDir, "src"), { recursive: true });
  const env = JSON.parse(readFileSync(envPath, "utf8")) as Record<string, unknown>;
  writeFileSync(outPath, `export default ${JSON.stringify(env, null, 2)};\n`);
}

function patchSkruvLitenBuild(frameworkDir: string): void {
  writeBuildScript(frameworkDir, "build-prod.mjs", SKRUV_LITEN_BUILD_SCRIPT);
}

function patchWallaceBuild(frameworkDir: string): void {
  rewritePackageScript(frameworkDir, "build-prod", "webpack --mode production");
}

/** True when wallace dist is a real production bundle (not broken webpack eval-dev). */
export function wallaceArtifactReady(cwd: string): boolean {
  const artifact = join(cwd, "dist", "main.js");
  try {
    const raw = readFileSync(artifact, "utf8");
    if (raw.length < 2_000) return false;
    // Broken local rebuilds ship eval-source-map and reference undefined wallaceConfig.
    if (raw.includes("eval(")) return false;
    if (raw.includes("wallaceConfig") && !/wallaceConfig\s*=/.test(raw)) return false;
    return true;
  } catch {
    return false;
  }
}

export function extractWallacePrebuiltFromZip(
  zipPath: string,
  destFile: string,
): { ok: true } | { ok: false; detail: string } {
  const extractRoot = mkdtempSync(join(tmpdir(), "wallace-extract-"));
  const extracted = join(extractRoot, WALLACE_ZIP_ENTRY);
  const tar = spawnSync("tar", ["-xf", zipPath, "-C", extractRoot, WALLACE_ZIP_ENTRY], {
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true,
  });
  if (tar.status !== 0 || !existsSync(extracted)) {
    return {
      ok: false,
      detail: `wallace prebuilt extract failed:\n${meaningfulBuildFailure(tar.stdout, tar.stderr)}`,
    };
  }
  mkdirSync(dirname(destFile), { recursive: true });
  copyFileSync(extracted, destFile);
  return { ok: true };
}

function resolveKrausestBuildZipPath(submodule: string): string | null {
  const candidates = [
    join(submodule, ".krausest-cache", `${KRAUSEST_CHROME_PIN}-build.zip`),
    join(submodule, "..", "..", ".cache", "krausest-build-zip", KRAUSEST_CHROME_PIN, "build.zip"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function ensureWallacePrebuilt(
  submodule: string,
  cwd: string,
): { ok: true } | { ok: false; detail: string } {
  if (wallaceArtifactReady(cwd)) {
    return { ok: true };
  }

  let zipPath = resolveKrausestBuildZipPath(submodule);
  if (!zipPath) {
    const cacheDir = join(submodule, ".krausest-cache");
    mkdirSync(cacheDir, { recursive: true });
    zipPath = join(cacheDir, `${KRAUSEST_CHROME_PIN}-build.zip`);
    const url = `https://github.com/krausest/js-framework-benchmark/releases/download/${KRAUSEST_CHROME_PIN}/build.zip`;
    const download = spawnSync("curl", ["-fsSL", "-o", zipPath, url], {
      stdio: "pipe",
      encoding: "utf8",
      windowsHide: true,
    });
    if (download.status !== 0 || !existsSync(zipPath)) {
      return {
        ok: false,
        detail: `wallace prebuilt download failed:\n${meaningfulBuildFailure(download.stdout, download.stderr)}`,
      };
    }
  }

  return extractWallacePrebuiltFromZip(zipPath, join(cwd, "dist", "main.js"));
}

function patchIncrDomBuild(frameworkDir: string): void {
  writeFileSync(join(frameworkDir, "copy-prod.mjs"), INCR_DOM_COPY_SCRIPT);
  writeFileSync(join(frameworkDir, "build-prod.mjs"), INCR_DOM_BUILD_SCRIPT);
  const pkgPath = join(frameworkDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  pkg.scripts ??= {};
  pkg.scripts["build-prod"] = "node build-prod.mjs";
  delete pkg.scripts["prebuild-prod"];
  delete pkg.scripts["postbuild-prod"];
  delete pkg.scripts["prebuild-dev"];
  delete pkg.scripts["postbuild-dev"];
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

export function incrDomArtifactReady(cwd: string): boolean {
  const artifact = join(cwd, "dist", "Entrypoint.bc.js");
  try {
    return statSync(artifact).size > 10_000;
  } catch {
    return false;
  }
}

export function extractIncrDomPrebuiltFromZip(
  zipPath: string,
  destFile: string,
): { ok: true } | { ok: false; detail: string } {
  const extractRoot = mkdtempSync(join(tmpdir(), "incr-dom-extract-"));
  const extracted = join(extractRoot, INCR_DOM_ZIP_ENTRY);
  const tar = spawnSync("tar", ["-xf", zipPath, "-C", extractRoot, INCR_DOM_ZIP_ENTRY], {
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true,
  });
  if (tar.status !== 0 || !existsSync(extracted)) {
    return {
      ok: false,
      detail: `incr_dom prebuilt extract failed:\n${meaningfulBuildFailure(tar.stdout, tar.stderr)}`,
    };
  }
  mkdirSync(dirname(destFile), { recursive: true });
  copyFileSync(extracted, destFile);
  return { ok: true };
}

function ensureIncrDomPrebuilt(
  submodule: string,
  cwd: string,
): { ok: true } | { ok: false; detail: string } {
  if (incrDomArtifactReady(cwd)) {
    return { ok: true };
  }
  if (process.platform !== "win32") {
    return { ok: true };
  }

  const cacheDir = join(submodule, ".krausest-cache");
  const zipPath = join(cacheDir, `${KRAUSEST_CHROME_PIN}-build.zip`);
  if (!existsSync(zipPath)) {
    mkdirSync(cacheDir, { recursive: true });
    const url = `https://github.com/krausest/js-framework-benchmark/releases/download/${KRAUSEST_CHROME_PIN}/build.zip`;
    const download = spawnSync("curl", ["-fsSL", "-o", zipPath, url], {
      stdio: "pipe",
      encoding: "utf8",
      windowsHide: true,
    });
    if (download.status !== 0) {
      return {
        ok: false,
        detail: `incr_dom prebuilt download failed:\n${meaningfulBuildFailure(download.stdout, download.stderr)}`,
      };
    }
  }

  const extracted = extractIncrDomPrebuiltFromZip(
    zipPath,
    join(cwd, "dist", "Entrypoint.bc.js"),
  );
  if (!extracted.ok) {
    return extracted;
  }
  if (!incrDomArtifactReady(cwd)) {
    return {
      ok: false,
      detail: "incr_dom prebuilt extract did not produce dist/Entrypoint.bc.js",
    };
  }
  return { ok: true };
}

function patchVanjsBuild(frameworkDir: string): void {
  writeBuildScript(frameworkDir, "build-prod.mjs", VANJS_BUILD_SCRIPT);
}

function patchDoohtmlBuild(frameworkDir: string): void {
  writeBuildScript(frameworkDir, "build-prod.mjs", DOOHTML_BUILD_SCRIPT);
  rewritePackageScript(frameworkDir, "build-dev", "node build-prod.mjs");
}

function patchMarkoBuild(frameworkDir: string): void {
  writeBuildScript(frameworkDir, "build-prod.mjs", MARKO_BUILD_SCRIPT);
}

function patchHalogenBuild(frameworkDir: string): void {
  writeBuildScript(frameworkDir, "build-prod.mjs", HALOGEN_BUILD_SCRIPT);
}

/** TS 5.7+ DOM vs node:util TextDecoder/TextEncoder clash when @types/node is pulled in. */
export function ensureTsconfigSkipLibCheck(frameworkDir: string): void {
  const tsconfigPath = join(frameworkDir, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return;
  const raw = readFileSync(tsconfigPath, "utf8");
  if (/"skipLibCheck"\s*:\s*true/.test(raw)) return;
  const patched = raw.replace(
    /"compilerOptions"\s*:\s*\{/,
    '"compilerOptions": {\n    "skipLibCheck": true,',
  );
  if (patched !== raw) {
    writeFileSync(tsconfigPath, patched);
  }
}

function patchTscScriptsSkipLibCheck(frameworkDir: string): void {
  ensureTsconfigSkipLibCheck(frameworkDir);
  const pkgPath = join(frameworkDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  if (!pkg.scripts) return;
  let changed = false;
  for (const [name, script] of Object.entries(pkg.scripts)) {
    if (!/\btsc\b/.test(script) || /--skipLibCheck/.test(script)) continue;
    pkg.scripts[name] = script.replace(/\btsc\b/g, "tsc --skipLibCheck");
    changed = true;
  }
  if (changed) {
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

function patchHydroJsBuild(frameworkDir: string): void {
  const stampScript = `import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const frameworkDir = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync(join(frameworkDir, "dist"), { recursive: true });
writeFileSync(join(frameworkDir, "dist", ".built"), "1");
`;
  writeFileSync(join(frameworkDir, "utils", "write-built-stamp.mjs"), stampScript);
  rewritePackageScript(
    frameworkDir,
    "postbuild-prod",
    "node utils/moveFiles.js && node utils/write-built-stamp.mjs",
  );
}

function patchMutractionBuild(frameworkDir: string): void {
  patchTscScriptsSkipLibCheck(frameworkDir);
}

const FRAMEWORK_PATCHES: Record<string, (frameworkDir: string) => void> = {
  "non-keyed/aurelia": patchAureliaEnvironment,
  "non-keyed/hydro-js": patchHydroJsBuild,
  "non-keyed/knno-jsx": patchMutractionBuild,
  "non-keyed/mutraction": patchMutractionBuild,
  "non-keyed/skruv-liten": patchSkruvLitenBuild,
  "non-keyed/wallace": patchWallaceBuild,
  "non-keyed/incr_dom": patchIncrDomBuild,
  "non-keyed/halogen": patchHalogenBuild,
  "keyed/rezact": patchMutractionBuild,
  "keyed/gxt": patchMutractionBuild,
  "keyed/wallace": patchWallaceBuild,
  "keyed/vanjs": patchVanjsBuild,
  "keyed/doohtml-dp": patchDoohtmlBuild,
  "keyed/marko": patchMarkoBuild,
  "keyed/marko-classes": patchMarkoBuild,
};

export function halogenPursBinaryReady(cwd: string): boolean {
  return halogenPursReady(cwd);
}

/** Apply cross-platform fixes before rebuilding upstream comparison frameworks. */
export function applyKrausestFrameworkPatches(
  submodule: string,
  frameworkPath: string,
): void {
  const patch = FRAMEWORK_PATCHES[frameworkPath];
  if (!patch) return;
  patch(join(submodule, "frameworks", frameworkPath));
}

export function rebuildKrausestFramework(
  submodule: string,
  frameworkPath: string,
): { ok: true } | { ok: false; detail: string } {
  applyKrausestFrameworkPatches(submodule, frameworkPath);
  const cwd = resolve(submodule, "frameworks", frameworkPath);
  const npmEnv = frameworkRebuildNpmEnv(cwd, frameworkPath);
  const isIncrDom = frameworkPath === "non-keyed/incr_dom";
  const skipCi =
    frameworkPath !== "non-keyed/halogen" &&
    !isIncrDom &&
    hasFrameworkTooling(cwd, "spago");
  const installArgs =
    isIncrDom && process.platform !== "win32" ? ["ci"] : ["ci", "--ignore-scripts"];
  const install = skipCi
    ? { status: 0, stdout: "", stderr: "" }
    : runKrausestNpmSync(cwd, installArgs, npmEnv);
  if (install.status !== 0) {
    return {
      ok: false,
      detail: `install failed:\n${meaningfulBuildFailure(install.stdout, install.stderr)}\nframework: ${frameworkPath}`,
    };
  }
  const toolchain = installFrameworkToolchain(cwd, frameworkPath, npmEnv);
  if (!toolchain.ok) {
    return toolchain;
  }
  if (isIncrDom) {
    const prebuilt = ensureIncrDomPrebuilt(submodule, cwd);
    if (!prebuilt.ok) {
      return { ok: false, detail: `${prebuilt.detail}\nframework: ${frameworkPath}` };
    }
  }
  const isWallace =
    frameworkPath === "non-keyed/wallace" || frameworkPath === "keyed/wallace";
  if (isWallace) {
    const prebuilt = ensureWallacePrebuilt(submodule, cwd);
    if (prebuilt.ok && wallaceArtifactReady(cwd)) {
      return { ok: true };
    }
  }
  if (frameworkPath === "non-keyed/halogen") {
    const node20 = findNode20Executable();
    if (!node20) {
      return { ok: false, detail: halogenNode20Required() };
    }
    const buildScript = join(cwd, "build-prod.mjs");
    const build = existsSync(buildScript)
      ? (() => {
          const result = spawnSync(node20, [buildScript], {
            cwd,
            stdio: "pipe",
            encoding: "utf8",
            env: npmEnv,
            windowsHide: true,
          });
          return {
            status: result.status,
            stdout: result.stdout ?? "",
            stderr: result.stderr ?? "",
          };
        })()
      : runNpmCliSync(node20, cwd, ["run", "build-prod"], npmEnv);
    if (build.status !== 0) {
      return {
        ok: false,
        detail: `build failed:\n${meaningfulBuildFailure(build.stdout, build.stderr)}\nframework: ${frameworkPath}`,
      };
    }
    return { ok: true };
  }
  if (isIncrDom) {
    const node = findNodeExecutable() ?? process.execPath;
    const buildScript = join(cwd, "build-prod.mjs");
    const build = spawnSync(node, [buildScript], {
      cwd,
      stdio: "pipe",
      encoding: "utf8",
      env: npmEnv,
      windowsHide: true,
    });
    if (build.status !== 0) {
      return {
        ok: false,
        detail: `build failed:\n${meaningfulBuildFailure(build.stdout ?? "", build.stderr ?? "")}\nframework: ${frameworkPath}`,
      };
    }
    return { ok: true };
  }
  const build = runKrausestNpmSync(cwd, ["run", "build-prod"], npmEnv);
  if (build.status !== 0) {
    return {
      ok: false,
      detail: `build failed:\n${meaningfulBuildFailure(build.stdout, build.stderr)}\nframework: ${frameworkPath}`,
    };
  }
  return { ok: true };
}
