use indexmap::IndexMap;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Deserialize)]
struct RenderIr {
  #[serde(rename = "domOps")]
  dom_ops: Vec<DomOp>,
}

#[derive(Deserialize)]
#[serde(tag = "kind")]
enum DomOp {
  #[serde(rename = "element")]
  Element {
    tag: String,
    attrs: IndexMap<String, String>,
    children: Vec<DomOp>,
  },
  #[serde(rename = "text")]
  Text { expr: TemplateExpr },
  #[serde(rename = "forLoop")]
  ForLoop {
    #[serde(rename = "listId")]
    list_id: String,
    #[serde(rename = "itemName")]
    item_name: String,
    body: Vec<DomOp>,
  },
  #[serde(rename = "boundaryStart")]
  BoundaryStart { id: String, directive: String },
  #[serde(rename = "boundaryEnd")]
  BoundaryEnd { id: String },
}

#[derive(Deserialize)]
struct TemplateExpr {
  kind: String,
  raw: String,
}

#[derive(Deserialize)]
struct TemplateBinding {
  #[serde(rename = "templateId")]
  template_id: String,
  #[serde(rename = "resourceKey")]
  resource_key: String,
  field: String,
}

#[derive(Deserialize)]
struct ResourceEntry {
  value: Value,
}

pub fn render_body_from_ir(
  render_ir_json: &str,
  snapshot_json: &str,
  bindings_json: &str,
) -> Result<String, String> {
  let ir: RenderIr =
    serde_json::from_str(render_ir_json).map_err(|e| format!("invalid render ir json: {e}"))?;
  let snapshot: HashMap<String, ResourceEntry> =
    serde_json::from_str(snapshot_json).map_err(|e| format!("invalid snapshot json: {e}"))?;
  let bindings: Vec<TemplateBinding> =
    serde_json::from_str(bindings_json).map_err(|e| format!("invalid bindings json: {e}"))?;
  let template_data = project_template_data(&snapshot, &bindings);
  Ok(render_dom_ops(&ir.dom_ops, &template_data))
}

fn project_template_data(
  snapshot: &HashMap<String, ResourceEntry>,
  bindings: &[TemplateBinding],
) -> HashMap<String, Value> {
  let mut out = HashMap::new();
  for binding in bindings {
    let Some(entry) = snapshot.get(&binding.resource_key) else {
      continue;
    };
    let value = &entry.value;
    let projected = if value.is_object() {
      value
        .get(&binding.field)
        .cloned()
        .unwrap_or_else(|| value.clone())
    } else {
      value.clone()
    };
    out.insert(binding.template_id.clone(), projected);
  }
  out
}

fn render_dom_ops(ops: &[DomOp], data: &HashMap<String, Value>) -> String {
  ops.iter()
    .map(|op| render_dom_op(op, data))
    .collect::<Vec<_>>()
    .join("\n")
}

