use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

const TILES_KEY: &str = "route:index:tiles";
const SPIRAL_WIDTH: f64 = 960.0;
const SPIRAL_HEIGHT: f64 = 720.0;
const SPIRAL_CELL: f64 = 10.0;

/// Matches `examples/spiral` scoped CSS after `scoped` strip (render-ir.ts).
const SPIRAL_HEAD_STYLE: &str = "#wrapper {\n  position: relative;\n  width: 960px;\n  height: 720px;\n}\n.tile {\n  position: absolute;\n  width: 10px;\n  height: 10px;\n  background: #333;\n}";

#[derive(Deserialize)]
struct ResourceEntry {
  value: Value,
}

pub fn compute_spiral_coords() -> Vec<(f64, f64)> {
  let mut tiles = Vec::new();
  let mut angle = 0.0_f64;
  let mut radius = 0.0_f64;
  let step = SPIRAL_CELL;
  let center_x = SPIRAL_WIDTH / 2.0;
  let center_y = SPIRAL_HEIGHT / 2.0;
  let limit = SPIRAL_WIDTH.min(SPIRAL_HEIGHT) / 2.0;
  while radius < limit {
    let x = center_x + angle.cos() * radius;
    let y = center_y + angle.sin() * radius;
    if x >= 0.0 && x <= SPIRAL_WIDTH - SPIRAL_CELL && y >= 0.0 && y <= SPIRAL_HEIGHT - SPIRAL_CELL {
      tiles.push((x, y));
    }
    angle += 0.2;
    radius += step * 0.015;
  }
  tiles
}

pub fn render_body_computed() -> String {
  render_body_from_tiles(&compute_spiral_coords())
}

pub fn render_body_from_flat_coords(coords: &[f64]) -> String {
  let mut tiles = Vec::with_capacity(coords.len() / 2);
  let mut i = 0;
  while i + 1 < coords.len() {
    tiles.push((coords[i], coords[i + 1]));
    i += 2;
  }
  render_body_from_tiles(&tiles)
}

pub fn render_document_computed(route_path: &str) -> String {
  let body = render_body_computed();
  let style_block = format!("<style>{}</style>", compact_css(SPIRAL_HEAD_STYLE));
  format!(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Luxel</title>{style_block}</head><body><main data-luxel-route=\"{route_path}\">{body}</main></body></html>"
  )
}

pub fn render_body_from_tiles(tiles: &[(f64, f64)]) -> String {
  format!(
    "<div id=\"wrapper\">{}</div>",
    render_tile_markup_chunk(tiles)
  )
}

pub fn render_body_chunks(tiles_per_chunk: usize) -> Vec<String> {
  let coords = compute_spiral_coords();
  let chunk_size = tiles_per_chunk.max(1);
  let chunks: Vec<_> = coords.chunks(chunk_size).collect();
  let mut out = Vec::with_capacity(chunks.len());
  for (index, chunk) in chunks.iter().enumerate() {
    let tiles = render_tile_markup_chunk(chunk);
    if chunks.len() == 1 {
      out.push(format!("<div id=\"wrapper\">{tiles}</div>"));
      continue;
    }
    if index == 0 {
      out.push(format!("<div id=\"wrapper\">{tiles}"));
    } else if index + 1 == chunks.len() {
      out.push(format!("{tiles}</div>"));
    } else {
      out.push(tiles);
    }
  }
  out
}

fn render_tile_markup_chunk(tiles: &[(f64, f64)]) -> String {
  let mut body = String::with_capacity(tiles.len() * 64);
  for &(x, y) in tiles {
    use std::fmt::Write;
    let _ = write!(body, "<div class=\"tile\" style=\"left:{x:.2}px;top:{y:.2}px\"></div>");
  }
  body
}

pub fn render_route_document_from_tiles(tiles: &[(f64, f64)]) -> String {
  let body = render_body_from_tiles(tiles);
  let style_block = format!("<style>{}</style>", compact_css(SPIRAL_HEAD_STYLE));
  format!(
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Luxel</title>{style_block}</head><body><main data-luxel-route=\"/\">{body}</main></body></html>"
  )
}

pub fn render_route_document(snapshot_json: &str) -> Result<String, String> {
  let snapshot: HashMap<String, ResourceEntry> =
    serde_json::from_str(snapshot_json).map_err(|e| format!("invalid snapshot json: {e}"))?;

  let tiles = snapshot
    .get(TILES_KEY)
    .and_then(|entry| entry.value.as_array())
    .ok_or_else(|| format!("missing tile list at {TILES_KEY}"))?;

  let coords: Vec<(f64, f64)> = tiles
    .iter()
    .map(|tile| {
      let x = tile.get("x").and_then(Value::as_f64).unwrap_or(0.0);
      let y = tile.get("y").and_then(Value::as_f64).unwrap_or(0.0);
      (x, y)
    })
    .collect();

  Ok(render_route_document_from_tiles(&coords))
}

fn compact_css(css: &str) -> String {
  let joined: String = css
    .lines()
    .map(str::trim)
    .filter(|line| !line.is_empty())
    .collect();
  joined
    .replace(" :", ":")
    .replace(": ", ":")
    .replace(" ;", ";")
    .replace("; ", ";")
    .replace(" {", "{")
    .replace("{ ", "{")
    .replace(" }", "}")
    .replace("} ", "}")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn chunked_body_matches_whole_body() {
    let whole = render_body_computed();
    let joined = render_body_chunks(128).join("");
    assert_eq!(joined, whole);
  }

  #[test]
  fn computed_tile_count_matches_platformatic_fixture() {
    assert_eq!(compute_spiral_coords().len(), 2398);
  }

  #[test]
  fn flat_coords_path_matches_typed_tiles() {
    let coords = compute_spiral_coords();
    let mut flat = Vec::with_capacity(coords.len() * 2);
    for &(x, y) in &coords {
      flat.push(x);
      flat.push(y);
    }
    let from_flat = render_body_from_flat_coords(&flat);
    let from_typed = render_body_from_tiles(&coords);
    assert_eq!(from_flat, from_typed);
  }

  #[test]
  fn renders_wrapper_for_empty_tiles() {
    let snapshot = r#"{"route:index:tiles":{"value":[]}}"#;
    let html = render_route_document(snapshot).unwrap();
    assert!(html.contains(r#"<div id="wrapper"></div>"#));
    assert!(!html.contains('\n'));
  }

  #[test]
  fn typed_tiles_path_matches_json_path() {
    let snapshot = r#"{"route:index:tiles":{"value":[{"x":1.5,"y":2.25}]}}"#;
    let from_json = render_route_document(snapshot).unwrap();
    let from_tiles = render_route_document_from_tiles(&[(1.5, 2.25)]);
    assert_eq!(from_json, from_tiles);
  }
}
