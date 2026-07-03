import { pathToFileURL } from "node:url";
import { createCapturingServerResponse } from "./capture-node-response.ts";
import { deserializeNodeRequest, type SerializedNodeRequest } from "./serialize-node-request.ts";
import type { CapturedNodeResponse } from "./capture-node-response.ts";

type NodeBootstrap = {
  getHandler: () => Promise<
    (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next?: () => void) => void
  >;
};

let handler:
  | ((
      req: import("node:http").IncomingMessage,
      res: import("node:http").ServerResponse,
      next?: () => void,
    ) => void)
  | null = null;

async function ensureHandler(bootstrapPath: string) {
  if (handler) return handler;
  const bootstrap = (await import(pathToFileURL(bootstrapPath).href)) as NodeBootstrap;
  handler = await bootstrap.getHandler();
  return handler;
}

export async function captureProdHandlerRequest(
  bootstrapPath: string,
  data: SerializedNodeRequest,
  timeoutMs = 60_000,
): Promise<CapturedNodeResponse> {
  const run = await ensureHandler(bootstrapPath);
  const req = deserializeNodeRequest(data);
  const { res, finished, snapshot } = createCapturingServerResponse();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`prod handler timed out after ${timeoutMs}ms`)), timeoutMs);
    finished.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
    try {
      const maybe = run(req, res, () => {
        if (!res.headersSent) {
          res.statusCode = 404;
          res.end("Not Found");
        }
      });
      if (maybe && typeof (maybe as Promise<void>).then === "function") {
        (maybe as Promise<void>).catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
      }
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
  return snapshot();
}

export function resetProdHandlerCaptureForTests(): void {
  handler = null;
}
