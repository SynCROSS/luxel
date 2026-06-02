export function streamHtmlDocument(html: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const headEnd = html.indexOf("</head>");
  const chunks: string[] = [];
  if (headEnd >= 0) {
    chunks.push(html.slice(0, headEnd + "</head>".length));
    chunks.push(html.slice(headEnd + "</head>".length));
  } else {
    chunks.push(html);
  }

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

export async function readStreamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}
