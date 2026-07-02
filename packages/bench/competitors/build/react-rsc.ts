import { spawnSync } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REACT_RSC_BENCH_SERVER_MJS,
  REACT_RSC_NEXT_CONFIG,
  REACT_RSC_POOL_BOOTSTRAP,
} from "./shared.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../react-rsc");

await mkdir(join(root, "app"), { recursive: true });
await unlink(join(root, "next.config.ts")).catch(() => {});
await writeFile(join(root, "next.config.mjs"), REACT_RSC_NEXT_CONFIG);
await writeFile(
  join(root, "app/layout.tsx"),
  `export default function Layout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head><meta charSet="utf-8" /><title>Luxel</title></head><body><main>{children}</main></body></html>);
}`,
);
await writeFile(
  join(root, "app/CounterButton.tsx"),
  `"use client";
import { useState } from "react";

export function CounterButton() {
  const [count] = useState(0);
  return (
    <button type="button" data-luxel-text="count">
      {count}
    </button>
  );
}`,
);
await writeFile(
  join(root, "app/page.tsx"),
  `import { CounterButton } from "./CounterButton";
export const dynamic = "force-static";
export default function Page() {
  return (
    <>
      <h1>Hello Luxel</h1>
      <section>
        <CounterButton />
      </section>
    </>
  );
}`,
);
await writeFile(
  join(root, "tsconfig.json"),
  JSON.stringify(
    { compilerOptions: { jsx: "preserve", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true }, include: ["**/*.ts", "**/*.tsx"] },
    null,
    2,
  ),
);
await writeFile(join(root, ".bench-pool-bootstrap.mjs"), REACT_RSC_POOL_BOOTSTRAP);
await writeFile(join(root, ".bench-server.mjs"), REACT_RSC_BENCH_SERVER_MJS);

const result = spawnSync("bun", ["x", "next", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("built react-rsc");
