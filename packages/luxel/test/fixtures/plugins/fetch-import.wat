(module
  (import "env" "fetch" (func $fetch (result i32)))
  (func (export "run") (result i32)
    (call $fetch))
)
