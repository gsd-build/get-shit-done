---
type: Added
issue: 3782
---
**Native support for Antigravity CLI (`agy`) runtime is added** — GSD now natively supports the new `agy` runtime. When installing via `--agy`, paths are mapped to the `.agy` local directory and `.gemini/antigravity-cli` global directory. It deploys skills under `skills/` and agents under `agents/` instead of deep plugin directories, ensuring lightweight and clean installations. Fully tested with comprehensive regression coverage.
