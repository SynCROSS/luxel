import { spawnSync } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../react-rsc");

await mkdir(join(root, "app"), { recursive: true });
await unlink(join(root, "next.config.ts")).catch(() => {});
await writeFile(
  join(root, "next.config.mjs"),
  `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: false,
};
export default nextConfig;
`,
);
await writeFile(
  join(root, "app/layout.tsx"),
  `export default function Layout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head><meta charSet="utf-8" /><title>Luxel</title></head><body><main>{children}</main></body></html>);
}`,
);
await writeFile(
  join(root, "app/page.tsx"),
  `export const dynamic = "force-dynamic";
export default function Page() {
  return (<><h1>Hello Luxel</h1><section><button type="button" data-luxel-text="count">0</button></section></>);
}`,
);
await writeFile(
  join(root, "tsconfig.json"),
  JSON.stringify({ compilerOptions: { jsx: "preserve", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true }, include: ["**/*.ts", "**/*.tsx"] }, null, 2),
);
await writeFile(
  join(root, ".bench-server.mjs"),
  `import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
const dir = dirname(fileURLToPath(import.meta.url));
export async function startBenchServer() {
  const app = next({ dev: false, dir });
  await app.prepare();
  const handler = app.getRequestHandler();
  const hostname = "127.0.0.1";
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => handler(req, res));
    server.listen(0, hostname, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: \`http://\${hostname}:\${port}\`,
        port,
        close: () => new Promise((r, j) => server.close((e) => (e ? j(e) : r()))),
      });
    });
    server.once("error", reject);
  });
}`,
);

const result = spawnSync("bun", ["x", "next", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("built react-rsc");
