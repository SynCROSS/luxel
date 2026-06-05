process.env.LUXEL_E2E_PORT ??= "4174";
process.env.LUXEL_E2E_APP ??= "examples/nav-demo";
await import("./e2e-server.ts");
