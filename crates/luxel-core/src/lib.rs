mod spiral;

use napi_derive::napi;

#[napi]
pub fn render_spiral_route_from_store(snapshot_json: String) -> napi::Result<String> {
  spiral::render_route_document(&snapshot_json).map_err(napi::Error::from_reason)
}
