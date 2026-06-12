---
name: gsd:plan-review-convergence
description: "跨 AI 计划收敛循环：使用审查反馈重新规划直到没有高关注度"
argument-hint: "<phase> [--codex] [--gemini] [--claude] [--opencode] [--ollama] [--lm-studio] [--llama-cpp] [--text] [--ws <name>] [--all] [--max-cycles N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
requires: [phase, review]
---

<objective>
Cross-AI plan convergence loop — an outer revision gate around gsd-review and gsd-planner.
Repeatedly: review plans with external AI CLIs → if HIGH concerns found → replan with --reviews feedback → re-review. Stops when no HIGH concerns remain or max cycles reached.

**Flow:** Agent→Skill("gsd-plan-phase") → Agent→Skill("gsd-review") → check HIGHs → Agent→Skill("gsd-plan-phase --reviews") → Agent→Skill("gsd-review") → ... → Converge or escalate

Replaces gsd-plan-phase's internal gsd-plan-checker with external AI reviewers (codex, gemini, etc.). Each step runs inside an isolated Agent that calls the corresponding existing Skill — orchestrator only does loop control.

**Orchestrator role:** Parse arguments, validate phase, spawn Agents for existing Skills, check HIGHs, stall detection, escalation gate.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/plan-review-convergence.md
@$HOME/.claude/get-shit-done/references/revision-loop.md
@$HOME/.claude/get-shit-done/references/gates.md
@$HOME/.claude/get-shit-done/references/agent-contracts.md
</execution_context>

<runtime_note>
**Copilot (VS Code):** Use `vscode_askquestions` wherever this workflow calls `AskUserQuestion`. They are equivalent — `vscode_askquestions` is the VS Code Copilot implementation of the same interactive question API. Do not skip questioning steps because `AskUserQuestion` appears unavailable; use `vscode_askquestions` instead.
</runtime_note>

<context>
Phase number: extracted from $ARGUMENTS (required)

**Flags:**
- `--codex` — Use Codex CLI as reviewer (default if no reviewer specified)
- `--gemini` — Use Gemini CLI as reviewer
- `--claude` — Use Claude CLI as reviewer (separate session)
- `--opencode` — Use OpenCode as reviewer
- `--ollama` — Use local Ollama server as reviewer (OpenAI-compatible, default host `http://localhost:11434`; configure model via `review.models.ollama`)
- `--lm-studio` — Use local LM Studio server as reviewer (OpenAI-compatible, default host `http://localhost:1234`; configure model via `review.models.lm_studio`)
- `--llama-cpp` — Use local llama.cpp server as reviewer (OpenAI-compatible, default host `http://localhost:8080`; configure model via `review.models.llama_cpp`)
- `--all` — Use all available CLIs and running local model servers
- `--max-cycles N` — Maximum replan→review cycles (default: 3)

**Feature gate:** This command requires `workflow.plan_review_convergence=true`. Enable with:
`gsd config-set workflow.plan_review_convergence true`
</context>

<process>
Execute end-to-end.
Preserve all workflow gates (pre-flight, revision loop, stall detection, escalation).
</process>
