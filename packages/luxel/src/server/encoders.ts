import {
  brotliCompressSync,
  deflateSync,
  gzipSync,
  zstdCompressSync,
} from "node:zlib";

export type CompressionFormat = "zstd" | "br" | "gzip" | "deflate";

const hasZstdEncoder = typeof zstdCompressSync === "function";

export function getAvailableEncodings(preferred: CompressionFormat[]): CompressionFormat[] {
  return preferred.filter((encoding) => encoding !== "zstd" || hasZstdEncoder);
}

function encodeWithZlib(body: Uint8Array, encoding: CompressionFormat): Uint8Array {
  const buf = Buffer.from(body);
  if (encoding === "gzip") return gzipSync(buf);
  if (encoding === "deflate") return deflateSync(buf);
  if (encoding === "br") return brotliCompressSync(buf);
  if (encoding === "zstd") {
    if (!hasZstdEncoder) throw new Error("zstd encoder unavailable");
    return zstdCompressSync(buf);
  }
  return body;
}

function encodeWithBun(body: Uint8Array, encoding: CompressionFormat): Uint8Array {
  if (encoding === "gzip") return Bun.gzipSync(body);
  if (encoding === "deflate") return Bun.deflateSync(body);
  if (encoding === "zstd") return Bun.zstdCompressSync(body);
  if (encoding === "br") return brotliCompressSync(Buffer.from(body));
  return body;
}

export function compressBytes(body: Uint8Array, encoding: CompressionFormat): Uint8Array {
  if (typeof Bun !== "undefined" && typeof Bun.gzipSync === "function") {
    return encodeWithBun(body, encoding);
  }
  return encodeWithZlib(body, encoding);
}

export function hasZstdSupport(): boolean {
  if (typeof Bun !== "undefined" && typeof Bun.zstdCompressSync === "function") return true;
  return hasZstdEncoder;
}
