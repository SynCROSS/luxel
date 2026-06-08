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

pub fn render_route_document(snapshot_json: &str) -> Result<String, String> {
  let snapshot: HashMap<String, ResourceEntry> =
    serde_json::from_str(snapshot_json).map_err(|e| format!("invalid snapshot json: {e}"))?;

  let tiles = snapshot
    .get(TILES_KEY)
    .and_then(|entry| entry.value.as_array())
    .ok_or_else(|| format!("missing tile list at {TILES_KEY}"))?;

  let mut body = String::from("<div id=\"wrapper\">");
  for tile in tiles {
    let x = tile.get("x").and_then(Value::as_f64).unwrap_or(0.0);
    let y = tile.get("y").and_then(Value::as_f64).unwrap_or(0.0);
    body.push_str(&format!(
      "<div class=\"tile\" style=\"left:{x:.2}px;top:{y:.2}px\"></div>"
    ));
  }
  body.push_str("</div>");

  let padded_body = format!("      {body}");
  let indented_css = indent_css(SPIRAL_HEAD_STYLE, 6);

  Ok(format!(
    "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>Luxel</title>\n    <style>\n{indented_css}\n    </style>\n  </head>\n  <body>\n    <main data-luxel-route=\"/\">\n{padded_body}\n    </main>\n  </body>\n</html>"
  ))
}

fn indent_css(css: &str, spaces: usize) -> String {
  let pad = " ".repeat(spaces);
  css.lines()
    .map(|line| {
      if line.trim().is_empty() {
        line.to_string()
      } else {
        format!("{pad}{line}")
      }
    })
    .collect::<Vec<_>>()
    .join("\n")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn renders_wrapper_for_empty_tiles() {
    let snapshot = r#"{"route:index:tiles":{"value":[]}}"#;
    let html = render_route_document(snapshot).unwrap();
    assert!(html.contains(r#"<div id="wrapper"></div>"#));
  }
}
