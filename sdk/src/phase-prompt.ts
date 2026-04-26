/**
 * Phase-aware prompt factory — assembles complete prompts for each phase type.
 *
 * Reads workflow .md + agent .md files from disk (D006), extracts structured
 * blocks (<role>, <purpose>, <process>), and composes system prompts with
 * injected context files per phase type.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

import type { ContextFiles, ParsedPlan } from './types.js';
import { PhaseType } from './types.js';
import { buildExecutorPrompt } from './prompt-builder.js';
import { PHASE_AGENT_MAP } from './tool-scoping.js';
import { sanitizePrompt } from './prompt-sanitizer.js';

// ─── Workflow file mapping ───────────────────────────────────────────────────

/**
 * Maps phase types to their workflow file names.
 */
const PHASE_WORKFLOW_MAP: Record<PhaseType, string> = {
  [PhaseType.Execute]: 'execute-plan.md',
  [PhaseType.Research]: 'research-phase.md',
  [PhaseType.Plan]: 'plan-phase.md',
  [PhaseType.Verify]: 'verify-phase.md',
  [PhaseType.Discuss]: 'discuss-phase.md',
  [PhaseType.Repair]: 'execute-plan.md',
};

// ─── XML block extraction ────────────────────────────────────────────────────

/**
 * Extract content from an XML-style block (e.g., <purpose>...</purpose>).
 * Returns the trimmed inner content, or empty string if not found.
 */
