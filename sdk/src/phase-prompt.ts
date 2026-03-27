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
import { buildExecutorPrompt, parseAgentRole } from './prompt-builder.js';
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

// ─── PromptFactory class ─────────────────────────────────────────────────────

export class PromptFactory {
  private readonly workflowsDir: string;
  private readonly agentsDir: string;
  private readonly projectAgentsDir?: string;
  private readonly sdkPromptsDir: string;

  constructor(options?: {
    gsdInstallDir?: string;
    agentsDir?: string;
    projectAgentsDir?: string;
    sdkPromptsDir?: string;
  }) {
    const gsdInstallDir = options?.gsdInstallDir ?? join(homedir(), '.claude', 'get-shit-done');
    this.workflowsDir = join(gsdInstallDir, 'workflows');
    this.agentsDir = options?.agentsDir ?? join(homedir(), '.claude', 'agents');
    this.projectAgentsDir = options?.projectAgentsDir;
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
  ): Promise<string> {
    // Execute phase with a plan: delegate to existing buildExecutorPrompt
    if (phaseType === PhaseType.Execute && plan) {
      const agentDef = await this.loadAgentDef(phaseType);
      return sanitizePrompt(buildExecutorPrompt(plan, agentDef));
    }

    const sections: string[] = [];

    // ── Agent role ──
    const agentDef = await this.loadAgentDef(phaseType);
    if (agentDef) {
      const role = parseAgentRole(agentDef);
      if (role) {
        sections.push(`## Role\n\n${role}`);
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

    // ── Context files ──
    const contextSection = this.formatContextFiles(contextFiles);
    if (contextSection) {
      sections.push(contextSection);
    }

    // ── Phase-specific instructions ──
    const phaseInstructions = this.getPhaseInstructions(phaseType);
    if (phaseInstructions) {
      sections.push(`## Phase Instructions\n\n${phaseInstructions}`);
    }

    return sanitizePrompt(sections.join('\n\n'));
  }

  /**
   * Load the workflow file for a phase type.
   * Tries sdk/prompts/workflows/ first (headless versions), then
   * falls back to GSD-1 originals in workflowsDir.
   * Returns the raw content, or undefined if not found.
   */
  async loadWorkflowFile(phaseType: PhaseType): Promise<string | undefined> {
    const filename = PHASE_WORKFLOW_MAP[phaseType];

    // Try SDK prompts dir first (headless versions)
    const sdkPath = join(this.sdkPromptsDir, 'workflows', filename);
    try {
      return await readFile(sdkPath, 'utf-8');
    } catch {
      // Not in sdk/prompts/, fall through to GSD-1 originals
    }

    // Fall back to GSD-1 originals
    const filePath = join(this.workflowsDir, filename);
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  /**
   * Load the agent definition for a phase type.
   * Tries sdk/prompts/agents/ first (headless versions), then
   * user-level agents dir, then project-level.
   * Returns undefined if no agent is mapped or file not found.
   */
  async loadAgentDef(phaseType: PhaseType): Promise<string | undefined> {
    const agentFilename = PHASE_AGENT_MAP[phaseType];
    if (!agentFilename) return undefined;

    // Try SDK prompts dir first (headless versions)
    const paths = [
      join(this.sdkPromptsDir, 'agents', agentFilename),
      join(this.agentsDir, agentFilename),
    ];

    // Then project-level if configured
    if (this.projectAgentsDir) {
      paths.push(join(this.projectAgentsDir, agentFilename));
    }

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

  /**
   * Get phase-specific instructions that aren't covered by the workflow file.
   */
  private getPhaseInstructions(phaseType: PhaseType): string | null {
    switch (phaseType) {
      case PhaseType.Research:
        return 'Focus on technical investigation. Do not modify source files. Produce RESEARCH.md with findings organized by topic, confidence levels (HIGH/MEDIUM/LOW), and specific recommendations.';
      case PhaseType.Plan:
        return 'Create executable plans with task breakdown, dependency analysis, and verification criteria. Each task must have clear acceptance criteria and a done condition.';
      case PhaseType.Verify:
        return 'Verify goal achievement, not just task completion. Start from what the phase SHOULD deliver, then verify it actually exists and works. Produce VERIFICATION.md with pass/fail for each criterion.';
      case PhaseType.Discuss:
        return 'Extract implementation decisions that downstream agents need. Identify gray areas, capture decisions that guide research and planning.';
      case PhaseType.Execute:
        return null;
      default:
        return null;
    }
  }
}

export { PHASE_WORKFLOW_MAP };
