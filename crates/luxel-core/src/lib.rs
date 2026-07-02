mod counter;
mod render_ir;
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
pub fn render_spiral_body_from_tiles(tiles: Vec<SpiralTile>) -> napi::Result<String> {
  let coords: Vec<(f64, f64)> = tiles.iter().map(|tile| (tile.x, tile.y)).collect();
  Ok(spiral::render_body_from_tiles(&coords))
}

#[napi]
pub fn render_spiral_body_from_coords(coords: napi::bindgen_prelude::Float64Array) -> napi::Result<String> {
  Ok(spiral::render_body_from_flat_coords(coords.as_ref()))
}

/// Platformatic spiral fixture — compute tiles in Rust and render (no JS object marshalling).
#[napi]
pub fn render_spiral_body() -> napi::Result<String> {
  Ok(spiral::render_body_computed())
}

#[napi]
pub fn render_spiral_body_chunks(tiles_per_chunk: u32) -> napi::Result<Vec<String>> {
  Ok(spiral::render_body_chunks(tiles_per_chunk as usize))
}

/// Full spiral bench document (body + minimal shell).
#[napi]
pub fn render_spiral_document() -> napi::Result<String> {
  Ok(spiral::render_document_computed("/"))
}

#[napi]
pub fn render_spiral_route_from_tiles(_tiles: Vec<SpiralTile>) -> napi::Result<String> {
  Err(napi::Error::from_reason(
    "deprecated: use renderSpiralBodyFromTiles + TS document shell",
  ))
}

#[napi]
pub fn render_counter_body(message: String) -> napi::Result<String> {
  Ok(counter::render_body(&message))
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
