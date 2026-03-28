/**
 * Prompt builder — assembles executor prompts from parsed plans.
 *
 * Converts a ParsedPlan into a structured prompt that tells the
 * executor agent exactly what to do: follow the tasks sequentially,
 * verify each one, and produce a SUMMARY.md at the end.
 */

import type { ParsedPlan, PlanTask } from './types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];

// ─── Agent definition parsing ────────────────────────────────────────────────

/**
 * Extract the tools list from a gsd-executor.md agent definition.
 * Falls back to DEFAULT_ALLOWED_TOOLS if parsing fails.
 */
export function parseAgentTools(agentDef: string): string[] {
  // Look for "tools:" in the YAML frontmatter
  const frontmatterMatch = agentDef.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return DEFAULT_ALLOWED_TOOLS;

  const toolsMatch = frontmatterMatch[1].match(/^tools:\s*(.+)$/m);
  if (!toolsMatch) return DEFAULT_ALLOWED_TOOLS;

  const tools = toolsMatch[1]
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return tools.length > 0 ? tools : DEFAULT_ALLOWED_TOOLS;
}

/**
 * Extract the role instructions from a gsd-executor.md agent definition.
 * Returns the <role>...</role> block content, or empty string.
 */
export function parseAgentRole(agentDef: string): string {
  const match = agentDef.match(/<role>([\s\S]*?)<\/role>/i);
  return match ? match[1].trim() : '';
}

// ─── Prompt assembly ─────────────────────────────────────────────────────────

/**
 * Format a single task into a prompt block.
 */
function formatTask(task: PlanTask, index: number): string {
  const lines: string[] = [];
  lines.push(`### Task ${index + 1}: ${task.name}`);

  if (task.files.length > 0) {
    lines.push(`**Files:** ${task.files.join(', ')}`);
  }

  if (task.read_first.length > 0) {
    lines.push(`**Read first:** ${task.read_first.join(', ')}`);
  }

  lines.push('');
  lines.push('**Action:**');
  lines.push(task.action);

  if (task.verify) {
    lines.push('');
    lines.push('**Verify:**');
    lines.push(task.verify);
  }

  if (task.done) {
    lines.push('');
    lines.push('**Done when:**');
    lines.push(task.done);
  }

  if (task.acceptance_criteria.length > 0) {
    lines.push('');
    lines.push('**Acceptance criteria:**');
    for (const criterion of task.acceptance_criteria) {
      lines.push(`- ${criterion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build the executor prompt from a parsed plan and optional agent definition.
 *
 * The prompt instructs the executor to:
 * 1. Follow the plan tasks sequentially
 * 2. Run verification for each task
 * 3. Commit each task individually
 * 4. Produce a SUMMARY.md file on completion
 *
 * @param plan - Parsed plan structure from plan-parser
 * @param agentDef - Raw content of gsd-executor.md agent definition (optional)
 * @returns Assembled prompt string
 */
export function buildExecutorPrompt(plan: ParsedPlan, agentDef?: string): string {
  const sections: string[] = [];

  // ── Role instructions from agent definition ──
  if (agentDef) {
    const role = parseAgentRole(agentDef);
    if (role) {
      sections.push(`## Role\n\n${role}`);
    }
  }

  // ── Objective ──
  if (plan.objective) {
    sections.push(`## Objective\n\n${plan.objective}`);
  } else {
    sections.push(`## Objective\n\nExecute plan: ${plan.frontmatter.plan || plan.frontmatter.phase || 'unnamed'}`);
  }

  // ── Plan metadata ──
  const meta: string[] = [];
  if (plan.frontmatter.phase) meta.push(`Phase: ${plan.frontmatter.phase}`);
  if (plan.frontmatter.plan) meta.push(`Plan: ${plan.frontmatter.plan}`);
  if (plan.frontmatter.type) meta.push(`Type: ${plan.frontmatter.type}`);
  if (meta.length > 0) {
    sections.push(`## Plan Info\n\n${meta.join('\n')}`);
  }

  // ── Context references ──
  if (plan.context_refs.length > 0) {
    const refs = plan.context_refs.map((r) => `- @${r}`).join('\n');
    sections.push(`## Context Files\n\nRead these files for context before starting:\n${refs}`);
  }

  // ── Tasks ──
  if (plan.tasks.length > 0) {
    const taskBlocks = plan.tasks.map((t, i) => formatTask(t, i)).join('\n\n---\n\n');
    sections.push(`## Tasks\n\nExecute these tasks sequentially. For each task: read any referenced files, execute the action, run verification, confirm done criteria, then commit.\n\n${taskBlocks}`);
  } else {
    sections.push(`## Tasks\n\nNo tasks defined in this plan. Review the objective and determine if any actions are needed.`);
  }

  // ── Must-haves ──
  if (plan.frontmatter.must_haves) {
    const mh = plan.frontmatter.must_haves;
    const parts: string[] = [];

    if (mh.truths.length > 0) {
      parts.push('**Truths (invariants):**');
      for (const t of mh.truths) {
        parts.push(`- ${t}`);
      }
    }

    if (mh.artifacts.length > 0) {
      parts.push('**Required artifacts:**');
      for (const a of mh.artifacts) {
        parts.push(`- \`${a.path}\`: ${a.provides}`);
      }
    }

    if (mh.key_links.length > 0) {
      parts.push('**Key links:**');
      for (const l of mh.key_links) {
        parts.push(`- ${l.from} → ${l.to} via ${l.via}`);
      }
    }

    if (parts.length > 0) {
      sections.push(`## Must-Haves\n\n${parts.join('\n')}`);
    }
  }

  // ── Completion instructions ──
  sections.push(
    `## Completion\n\n` +
    `After all tasks are complete:\n` +
    `1. Run any overall verification or success criteria checks\n` +
    `2. Create a SUMMARY.md file documenting:\n` +
    `   - One-line summary of what was accomplished\n` +
    `   - Tasks completed with commit hashes\n` +
    `   - Any deviations from the plan\n` +
    `   - Files created or modified\n` +
    `   - Known issues (if any)\n` +
    `3. Commit the SUMMARY.md\n` +
    `4. Report completion`,
  );

  return sections.join('\n\n');
}

export { DEFAULT_ALLOWED_TOOLS };
