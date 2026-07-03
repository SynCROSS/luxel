use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

const MESSAGE_KEY: &str = "route:index:message";
const CLIENT_ASSET: &str = "client.dev0.js";

#[derive(Deserialize)]
struct ResourceEntry {
  value: Value,
}

pub fn render_body_from_store(snapshot_json: &str) -> Result<String, String> {
  let message = message_from_snapshot_json(snapshot_json)?;
  Ok(render_body(&message))
}

pub fn render_document_from_store(
  snapshot_json: &str,
  route_path: &str,
  head_style: &str,
  hydration_script: &str,
  ship_data: bool,
  ship_hydration: bool,
  ship_client: bool,
) -> Result<String, String> {
  let message = message_from_snapshot_json(snapshot_json)?;
  Ok(render_document_parts(
    &message,
    snapshot_json,
    route_path,
    head_style,
    hydration_script,
    ship_data,
    ship_hydration,
    ship_client,
  ))
}

pub fn render_document(message: &str) -> String {
  let snapshot_json = format!(
    r#"{{"{MESSAGE_KEY}":{{"value":{{"message":{message_json}}},"generation":0,"tags":["home"],"cache":{{}},"stale":false}}}}"#,
    message_json = serde_json::to_string(message).unwrap_or_else(|_| "\"\"".to_string())
  );
  let hydration = r#"{"routeId":"route:index","bindings":[{"templateId":"message","resourceKey":"route:index:message","field":"message"}],"boundaries":[{"id":"boundary:0","directive":"load","clientModule":"client/routes/index.js"}]}"#;
  render_document_parts(
    message,
    &snapshot_json,
    "/",
    "button{font:inherit;min-width:44px;min-height:44px;}",
    &escape_json_for_script_embed(hydration),
    true,
    true,
    true,
  )
}

fn render_document_parts(
  message: &str,
  snapshot_json: &str,
  route_path: &str,
  head_style: &str,
  hydration_script: &str,
  ship_data: bool,
  ship_hydration: bool,
  ship_client: bool,
) -> String {
  let body = render_body(message);
  let style_block = if head_style.is_empty() {
    String::new()
  } else {
    format!("<style>{head_style}</style>")
  };
  let mut sidecars = String::new();
  if ship_data {
    sidecars.push_str(&format!(
      r#"<script type="application/json" id="luxel-data">{}</script>"#,
      luxel_data_script_embed(snapshot_json)
    ));
  }
  if ship_hydration && !hydration_script.is_empty() {
    sidecars.push_str(&format!(
      r#"<script type="application/json" id="luxel-hydration">{hydration_script}</script>"#
    ));
  }
  if ship_client {
    sidecars.push_str(&format!(
      r#"<script type="module" src="/assets/{CLIENT_ASSET}"></script>"#
    ));
  }
  format!(
    concat!(
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Luxel</title>",
      "{style_block}</head><body><main data-luxel-route=\"{route_path}\">{body}</main>",
      "{sidecars}</body></html>"
    ),
    style_block = style_block,
    route_path = route_path,
    body = body,
    sidecars = sidecars,
  )
}

fn message_from_snapshot_json(snapshot_json: &str) -> Result<String, String> {
  let snapshot: HashMap<String, ResourceEntry> =
    serde_json::from_str(snapshot_json).map_err(|e| format!("invalid snapshot json: {e}"))?;
  snapshot
    .get(MESSAGE_KEY)
    .and_then(|entry| entry.value.get("message"))
    .and_then(Value::as_str)
    .map(str::to_string)
    .ok_or_else(|| format!("missing message at {MESSAGE_KEY}"))
}

fn luxel_data_script_embed(snapshot_json: &str) -> String {
  let payload = format!(r#"{{"version":2,"resources":{}}}"#, snapshot_json.trim());
  escape_json_for_script_embed(&payload)
}

fn escape_json_for_script_embed(raw_json: &str) -> String {
  raw_json
    .replace('<', "\\u003C")
    .replace('>', "\\u003E")
    .replace('&', "\\u0026")
    .replace('\u{2028}', "\\u2028")
    .replace('\u{2029}', "\\u2029")
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
    let snapshot = r#"{"route:index:message":{"value":{"message":"Hello Luxel"},"generation":0,"tags":["home"],"cache":{},"stale":false}}"#;
    let body = render_body_from_store(snapshot).unwrap();
    assert!(body.contains("<h1>Hello Luxel</h1>"));
    assert!(body.contains(r#"data-luxel-text="count""#));
    assert!(body.contains("boundary:0"));
  }

  #[test]
  fn renders_counter_document_from_snapshot() {
    let snapshot = r#"{"route:index:message":{"value":{"message":"Hello Luxel"},"generation":0,"tags":["home"],"cache":{},"stale":false}}"#;
    let hydration = r#"{"routeId":"route:index"}"#;
    let html = render_document_from_store(
      snapshot,
      "/",
      "button{font:inherit;min-width:44px;min-height:44px;}",
      &escape_json_for_script_embed(hydration),
      true,
      true,
      true,
    )
    .unwrap();
    assert!(html.contains("<!doctype html>"));
    assert!(html.contains("<h1>Hello Luxel</h1>"));
    assert!(html.contains(r#"id="luxel-data""#));
    assert!(html.contains(r#"id="luxel-hydration""#));
    assert!(html.contains("/assets/client.dev0.js"));
  }

  #[test]
  fn escapes_message_html() {
    let body = render_body("<script>");
    assert!(body.contains("&lt;script&gt;"));
    assert!(!body.contains("<script>"));
  }
}
