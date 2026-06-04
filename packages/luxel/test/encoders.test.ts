import { describe, expect, test } from "bun:test";
import {
  compressBytes,
  getAvailableEncodings,
  hasZstdSupport,
  type CompressionFormat,
} from "../src/server/encoders.ts";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";

describe("compression encoders", () => {
  const payload = new TextEncoder().encode("Hello Luxel encoder round-trip");

  test("gzip round-trips through compressBytes", () => {
    const compressed = compressBytes(payload, "gzip");
    expect(gunzipSync(Buffer.from(compressed)).toString("utf8")).toBe("Hello Luxel encoder round-trip");
  });

  test("deflate round-trips through compressBytes", () => {
    const compressed = compressBytes(payload, "deflate");
    const inflated =
      typeof Bun !== "undefined" ? Bun.inflateSync(compressed) : inflateSync(Buffer.from(compressed));
    const plain = new TextDecoder().decode(inflated);
    expect(plain).toBe("Hello Luxel encoder round-trip");
  });

  test("br round-trips through compressBytes", () => {
    const compressed = compressBytes(payload, "br");
    expect(brotliDecompressSync(Buffer.from(compressed)).toString("utf8")).toBe(
      "Hello Luxel encoder round-trip",
    );
  });

  test("getAvailableEncodings omits zstd when unsupported", () => {
    const preferred: CompressionFormat[] = ["zstd", "gzip"];
    const available = getAvailableEncodings(preferred);
    if (hasZstdSupport()) {
      expect(available).toEqual(["zstd", "gzip"]);
    } else {
      expect(available).toEqual(["gzip"]);
    }
  });
});