export function extractBlock(content: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract all <step> blocks from a workflow's <process> section.
 * Returns an array of step contents with their name attributes.
 */
export function extractSteps(processContent: string): Array<{ name: string; content: string }> {
  const steps: Array<{ name: string; content: string }> = [];
  const stepRegex = /<step\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/step>/gi;
  let match;

  while ((match = stepRegex.exec(processContent)) !== null) {
    steps.push({
      name: match[1],
      content: match[2].trim(),
    });
  }

  return steps;
}

// ─── YAML frontmatter stripping ─────────────────────────────────────────────

/**
 * Strip YAML frontmatter (---...---) from an agent definition file,
 * returning only the markdown/XML content body.
 */
export function stripYamlFrontmatter(content: string): string {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

// ─── PromptFactory class ─────────────────────────────────────────────────────

export class PromptFactory {
  private readonly workflowsDir: string;
  private readonly agentsDir: string;
  private readonly projectAgentsDir?: string;
  private readonly sdkPromptsDir: string;
  private readonly projectDir?: string;

  constructor(options?: {
    gsdInstallDir?: string;
    agentsDir?: string;
    projectAgentsDir?: string;
    sdkPromptsDir?: string;
    projectDir?: string;
  }) {
    const gsdInstallDir = options?.gsdInstallDir ?? join(homedir(), '.claude', 'get-shit-done');
    this.workflowsDir = join(gsdInstallDir, 'workflows');
    this.agentsDir = options?.agentsDir ?? join(homedir(), '.claude', 'agents');
    this.projectAgentsDir = options?.projectAgentsDir;
    this.projectDir = options?.projectDir;
    // SDK prompts dir: explicit override → package-relative default via import.meta.url
    this.sdkPromptsDir =
      options?.sdkPromptsDir ??
      join(fileURLToPath(new URL('.', import.meta.url)), '..', 'prompts');
  }

  /**
   * Build a complete prompt for the given phase type.
   *
   * For execute phase with a plan, delegates to buildExecutorPrompt().
   * For other phases, assembles: role + purpose + process steps + context.
   */
  async buildPrompt(
    phaseType: PhaseType,
    plan: ParsedPlan | null,
    contextFiles: ContextFiles,
    phaseDir?: string,
  ): Promise<string> {
    // Execute phase with a plan: delegate to existing buildExecutorPrompt
    if (phaseType === PhaseType.Execute && plan) {
      const agentDef = await this.loadAgentDef(phaseType);
      return sanitizePrompt(buildExecutorPrompt(plan, { agentDef, phaseDir }), this.projectDir);
    }

    // Prompt assembly order is cache-optimized (#1614):
    // Stable prefix (deterministic per phase type) → cached by Anthropic at 0.1x cost
    // Variable suffix (.planning/ files) → uncached, changes per project/run
    const sections: string[] = [];

    // ── STABLE PREFIX (cacheable across runs for the same phase type) ──

    // ── Full agent definition ──
    // Include the complete agent definition (minus YAML frontmatter), not just
    // the <role> block. The real agents have critical instructions in sections
    // like <philosophy>, <task_breakdown>, <plan_format>, <execution_flow>,
    // <scope_estimation>, <context_fidelity>, <checkpoints>, etc.
    const agentDef = await this.loadAgentDef(phaseType);
    if (agentDef) {
      const agentContent = stripYamlFrontmatter(agentDef);
      if (agentContent) {
        sections.push(`## Agent Instructions\n\n${agentContent}`);
      }
    }

    // ── Workflow purpose + process ──
    const workflow = await this.loadWorkflowFile(phaseType);
    if (workflow) {
      const purpose = extractBlock(workflow, 'purpose');
      if (purpose) {
        sections.push(`## Purpose\n\n${purpose}`);
      }

      const process = extractBlock(workflow, 'process');
      if (process) {
        const steps = extractSteps(process);
        if (steps.length > 0) {
          const stepBlocks = steps.map((s) => `### ${s.name}\n\n${s.content}`).join('\n\n');
          sections.push(`## Process\n\n${stepBlocks}`);
        }
      }
    }

    // ── VARIABLE SUFFIX (project-specific, changes per run) ──

    // ── Context files ──
    const contextSection = this.formatContextFiles(contextFiles);
    if (contextSection) {
      sections.push(contextSection);
    }

    return sanitizePrompt(sections.join('\n\n'), this.projectDir);
  }

  /**
   * Load the workflow file for a phase type.
   * Tries installed GSD workflows first (the complete, up-to-date versions),
   * then falls back to SDK bundled copies only if installed not found.
   * Returns the raw content, or undefined if not found.
   */
  async loadWorkflowFile(phaseType: PhaseType): Promise<string | undefined> {
    const filename = PHASE_WORKFLOW_MAP[phaseType];

    // Try installed GSD workflows first (complete versions)
    const paths = [
      join(this.workflowsDir, filename),
      join(this.sdkPromptsDir, 'workflows', filename),
    ];

    for (const p of paths) {
      try {
        return await readFile(p, 'utf-8');
      } catch {
        // Not found at this path, try next
      }
    }

    return undefined;
  }

  /**
   * Load the agent definition for a phase type.
   * Tries installed agents first (the complete, up-to-date versions),
   * then SDK bundled copies as last resort.
   * Returns undefined if no agent is mapped or file not found.
   */
  async loadAgentDef(phaseType: PhaseType): Promise<string | undefined> {
    const agentFilename = PHASE_AGENT_MAP[phaseType];
    if (!agentFilename) return undefined;

    // Priority: installed agents → project-level → SDK bundled (last resort)
    const paths = [
      join(this.agentsDir, agentFilename),
    ];

    if (this.projectAgentsDir) {
      paths.push(join(this.projectAgentsDir, agentFilename));
    }

    // SDK bundled copies are last resort only
    paths.push(join(this.sdkPromptsDir, 'agents', agentFilename));

    for (const p of paths) {
      try {
        return await readFile(p, 'utf-8');
      } catch {
        // Not found at this path, try next
      }
    }

    return undefined;
  }

  /**
   * Format context files into a prompt section.
   */
  private formatContextFiles(contextFiles: ContextFiles): string | null {
    const entries: string[] = [];

    const fileLabels: Record<keyof ContextFiles, string> = {
      state: 'Project State (STATE.md)',
      roadmap: 'Roadmap (ROADMAP.md)',
      context: 'Context (CONTEXT.md)',
      research: 'Research (RESEARCH.md)',
      requirements: 'Requirements (REQUIREMENTS.md)',
      config: 'Config (config.json)',
      plan: 'Plan (PLAN.md)',
      summary: 'Summary (SUMMARY.md)',
    };

    for (const [key, label] of Object.entries(fileLabels)) {
      const content = contextFiles[key as keyof ContextFiles];
      if (content) {
        entries.push(`### ${label}\n\n${content}`);
      }
    }

    if (entries.length === 0) return null;
    return `## Context\n\n${entries.join('\n\n')}`;
  }

}

export { PHASE_WORKFLOW_MAP };
