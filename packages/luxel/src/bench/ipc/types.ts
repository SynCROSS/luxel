export type IpcProtocol = "custom" | "flatbuffers" | "capnp";

export const IPC_PROTOCOLS: readonly IpcProtocol[] = ["custom", "flatbuffers", "capnp"] as const;

export type IpcBenchRuntime = "bun" | "node" | "deno";

export type IpcBenchLine = {
  fixture: "ipc";
  runtime: IpcBenchRuntime;
  protocol: IpcProtocol;
  metric: string;
  value: number;
};

export const IPC_PAYLOAD_SIZES = {
  "1kb": 1024,
  "64kb": 65_536,
  "1mb": 1_048_576,
} as const;

export const IPC_PAYLOAD_METRICS = [
  "payload_1kb_roundtrip_p50_us",
  "payload_64kb_roundtrip_p50_us",
  "payload_1mb_roundtrip_p50_us",
] as const;

export type IpcRoundtripResult = {
  payload: Uint8Array;
};

export type IpcProtocolAdapter = {
  id: IpcProtocol;
  roundtripNull(iterations: number): number;
  roundtripPayload(payload: Uint8Array, iterations: number): number;
  roundtripStream(chunks: readonly Uint8Array[], iterations: number): number;
  roundtripConcurrent(payload: Uint8Array, concurrency: number, iterations: number): number;
  measureCancellation(inFlight: number): { completed: number; aborted: number };
  measureBackpressure(queueDepth: number, burst: number): { accepted: number; dropped: number };
};
