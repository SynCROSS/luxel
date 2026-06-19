import { parentPort, workerData } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import { createCapturingServerResponse } from "./capture-node-response.ts";
import { deserializeNodeRequest, type SerializedNodeRequest } from "./serialize-node-request.ts";

type FetchBootstrap = {
  respondToRequest: (req: SerializedNodeRequest) => Promise<{
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
  }>;
};

type NodeBootstrap = {
  getHandler: () => Promise<
    (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next?: () => void) => void
  >;
};

const { bootstrapPath } = workerData as { bootstrapPath: string };

let fetchBootstrap: FetchBootstrap | null = null;
let nodeHandler:
  | ((
      req: import("node:http").IncomingMessage,
      res: import("node:http").ServerResponse,
      next?: () => void,
    ) => void)
  | null = null;

async function runFetchBootstrap(data: SerializedNodeRequest) {
  fetchBootstrap ??= (await import(pathToFileURL(bootstrapPath).href)) as FetchBootstrap;
  const captured = await fetchBootstrap.respondToRequest(data);
  return {
    ok: true as const,
    statusCode: captured.statusCode,
    headers: captured.headers,
    bodyBase64: captured.body.toString("base64"),
  };
}

async function runNodeHandler(data: SerializedNodeRequest) {
  const bootstrap = (await import(pathToFileURL(bootstrapPath).href)) as NodeBootstrap;
  const run = (nodeHandler ??= await bootstrap.getHandler());
  const req = deserializeNodeRequest(data);
  const { res, finished, snapshot } = createCapturingServerResponse();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("prod handler timed out after 60s")), 60_000);
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
  const captured = snapshot();
  return {
    ok: true as const,
    statusCode: captured.statusCode,
    headers: captured.headers,
    bodyBase64: captured.body.toString("base64"),
  };
}

type WorkerResult = Awaited<ReturnType<typeof runFetchBootstrap>> | { ok: false; error: string };

type GlobalWorkerScope = {
  onmessage?: ((event: MessageEvent<SerializedNodeRequest | null>) => void) | null;
  postMessage?: (message: WorkerResult) => void;
};

function postResult(result: WorkerResult): void {
  if (parentPort) {
    parentPort.postMessage(result);
    return;
  }
  (globalThis as GlobalWorkerScope).postMessage?.(result);
}

async function handleMessage(data: SerializedNodeRequest | null): Promise<void> {
  try {
    const mod = await import(pathToFileURL(bootstrapPath).href);
    const result =
      typeof (mod as FetchBootstrap).respondToRequest === "function"
        ? await runFetchBootstrap(data!)
        : await runNodeHandler(data!);
    postResult(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postResult({ ok: false, error: message });
  }
}

if (parentPort) {
  let inbound = Promise.resolve();
  parentPort.on("message", (data: SerializedNodeRequest | null) => {
    inbound = inbound.then(() => handleMessage(data));
  });
} else {
  let inbound = Promise.resolve();
  (globalThis as GlobalWorkerScope).onmessage = (event) => {
    inbound = inbound.then(() => handleMessage(event.data));
  };
}
