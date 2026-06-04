import {
  compressBytes,
  getAvailableEncodings,
  type CompressionFormat,
} from "./encoders.ts";

export type { CompressionFormat } from "./encoders.ts";

export type CompressOptions = {
  enabled?: boolean;
  threshold?: number;
  encodings?: CompressionFormat[];
};

const DEFAULT_ENCODINGS: CompressionFormat[] = ["zstd", "br", "gzip", "deflate"];

const COMPRESSIBLE_PREFIXES = ["text/"];
const COMPRESSIBLE_EXACT = new Set([
  "application/javascript",
  "application/json",
  "application/manifest+json",
]);

function isCompressibleMime(contentType: string | null): boolean {
  if (!contentType) return false;
  const mime = contentType.split(";")[0]!.trim().toLowerCase();
  if (COMPRESSIBLE_EXACT.has(mime)) return true;
  return COMPRESSIBLE_PREFIXES.some((p) => mime.startsWith(p));
}

function mergeVary(existing: string | null, token: string): string {
  const parts = existing?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (!parts.includes(token)) parts.push(token);
  return parts.join(", ");
}

function pickEncoding(
  acceptEncoding: string | null,
  preferred: CompressionFormat[],
): CompressionFormat | null {
  if (!acceptEncoding) return null;
  const offered = new Map<string, number>();
  for (const part of acceptEncoding.split(",")) {
    const [raw, qPart] = part.trim().split(";q=");
    const coding = raw.trim().toLowerCase();
    const q = qPart ? Number.parseFloat(qPart) : 1;
    if (!Number.isNaN(q)) offered.set(coding, q);
  }
  let best: CompressionFormat | null = null;
  let bestQ = -1;
  for (const coding of preferred) {
    const q = offered.get(coding);
    if (q === undefined) continue;
    if (q > bestQ) {
      bestQ = q;
      best = coding;
    }
  }
  return best;
}

export function wrapCompress(
  fetch: (req: Request) => Promise<Response>,
  opts: CompressOptions = {},
): (req: Request) => Promise<Response> {
  const enabled = opts.enabled ?? false;
  const threshold = opts.threshold ?? 1024;
  const preferred = opts.encodings ?? DEFAULT_ENCODINGS;
  const encodings = getAvailableEncodings(preferred);

  return async (req) => {
    const res = await fetch(req);
    if (!enabled) return res;

    if (req.method === "HEAD") return res;
    const status = res.status;
    if (status === 204 || status === 304 || (status >= 100 && status < 200)) return res;
    if (res.headers.has("content-encoding")) return res;
    if (new URL(req.url).searchParams.has("stream")) return res;

    const contentType = res.headers.get("content-type");
    if (!isCompressibleMime(contentType)) return res;

    const raw = new Uint8Array(await res.arrayBuffer());
    if (raw.byteLength < threshold) return res;

    const coding = pickEncoding(req.headers.get("accept-encoding"), encodings);
    if (!coding) return res;

    const compressed = compressBytes(raw, coding);
    const headers = new Headers(res.headers);
    headers.set("content-encoding", coding);
    headers.delete("content-length");
    headers.set("vary", mergeVary(headers.get("vary"), "Accept-Encoding"));

    return new Response(compressed, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}
