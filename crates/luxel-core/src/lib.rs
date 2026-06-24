mod counter;
mod render_ir;
mod spiral;

use napi_derive::napi;

#[napi(object)]
pub struct SpiralTile {
  pub x: f64,
  pub y: f64,
}

#[napi]
pub fn render_spiral_route_from_store(snapshot_json: String) -> napi::Result<String> {
  spiral::render_route_document(&snapshot_json).map_err(napi::Error::from_reason)
}

#[napi]
pub fn render_spiral_route_from_tiles(tiles: Vec<SpiralTile>) -> napi::Result<String> {
  let coords: Vec<(f64, f64)> = tiles.into_iter().map(|t| (t.x, t.y)).collect();
  Ok(spiral::render_route_document_from_tiles(&coords))
}

#[napi]
pub fn render_counter_body_from_store(snapshot_json: String) -> napi::Result<String> {
  counter::render_body_from_store(&snapshot_json).map_err(napi::Error::from_reason)
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
