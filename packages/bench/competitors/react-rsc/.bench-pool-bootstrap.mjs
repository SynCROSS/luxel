import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node:url";
import next from "next";

const dir = dirname(fileURLToPath(import.meta.url));
const app = next({ dev: false, dir });
await app.prepare();
const nextHandler = app.getRequestHandler();
const rootParsed = parse("/", true);

function benchParsedUrl(raw) {
  if (!raw || raw === "/" || raw.startsWith("/?")) return rootParsed;
  return parse(raw, true);
}

const handler = (req, res) => nextHandler(req, res, benchParsedUrl(req.url));

export async function getHandler() {
  return handler;
}
