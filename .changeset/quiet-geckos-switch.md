---
type: Fixed
pr: 3443
---
Claude-facing command references now use the canonical namespaced form (`/gsd:<command>`) across workflows, commands, agents, templates, references, hooks, and runtime guidance text. Installer/runtime converters continue to map command syntax per-target where needed.
