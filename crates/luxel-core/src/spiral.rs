use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

const TILES_KEY: &str = "route:index:tiles";

/// Matches `examples/spiral` scoped CSS after `scoped` strip (render-ir.ts).
const SPIRAL_HEAD_STYLE: &str = "#wrapper {\n  position: relative;\n  width: 960px;\n  height: 720px;\n}\n.tile {\n  position: absolute;\n  width: 10px;\n  height: 10px;\n  background: #333;\n}";

#[derive(Deserialize)]
struct ResourceEntry {
  value: Value,
}

pub fn render_route_document_from_tiles(tiles: &[(f64, f64)]) -> String {
  let mut body = String::from("<div id=\"wrapper\">");
  for &(x, y) in tiles {
    body.push_str(&format!(
      "<div class=\"tile\" style=\"left:{x:.2}px;top:{y:.2}px\"></div>"
    ));
  }
  body.push_str("</div>");

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
