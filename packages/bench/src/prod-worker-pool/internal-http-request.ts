import { request as httpRequest } from "node:http";

export type InternalHttpResult = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

export function internalHttpRequest(
  port: number,
  serialized: {
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    bodyBase64: string;
  },
): Promise<InternalHttpResult> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: serialized.url,
        method: serialized.method,
        headers: { ...serialized.headers, host: `127.0.0.1:${port}` },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 500,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    if (serialized.bodyBase64) {
      req.write(Buffer.from(serialized.bodyBase64, "base64"));
    }
    req.end();
  });
}