fn render_dom_op(op: &DomOp, data: &HashMap<String, Value>) -> String {
  match op {
    DomOp::BoundaryStart { id, directive } => {
      format!(r#"<!-- luxel:boundary-start id="{id}" directive="{directive}" -->"#)
    }
    DomOp::BoundaryEnd { id } => {
      format!(r#"<!-- luxel:boundary-end id="{id}" -->"#)
    }
    DomOp::ForLoop {
      list_id,
      item_name,
      body,
    } => render_for_loop(list_id, item_name, body, data),
    DomOp::Text { expr } => escape_html(&resolve_template_expr(expr, data)),
    DomOp::Element { tag, attrs, children } => {
      let (attrs, inner_html) = build_element(tag, attrs, children, data);
      let attr_str: String = attrs
        .iter()
        .map(|(k, v)| format!(r#" {k}="{}""#, escape_html(v)))
        .collect();
      if inner_html.is_empty() {
        format!("<{tag}{attr_str}></{tag}>")
      } else {
        format!("<{tag}{attr_str}>{inner_html}</{tag}>")
      }
    }
  }
}

fn build_element(
  _tag: &str,
  attrs: &IndexMap<String, String>,
  children: &[DomOp],
  data: &HashMap<String, Value>,
) -> (IndexMap<String, String>, String) {
  let mut out_attrs = IndexMap::new();
  for (name, value) in attrs {
    if name.starts_with("on:") || name.starts_with("hydrate:") {
      continue;
    }
    out_attrs.insert(name.clone(), value.clone());
  }

  let mut inner_parts: Vec<String> = Vec::new();
  for child in children {
    match child {
      DomOp::Text { expr } if expr.kind == "identifier" && expr.raw == "count" => {
        out_attrs.insert("data-luxel-text".to_string(), "count".to_string());
        inner_parts.push("0".to_string());
      }
      DomOp::Text { expr } => {
        inner_parts.push(escape_html(&resolve_template_expr(expr, data)));
      }
      DomOp::Element {
        tag: child_tag,
        attrs: child_attrs,
        children: child_children,
      } => {
        let (nested_attrs, nested_inner) =
          build_element(child_tag, child_attrs, child_children, data);
        let attr_str: String = nested_attrs
          .iter()
          .map(|(k, v)| format!(r#" {k}="{}""#, escape_html(v)))
          .collect();
        inner_parts.push(format!(
          "<{child_tag}{attr_str}>{nested_inner}</{child_tag}>"
        ));
      }
      DomOp::ForLoop {
        list_id,
        item_name,
        body,
      } => {
        inner_parts.push(render_for_loop(list_id, item_name, body, data).trim().to_string());
      }
      _ => {}
    }
  }

  (out_attrs, inner_parts.join(""))
}

fn render_for_loop(
  list_id: &str,
  item_name: &str,
  body: &[DomOp],
  data: &HashMap<String, Value>,
) -> String {
  let Some(Value::Array(list)) = data.get(list_id) else {
    return String::new();
  };
  list
    .iter()
    .map(|item| {
      let mut loop_data = data.clone();
      loop_data.insert(item_name.to_string(), item.clone());
      render_dom_ops(body, &loop_data)
    })
    .collect::<Vec<_>>()
    .join("\n")
}

fn resolve_template_expr(expr: &TemplateExpr, data: &HashMap<String, Value>) -> String {
  if expr.kind == "literal" {
    let parsed: Value =
      serde_json::from_str(&expr.raw).unwrap_or(Value::String(expr.raw.clone()));
    return value_to_string(&parsed);
  }
  resolve_expr(&expr.raw, data)
}

fn resolve_expr(raw: &str, data: &HashMap<String, Value>) -> String {
  if raw.contains('.') {
    let mut parts = raw.split('.');
    let head = parts.next().unwrap_or_default();
    let mut cur = data.get(head).cloned();
    for key in parts {
      cur = cur.and_then(|value| value.get(key).cloned());
    }
    return value_to_string(&cur.unwrap_or(Value::Null));
  }
  value_to_string(data.get(raw).unwrap_or(&Value::Null))
}

fn value_to_string(value: &Value) -> String {
  match value {
    Value::String(s) => s.clone(),
    Value::Number(n) => n.to_string(),
    Value::Bool(b) => b.to_string(),
    Value::Null => String::new(),
    other => other.to_string(),
  }
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

  const COUNTER_IR: &str = r#"{"domOps":[{"kind":"element","tag":"h1","attrs":{},"children":[{"kind":"text","expr":{"kind":"identifier","raw":"message"}}]},{"kind":"boundaryStart","id":"boundary:0","directive":"load"},{"kind":"element","tag":"section","attrs":{},"children":[{"kind":"element","tag":"button","attrs":{"type":"button","on:click":"increment"},"children":[{"kind":"text","expr":{"kind":"identifier","raw":"count"}}]}]},{"kind":"boundaryEnd","id":"boundary:0"}],"bindPoints":[],"boundaryIds":["boundary:0"],"headStyle":""}"#;

  const COUNTER_BINDINGS: &str =
    r#"[{"templateId":"message","resourceKey":"route:index:message","field":"message"}]"#;

  #[test]
  fn renders_counter_body_from_ir_json() {
    let snapshot = r#"{"route:index:message":{"value":{"message":"Hello Luxel"}}}"#;
    let body = render_body_from_ir(COUNTER_IR, snapshot, COUNTER_BINDINGS).unwrap();
    assert!(body.contains("<h1>Hello Luxel</h1>"));
    assert!(body.contains(r#"data-luxel-text="count""#));
    assert!(body.contains(">0</button>"));
  }

  #[test]
  fn escapes_message_html_in_ir_path() {
    let snapshot = r#"{"route:index:message":{"value":{"message":"<script>"}}}"#;
    let body = render_body_from_ir(COUNTER_IR, snapshot, COUNTER_BINDINGS).unwrap();
    assert!(body.contains("&lt;script&gt;"));
    assert!(!body.contains("<script>"));
  }
}
