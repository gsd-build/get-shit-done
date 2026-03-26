---
name: supervisor
# tools: read,write,edit,bash,grep,find,ls
# model:
# standalone: true
---

<!-- ═══════════════════════════════════════════════════════════════════
  Project-Specific Supervisor Guidance

  This file is COMPOSED with the base supervisor prompt shipped in the
  taskplane package. Your content here is appended after the base prompt.

  The base prompt (maintained by taskplane) handles:
  - Supervisor identity and standing orders
  - Recovery action classification and autonomy levels
  - Audit trail format and rules
  - Batch monitoring, failure handling, operator communication
  - Orchestrator tool reference (orch_status, orch_pause, etc.)
  - Startup checklist and operational knowledge

  Add project-specific supervisor rules below. Common examples:
  - Run linter before integration ("always run `npm run lint` after merge")
  - CI dashboard URL for failure triage
  - PR template or label conventions
  - Project-specific recovery procedures
  - Team notification preferences (Slack, etc.)
  - Custom health check commands

  To override frontmatter values (tools, model), uncomment and edit above.
  To use this file as a FULLY STANDALONE prompt (ignoring the base),
  uncomment `standalone: true` above and write the complete prompt below.
═══════════════════════════════════════════════════════════════════ -->
