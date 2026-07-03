import { b as useNitroApp, t as toNodeListener } from "./.output/server/chunks/_/nitro.mjs";

const handler = toNodeListener(useNitroApp().h3App);

export async function getHandler() {
  return handler;
}
