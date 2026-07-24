# Krausest submodule pin

- **Path:** `vendor/js-framework-benchmark`
- **Remote:** https://github.com/krausest/js-framework-benchmark.git
- **Pin:** tag **`chrome150`** (commit recorded in parent gitlink)
- **Bump:** checkout new tag in submodule, commit updated gitlink + note Chrome version in `docs/benchmarks/krausest-runbook.md`

```bash
git submodule update --init vendor/js-framework-benchmark
cd vendor/js-framework-benchmark
git fetch --tags origin
git checkout chrome150   # or newer tag when bumping
cd ../..
git add vendor/js-framework-benchmark
```
