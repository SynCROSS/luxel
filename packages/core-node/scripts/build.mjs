import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { arch, platform } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const coreNodeDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function expectedArtifactName() {
  if (platform === "win32") {
    if (arch === "x64") return "index.win32-x64-msvc.node";
    if (arch === "arm64") return "index.win32-arm64-msvc.node";
    if (arch === "ia32") return "index.win32-ia32-msvc.node";
  }
  if (platform === "darwin") {
    if (arch === "arm64") return "index.darwin-arm64.node";
    if (arch === "x64") return "index.darwin-x64.node";
    return "index.darwin-universal.node";
  }
  if (platform === "linux" && arch === "x64") {
    const gnu = "index.linux-x64-gnu.node";
    const musl = "index.linux-x64-musl.node";
    if (existsSync(join(coreNodeDir, gnu))) return gnu;
    return musl;
  }
  if (platform === "linux" && arch === "arm64") {
    const gnu = "index.linux-arm64-gnu.node";
    const musl = "index.linux-arm64-musl.node";
    if (existsSync(join(coreNodeDir, gnu))) return gnu;
    return musl;
  }
  return null;
}

const artifactName = expectedArtifactName();
const artifactPath = artifactName ? join(coreNodeDir, artifactName) : null;

const result = spawnSync(
  "napi",
  ["build", "--platform", "--release", "--cargo-cwd", "../../crates/luxel-core"],
  { cwd: coreNodeDir, stdio: "inherit", shell: true },
);

if (result.status === 0) {
  process.exit(0);
}

if (artifactPath && existsSync(artifactPath)) {
  console.warn(
    `napi build exited ${result.status ?? 1}; reusing existing ${artifactName} (Windows file-lock safe path)`,
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
