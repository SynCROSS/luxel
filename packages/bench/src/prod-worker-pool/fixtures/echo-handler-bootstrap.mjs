/** Minimal prod-handler bootstrap — echoes request path for pool dispatch tests. */
export async function respondToRequest(serialized) {
  return {
    statusCode: 200,
    headers: { "content-type": "text/plain" },
    body: Buffer.from(`path:${serialized.url}`),
  };
}
