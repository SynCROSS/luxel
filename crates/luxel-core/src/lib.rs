#[cfg(test)]
mod counter;
mod render_ir;
#[cfg(test)]
mod spiral;

use napi_derive::napi;

const DEPRECATED_ROUTE_NAPI: &str =
  "deprecated: use renderBodyFromIr(renderIrJson, snapshotJson, bindingsJson)";

#[napi(object)]
pub struct SpiralTile {
  pub x: f64,
  pub y: f64,
}

#[napi]
pub fn render_spiral_route_from_store(_snapshot_json: String) -> napi::Result<String> {
  Err(napi::Error::from_reason(DEPRECATED_ROUTE_NAPI))
}

#[napi]
pub fn render_spiral_route_from_tiles(_tiles: Vec<SpiralTile>) -> napi::Result<String> {
  Err(napi::Error::from_reason(DEPRECATED_ROUTE_NAPI))
}

#[napi]
pub fn render_counter_body_from_store(_snapshot_json: String) -> napi::Result<String> {
  Err(napi::Error::from_reason(DEPRECATED_ROUTE_NAPI))
}

#[napi]
pub fn render_body_from_ir(
  render_ir_json: String,
  snapshot_json: String,
  bindings_json: String,
) -> napi::Result<String> {
  render_ir::render_body_from_ir(&render_ir_json, &snapshot_json, &bindings_json)
    .map_err(napi::Error::from_reason)
}
