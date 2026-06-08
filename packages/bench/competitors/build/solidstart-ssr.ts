import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../solidstart-ssr");
await mkdir(join(root, "src/routes"), { recursive: true });
await writeFile(
  join(root, "package.json"),
  JSON.stringify(
    {
      name: "@luxel/bench-solidstart-ssr",
      private: true,
      type: "module",
      version: "0.0.0",
      dependencies: {
        "@solidjs/router": "^0.15.3",
        "@solidjs/start": "^1.1.0",
        "solid-js": "^1.9.7",
        "vinxi": "^0.5.11",
      },
    },
    null,
    2,
  ),
);
await writeFile(
  join(root, "app.config.ts"),
  `import { defineConfig } from "@solidjs/start/config";
export default defineConfig({
  ssr: true,
  server: { preset: "node-server" },
  vite: { build: { minify: "esbuild", sourcemap: false, target: "es2022" } },
});`,
);
await writeFile(
  join(root, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        jsx: "preserve",
        jsxImportSource: "solid-js",
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
        strict: true,
        noEmit: true,
      },
      include: ["src/**/*.ts", "src/**/*.tsx", "app.config.ts"],
    },
    null,
    2,
  ),
);
await writeFile(
  join(root, "src/app.tsx"),
  `import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";

export default function App() {
  return (
    <Router root={(props) => <Suspense>{props.children}</Suspense>}>
      <FileRoutes />
    </Router>
  );
}`,
);
await writeFile(
  join(root, "src/entry-client.tsx"),
  `import { mount, StartClient } from "@solidjs/start/client";
mount(() => <StartClient />, document.getElementById("app")!);`,
);
await writeFile(
  join(root, "src/entry-server.tsx"),
  `import { createHandler, StartServer } from "@solidjs/start/server";

function Document(props: { assets: unknown; scripts: unknown; children: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Luxel</title>
        {props.assets}
      </head>
      <body>
        <main id="app">{props.children}</main>
        {props.scripts}
      </body>
    </html>
  );
}

export default createHandler(() => <StartServer document={Document} />);`,
);
await writeFile(
  join(root, "src/routes/index.tsx"),
  `export default function Home() {
  return (
    <>
      <h1>Hello Luxel</h1>
      <section><button type="button" data-luxel-text="count">0</button></section>
    </>
  );
}`,
);
await writeFile(
  join(root, ".bench-server.mjs"),
  `import { createServer } from "node:http";
import { b as useNitroApp, t as toNodeListener } from "./.output/server/chunks/_/nitro.mjs";

export async function startBenchServer() {
  const hostname = "127.0.0.1";
  const nitroApp = useNitroApp();
  return new Promise((resolve, reject) => {
    const server = createServer(toNodeListener(nitroApp.h3App));
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

spawnSync("bun", ["install"], { cwd: root, stdio: "inherit", shell: true });

const result = spawnSync("bunx", ["vinxi", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NODE_ENV: "production" },
});
if (result.status !== 0) {
  console.warn("solidstart-ssr build failed — row will be pending");
} else {
  console.log("built solidstart-ssr");
}
