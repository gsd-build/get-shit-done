# Gate Prompt Patterns

Reusable prompt patterns for structured gate checks in workflows and agents.

**For checkpoint box format details, see `references/ui-brand.md`** -- checkpoint boxes use double-line border drawing with 62-character inner width.

## Rules

- `header` must be max 12 characters
- `multiSelect` is always `false` for gate checks
- Always handle the "Other" case (user typed a freeform response instead of selecting)
- Max 4 options per prompt -- if more are needed, use a 2-step flow

---

## Pattern: approve-revise-abort
3-option gate for plan approval, gap-closure approval.
- question: "Approve these {noun}?"
- header: "Approve?"
- options: Approve | Request changes | Abort

## Pattern: yes-no
Simple 2-option confirmation for re-planning, rebuild, replace plans, commit.
- question: "{Specific question about the action}"
- header: "Confirm"
- options: Yes | No

## Pattern: stale-continue
2-option refresh gate for staleness warnings, timestamp freshness.
- question: "{Artifact} may be outdated. Refresh or continue?"
- header: "Stale"
- options: Refresh | Continue anyway

## Pattern: yes-no-pick
3-option selection for seed selection, item inclusion.
- question: "Include {items} in planning?"
- header: "Include?"
- options: Yes, all | Let me pick | No

## Pattern: multi-option-failure
4-option failure handler for build failures.
- question: "Plan {id} failed. How should we proceed?"
- header: "Failed"
- options: Retry | Skip | Rollback | Abort

## Pattern: multi-option-escalation
4-option escalation for review escalation (max retries exceeded).
- question: "Phase {N} has failed verification {attempt} times. How should we proceed?"
- header: "Escalate"
- options: Accept gaps | Re-plan (via /gsd-plan-phase) | Debug (via /gsd-debug) | Retry

## Pattern: multi-option-gaps
4-option gap handler for review gaps-found.
- question: "{count} verification gaps need attention. How should we proceed?"
- header: "Gaps"
- options: Auto-fix | Override | Manual | Skip

## Pattern: multi-option-priority
4-option priority selection for milestone gap priority.
- question: "Which gaps should we address?"
- header: "Priority"
- options: Must-fix only | Must + should | Everything | Let me pick

## Pattern: toggle-confirm
2-option confirmation for enabling/disabling boolean features.
- question: "Enable {feature_name}?"
- header: "Toggle"
- options: Enable | Disable

## Pattern: action-routing
Up to 4 suggested next actions with selection (status, resume workflows).
- question: "What would you like to do next?"
- header: "Next Step"
- options: {primary action} | {alternative 1} | {alternative 2} | Something else
- Note: Dynamically generate options from workflow state. Always include "Something else" as last option.

## Pattern: scope-confirm
3-option confirmation for quick task scope validation.
- question: "This task looks complex. Proceed as quick task or use full planning?"
- header: "Scope"
- options: Quick task | Full plan (via /gsd-plan-phase) | Revise

## Pattern: depth-select
3-option depth selection for planning workflow preferences.
- question: "How thorough should planning be?"
- header: "Depth"
- options: Quick (3-5 phases, skip research) | Standard (5-8 phases, default) | Comprehensive (8-12 phases, deep research)

## Pattern: context-handling
3-option handler for existing CONTEXT.md in discuss workflow.
- question: "Phase {N} already has a CONTEXT.md. How should we handle it?"
- header: "Context"
- options: Overwrite | Append | Cancel

## Pattern: gray-area-option
Dynamic template for presenting gray area choices in discuss workflow.
- question: "{Gray area title}"
- header: "Decision"
- options: {Option 1} | {Option 2} | Let Claude decide
- Note: Options generated at runtime. Always include "Let Claude decide" as last option.
