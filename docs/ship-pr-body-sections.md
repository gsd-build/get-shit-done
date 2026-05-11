# Custom PR Body Sections

`/gsd-ship` creates a pull request body from the planning artifacts for a verified phase. Projects can append extra PRD-style sections to that body with `ship.pr_body_sections` in `.planning/config.json`.

Use this when your project needs the PR to carry more release context than the default GSD sections, such as user stories, acceptance criteria, risks, release criteria, or stakeholder approval notes.

## What GSD Always Includes

Every generated `/gsd-ship` PR body keeps the required core sections:

- `Summary`
- `Changes`
- `Requirements Addressed`
- `Verification`
- `Key Decisions`

Custom sections are append-only. They render after `Key Decisions`; they cannot replace, remove, or reorder the core sections.

## Configure Sections During Onboarding

During `/gsd-new-project`, GSD can seed optional PRD-style sections into `.planning/config.json`.

Recommended onboarding choices:

- `User Stories & Acceptance Criteria` for user-facing stories and acceptance checks.
- `Risks & Dependencies` for rollout risks, dependencies, and rollback notes.
- `Success Metrics & Release Criteria` for Definition of Done, measurable outcomes, and release checks.
- `Stakeholder Review & Approval` for sign-off traceability.

Selected sections are written with `"enabled": true`. Seeded but unselected sections are written with `"enabled": false`, so you can enable them later without editing the shipped `/gsd-ship` workflow.

## Configure Sections Manually

Set `ship.pr_body_sections` with `gsd-sdk query config-set`:

```bash
gsd-sdk query config-set ship.pr_body_sections '[{"heading":"Risks & Dependencies","enabled":true,"source":"PLAN.md ## Risks || PLAN.md ## Dependencies","fallback":"- No known high-risk rollout dependencies."}]'
```

You can also edit `.planning/config.json` directly:

```json
{
  "ship": {
    "pr_body_sections": [
      {
        "heading": "User Stories & Acceptance Criteria",
        "enabled": true,
        "source": "REQUIREMENTS.md ## User Stories || REQUIREMENTS.md ## Acceptance Criteria",
        "fallback": "- Acceptance criteria are covered by the linked requirements and verification evidence."
      },
      {
        "heading": "Risks & Dependencies",
        "enabled": true,
        "source": "PLAN.md ## Risks || PLAN.md ## Dependencies",
        "fallback": "- No known high-risk rollout dependencies."
      },
      {
        "heading": "Stakeholder Review & Approval",
        "enabled": false,
        "template": "- Product owner approval pending for {phase_name}."
      }
    ]
  }
}
```

## Section Fields

Each section is an object with these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `heading` | Yes | Markdown heading text rendered as `## {heading}`. Must be one line. |
| `enabled` | No | Defaults to `true`. Set `false` to keep a section in config without rendering it. |
| `source` | No | Fallback chain of planning artifact headings to copy into the PR body. |
| `template` | No | Literal Markdown with a small set of supported tokens. |
| `fallback` | No | Literal Markdown used when `source` finds no content and no `template` is present. |

Each section must include at least one of `source`, `template`, or `fallback`.

## Source Selectors

`source` points at headings in planning artifacts. Use `||` to provide fallbacks:

```text
REQUIREMENTS.md ## User Stories || REQUIREMENTS.md ## Acceptance Criteria
```

Allowed source files:

- `ROADMAP.md`
- `PLAN.md`
- `SUMMARY.md`
- `VERIFICATION.md`
- `STATE.md`
- `REQUIREMENTS.md`
- `CONTEXT.md`

If the first selector has no content, GSD tries the next selector. If no selector produces content, GSD uses `fallback` when present. Empty final bodies are omitted.

## Template Tokens

`template` supports only these tokens:

- `{phase_number}`
- `{phase_name}`
- `{phase_dir}`
- `{base_branch}`
- `{padded_phase}`

Unknown tokens are rejected by config validation. This keeps PR body generation predictable and avoids accidental prompt or shell expansion.

Example:

```json
{
  "heading": "Stakeholder Review & Approval",
  "enabled": true,
  "template": "- Product owner approval pending for {phase_name}."
}
```

## Agile PRD Examples

For a lightweight agile PRD trail, use sections that map to the increment being shipped:

```json
{
  "heading": "User Stories & Acceptance Criteria",
  "enabled": true,
  "source": "REQUIREMENTS.md ## User Stories || REQUIREMENTS.md ## Acceptance Criteria",
  "fallback": "- Acceptance criteria are covered by the linked requirements and verification evidence."
}
```

```json
{
  "heading": "Success Metrics & Release Criteria",
  "enabled": true,
  "source": "REQUIREMENTS.md ## Definition of Done || VERIFICATION.md ## Release Criteria",
  "fallback": "- Release when automated verification and required manual checks pass."
}
```

These sections make the PR body useful as a release artifact: concise enough for review, but traceable back to requirements and verification.

## Troubleshooting

### `ship.pr_body_sections` is rejected

Check that the value is a JSON array and each entry has:

- a one-line `heading`
- `enabled` as `true` or `false`, not a string
- at least one of `source`, `template`, or `fallback`
- only supported fields

### A section does not appear in the PR body

Check these conditions:

- `enabled` is not `false`
- the selected source heading exists in the allowed artifact
- `fallback` or `template` is present if source content may be missing
- the rendered body is not empty after trimming

### A template token is rejected

Use only the supported token list above. Arbitrary environment variables, shell substitutions, and project-specific tokens are intentionally unsupported.
