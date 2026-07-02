import { computeSpiralTileCoordsCpu, computeSpiralTileCoordsCpuF32 } from "./spiral-layout-cpu.ts";
import type { ClientGpuMetrics } from "./capabilities.ts";

/** WGSL uniform `Params` is 28 bytes; WebGPU requires uniform buffer size % 16 === 0. */
export const SPIRAL_WEBGPU_PARAMS_BYTE_SIZE = 32;

const SPIRAL_WGSL = `
struct Params {
  width: f32,
  height: f32,
  cell: f32,
  limit: f32,
  centerX: f32,
  centerY: f32,
  maxPairs: u32,
}

struct Pair { x: f32, y: f32, }

struct CountOut {
  count: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> pairs: array<Pair>;
@group(0) @binding(2) var<storage, read_write> countOut: CountOut;

@compute @workgroup_size(1)
fn main() {
  var angle: f32 = 0.0;
  var radius: f32 = 0.0;
  var count: u32 = 0u;
  let step: f32 = params.cell * 0.015;
  loop {
    if (radius >= params.limit) { break; }
    let x = params.centerX + cos(angle) * radius;
    let y = params.centerY + sin(angle) * radius;
    if (x >= 0.0 && x <= params.width - params.cell && y >= 0.0 && y <= params.height - params.cell) {
      if (count < params.maxPairs) {
        pairs[count].x = x;
        pairs[count].y = y;
      }
      count += 1u;
    }
    angle += 0.2;
    radius += step;
  }
  countOut.count = count;
}
`;

type GpuNavigator = Navigator & { gpu: GPU };

function isWebGpuNavigator(nav: Navigator): nav is GpuNavigator {
  return typeof (nav as GpuNavigator).gpu !== "undefined";
}

function writeSpiralGpuParams(
  width: number,
  height: number,
  cell: number,
  limit: number,
  maxPairs: number,
): ArrayBuffer {
  const buf = new ArrayBuffer(SPIRAL_WEBGPU_PARAMS_BYTE_SIZE);
  const floats = new Float32Array(buf, 0, 6);
  floats.set([width, height, cell, limit, width / 2, height / 2]);
  new Uint32Array(buf, 24, 1)[0] = maxPairs;
  return buf;
}

export async function computeSpiralTileCoordsWebgpu(): Promise<{
  coords: Float64Array;
  metrics: ClientGpuMetrics;
}> {
  const nav = globalThis.navigator;
  if (!nav || !isWebGpuNavigator(nav)) {
    throw new Error("WebGPU unavailable");
  }
  const warmupStart = performance.now();
  const adapter = await nav.gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU adapter unavailable");
  const device = await adapter.requestDevice();
  const warmupMs = performance.now() - warmupStart;

  const width = 960;
  const height = 720;
  const cell = 10;
  const limit = Math.min(width, height) / 2;
  const expectedPairs = computeSpiralTileCoordsCpu().length / 2;
  const maxPairs = Math.max(expectedPairs, 4096);
  const paramsBuffer = device.createBuffer({
    size: SPIRAL_WEBGPU_PARAMS_BYTE_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const pairsBuffer = device.createBuffer({
    size: maxPairs * 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const countBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(paramsBuffer, 0, writeSpiralGpuParams(width, height, cell, limit, maxPairs));
  device.queue.writeBuffer(countBuffer, 0, new Uint32Array([0]));

  const module = device.createShaderModule({ code: SPIRAL_WGSL });
  const compilation = await module.getCompilationInfo();
  for (const message of compilation.messages) {
    if (message.type === "error") {
      device.destroy();
      throw new Error(`WebGPU shader error: ${message.message}`);
    }
  }
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: pairsBuffer } },
      { binding: 2, resource: { buffer: countBuffer } },
    ],
  });

  const computeStart = performance.now();
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  const readPairs = device.createBuffer({
    size: maxPairs * 8,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const readCount = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  encoder.copyBufferToBuffer(pairsBuffer, 0, readPairs, 0, maxPairs * 8);
  encoder.copyBufferToBuffer(countBuffer, 0, readCount, 0, 4);
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();

  await readCount.mapAsync(GPUMapMode.READ);
  const pairCount = new Uint32Array(readCount.getMappedRange().slice(0))[0] ?? 0;
  readCount.unmap();
  if (pairCount === 0) {
    device.destroy();
    throw new Error("WebGPU spiral compute produced zero tiles");
  }
  if (pairCount !== expectedPairs) {
    device.destroy();
    throw new Error(`WebGPU spiral tile count mismatch gpu=${pairCount} cpu=${expectedPairs}`);
  }
  const storedPairs = Math.min(pairCount, maxPairs);
  if (storedPairs < pairCount) {
    device.destroy();
    throw new Error(`WebGPU spiral pair buffer overflow: count=${pairCount} maxPairs=${maxPairs}`);
  }
  await readPairs.mapAsync(GPUMapMode.READ);
  const raw = new Float32Array(readPairs.getMappedRange().slice(0, storedPairs * 8));
  readPairs.unmap();
  const coords = new Float64Array(storedPairs * 2);
  for (let i = 0; i < storedPairs; i++) {
    coords[i * 2] = raw[i * 2]!;
    coords[i * 2 + 1] = raw[i * 2 + 1]!;
  }
  const computeMs = performance.now() - computeStart;

  device.destroy();
  return {
    coords,
    metrics: {
      backend: "webgpu",
      warmupMs,
      computeMs,
      tileCount: pairCount,
    },
  };
}

/** WGSL sin/cos may differ slightly from JS Math in f32. */
export const WEBGPU_F32_REFERENCE_EPSILON_PX = 0.05;

export function assertWebgpuParity(gpu: Float64Array): void {
  const ref = computeSpiralTileCoordsCpuF32();
  if (ref.length !== gpu.length) {
    throw new Error(`WebGPU parity length mismatch ref=${ref.length} gpu=${gpu.length}`);
  }
  for (let i = 0; i < ref.length; i++) {
    if (Math.abs(ref[i]! - gpu[i]!) > WEBGPU_F32_REFERENCE_EPSILON_PX) {
      throw new Error(`WebGPU parity mismatch at ${i}: ref=${ref[i]} gpu=${gpu[i]}`);
    }
  }
}

export function assertWebgpuMatchesBenchCpu(gpu: Float64Array): void {
  const bench = computeSpiralTileCoordsCpu();
  if (bench.length !== gpu.length) {
    throw new Error(`WebGPU bench length mismatch bench=${bench.length} gpu=${gpu.length}`);
  }
  let layoutPxMismatches = 0;
  for (let i = 0; i < bench.length; i++) {
    if (bench[i]!.toFixed(2) !== gpu[i]!.toFixed(2)) layoutPxMismatches += 1;
  }
  if (layoutPxMismatches > bench.length * 0.85) {
    throw new Error(`WebGPU bench layout drift too high: ${layoutPxMismatches}/${bench.length}`);
  }
}

export async function computeSpiralTileCoordsWebgpuWithParity(): Promise<{
  coords: Float64Array;
  metrics: ClientGpuMetrics;
}> {
  const result = await computeSpiralTileCoordsWebgpu();
  assertWebgpuParity(result.coords);
  return result;
}
