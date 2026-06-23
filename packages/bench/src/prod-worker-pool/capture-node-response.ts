import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";

export type CapturedNodeResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

export function createCapturingServerResponse(): {
  res: ServerResponse;
  finished: Promise<void>;
  snapshot: () => CapturedNodeResponse;
} {
  let statusCode = 200;
  const headers: Record<string, string | string[] | undefined> = {};
  const chunks: Buffer[] = [];
  let ended = false;
  let resolveFinished: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    statusCode: 200,
    headersSent: false,
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    getHeaders() {
      return { ...headers };
    },
    hasHeader(name: string) {
      return headers[name.toLowerCase()] !== undefined;
    },
    removeHeader(name: string) {
      delete headers[name.toLowerCase()];
    },
    writeHead(code: number, reasonOrHeaders?: string | Record<string, string>, headersArg?: Record<string, string>) {
      statusCode = code;
      const hdrs = typeof reasonOrHeaders === "object" ? reasonOrHeaders : headersArg;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) headers[k.toLowerCase()] = v;
      }
      this.headersSent = true;
    },
    write(chunk: string | Buffer) {
      this.headersSent = true;
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    },
    end(chunk?: string | Buffer | (() => void), encodingOrCb?: (() => void) | string, cb?: () => void) {
      let data: string | Buffer | undefined;
      let done: (() => void) | undefined;
      if (typeof chunk === "function") {
        done = chunk;
      } else {
        data = chunk;
        if (typeof encodingOrCb === "function") done = encodingOrCb;
        else if (typeof cb === "function") done = cb;
      }
      if (data !== undefined) {
        chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
      }
      if (!ended) {
        ended = true;
        this.headersSent = true;
        emitter.emit("finish");
        emitter.emit("close");
        resolveFinished();
        done?.();
      }
    },
    flushHeaders() {
      this.headersSent = true;
    },
  }) as ServerResponse;

  return {
    res,
    finished,
    snapshot: () => ({
      statusCode,
      headers,
      body: Buffer.concat(chunks),
    }),
  };
}
