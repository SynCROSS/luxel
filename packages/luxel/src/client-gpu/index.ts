export { detectClientGpuCapabilities, type ClientGpuBackend, type ClientGpuMetrics } from "./capabilities.ts";
export {
  applySpiralLayoutCoordsToDom,
  hydrateSpiralClientGpuLayout,
  type SpiralClientGpuHydrationResult,
} from "./spiral-client-gpu.ts";
export { computeSpiralLayoutCoords, computeSpiralLayoutCoordsSync } from "./spiral-layout.ts";
export {
  readBatteryDrainProxy,
  sampleSpiralLayoutGpuGates,
  buildGpuResourceSample,
} from "./sample-resource.ts";
