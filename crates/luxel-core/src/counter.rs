use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

const MESSAGE_KEY: &str = "route:index:message";

#[derive(Deserialize)]
struct ResourceEntry {
  value: Value,
}

pub fn render_body_from_store(snapshot_json: &str) -> Result<String, String> {
  let snapshot: HashMap<String, ResourceEntry> =
    serde_json::from_str(snapshot_json).map_err(|e| format!("invalid snapshot json: {e}"))?;

  let message = snapshot
    .get(MESSAGE_KEY)
    .and_then(|entry| entry.value.get("message"))
    .and_then(Value::as_str)
    .ok_or_else(|| format!("missing message at {MESSAGE_KEY}"))?;

  Ok(render_body(message))
}

pub fn render_body(message: &str) -> String {
  format!(
    concat!(
      "<h1>{message}</h1>",
      "<!-- luxel:boundary-start id=\"boundary:0\" directive=\"load\" -->",
      "<section><button type=\"button\" data-luxel-text=\"count\">0</button></section>",
      "<!-- luxel:boundary-end id=\"boundary:0\" -->"
    ),
    message = escape_html(message)
  )
}

fn escape_html(raw: &str) -> String {
  let mut out = String::with_capacity(raw.len());
  for ch in raw.chars() {
    match ch {
      '&' => out.push_str("&amp;"),
      '<' => out.push_str("&lt;"),
      '>' => out.push_str("&gt;"),
      '"' => out.push_str("&quot;"),
      '\'' => out.push_str("&#39;"),
      _ => out.push(ch),
    }
  }
  out
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn renders_counter_body_from_snapshot() {
    let snapshot = r#"{"route:index:message":{"value":{"message":"Hello Luxel"}}}"#;
    let body = render_body_from_store(snapshot).unwrap();
    assert!(body.contains("<h1>Hello Luxel</h1>"));
    assert!(body.contains(r#"data-luxel-text="count""#));
    assert!(body.contains("boundary:0"));
  }

  #[test]
  fn escapes_message_html() {
    let body = render_body("<script>");
    assert!(body.contains("&lt;script&gt;"));
    assert!(!body.contains("<script>"));
  }
}
