/** Minimal wasm: export run(a:i32,b:i32)->i32 add. No imports. */
export const ADD_PLUGIN_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01,
  0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 0x72, 0x75, 0x6e, 0x00, 0x00, 0x0a, 0x09,
  0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
]);

export type PluginCapability = "transform-script" | "network";

export type PluginManifest = {
  id: string;
  wasmPath: string;
  capabilities: PluginCapability[];
};

export function validatePluginManifest(manifest: PluginManifest): void {
  if (!manifest.id) throw new Error("plugin id required");
  const allowed = new Set<PluginCapability>(["transform-script", "network"]);
  for (const cap of manifest.capabilities) {
    if (!allowed.has(cap)) throw new Error(`capability not allowed: ${cap}`);
  }
}
