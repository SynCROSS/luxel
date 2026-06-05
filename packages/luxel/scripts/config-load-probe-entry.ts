import { loadLuxelConfig } from "../src/config/load.ts";

const appRoot = process.argv[2];
if (!appRoot) {
  console.error("usage: config-load-probe <appRoot>");
  process.exit(1);
}

const config = await loadLuxelConfig(appRoot);
console.log(
  JSON.stringify({
    root: config.root,
    routesDir: config.routesDir,
    outDir: config.outDir,
  }),
);
