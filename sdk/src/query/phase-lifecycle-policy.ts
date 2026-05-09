import { GSDError, ErrorClassification } from '../errors.js';
import { escapeRegex } from './helpers.js';

export interface PhaseDirectoryComputation {
  phaseId: number | string;
  dirName: string;
}

export interface NextDecimalPhaseResult {
  next: string;
  existing: string[];
}

/** Reject strings containing null bytes (path traversal defense). */
export function assertNoNullBytes(value: string, label: string): void {
  if (value.includes('\0')) {
    throw new GSDError(`${label} contains null byte`, ErrorClassification.Validation);
  }
}

/** Reject `..` or path separators in phase directory names. */
export function assertSafePhaseDirName(dirName: string, label = 'phase directory'): void {
  if (/[/\\]|\.\./.test(dirName)) {
    throw new GSDError(`${label} contains invalid path segments`, ErrorClassification.Validation);
  }
}

export function assertSafeProjectCode(code: string): void {
  if (code && /[/\\]|\.\./.test(code)) {
    throw new GSDError('project_code contains invalid characters', ErrorClassification.Validation);
  }
}

/** Generate kebab-case slug from description. */
export function generatePhaseSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

export function parseMultiwordArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(`--${flag}`);
  if (idx === -1) return null;
  const tokens: string[] = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i]!.startsWith('--')) break;
    tokens.push(args[i]!);
  }
  return tokens.length > 0 ? tokens.join(' ') : null;
}

export function extractOneLinerFromBody(content: string): string | null {
  if (!content) return null;
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');
  const match = body.match(/^#[^\n]*\n+\*\*([^*]+)\*\*/m);
  return match ? match[1]!.trim() : null;
}

/**
 * Scan highest sequential phase number in milestone content.
 * Skips backlog lanes (`999.x`).
 */
export function scanSequentialMaxPhaseFromMilestone(milestoneContent: string): number {
  const phasePattern = /(?:^|\n)\s*(?:[-*]\s*(?:\[[x ]\]\s*)?|#{2,4}\s*|\*{1,2}\s*)Phase\s+(\d+)[A-Z]?(?:\.\d+)*:/gi;
  let maxPhase = 0;
  let m: RegExpExecArray | null;
  while ((m = phasePattern.exec(milestoneContent)) !== null) {
    const num = parseInt(m[1], 10);
    if (num >= 999) continue;
    if (num > maxPhase) maxPhase = num;
  }
  return maxPhase;
}

/**
 * Scan highest sequential phase number from phase directory names.
 * Supports optional project-code prefix and optional decimal suffixes.
 */
export function scanSequentialMaxPhaseFromDirs(dirNames: string[]): number {
  let maxPhase = 0;
  const dirNumPattern = /^(?:[A-Z][A-Z0-9]*-)?(\d+)[A-Z]?(?:\.\d+)*-/i;
  for (const dirName of dirNames) {
    const match = dirNumPattern.exec(dirName);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    if (num >= 999) continue;
    if (num > maxPhase) maxPhase = num;
  }
  return maxPhase;
}

export function computeNextSequentialPhaseId(milestoneContent: string, dirNames: string[]): number {
  return Math.max(
    scanSequentialMaxPhaseFromMilestone(milestoneContent),
    scanSequentialMaxPhaseFromDirs(dirNames),
  ) + 1;
}

export function computePhaseDirectory(
  namingMode: unknown,
  descriptionSlug: string,
  prefix: string,
  nextSequentialPhaseId: number,
  customId?: string | null,
): PhaseDirectoryComputation {
  if (customId || namingMode === 'custom') {
    const phaseId = customId || descriptionSlug.toUpperCase().replace(/-/g, '_');
    if (!phaseId) {
      throw new GSDError('--id required when phase_naming is "custom"', ErrorClassification.Validation);
    }
    assertSafePhaseDirName(String(phaseId), 'custom phase id');
    const dirName = `${prefix}${phaseId}-${descriptionSlug}`;
    assertSafePhaseDirName(dirName);
    return { phaseId, dirName };
  }

  const phaseId = nextSequentialPhaseId;
  const paddedNum = String(phaseId).padStart(2, '0');
  const dirName = `${prefix}${paddedNum}-${descriptionSlug}`;
  assertSafePhaseDirName(dirName);
  return { phaseId, dirName };
}

export function buildPhaseRoadmapEntry(
  phaseId: number | string,
  description: string,
  namingMode: unknown,
): string {
  const prevPhase = typeof phaseId === 'number' ? phaseId - 1 : null;
  const dependsOn = namingMode === 'custom' || prevPhase === null || prevPhase < 1
    ? ''
    : `\n**Depends on:** Phase ${prevPhase}`;
  return `\n### Phase ${phaseId}: ${description}\n\n**Goal:** [To be planned]\n**Requirements**: TBD${dependsOn}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${phaseId} to break down)\n`;
}

export function collectDecimalSuffixesFromDirNames(basePhase: string, dirNames: string[]): Set<number> {
  const decimalSet = new Set<number>();
  const decimalPattern = new RegExp(`^(?:[A-Z][A-Z0-9]*-)?${escapeRegex(basePhase)}\\.(\\d+)`, 'i');
  for (const dir of dirNames) {
    const match = dir.match(decimalPattern);
    if (match) decimalSet.add(parseInt(match[1], 10));
  }
  return decimalSet;
}

export function collectDecimalSuffixesFromRoadmap(basePhase: string, roadmapContent: string): Set<number> {
  const decimalSet = new Set<number>();
  const phasePattern = new RegExp(
    `#{2,4}\\s*Phase\\s+0*${escapeRegex(basePhase)}\\.(\\d+)\\s*:`,
    'gi',
  );
  let match: RegExpExecArray | null;
  while ((match = phasePattern.exec(roadmapContent)) !== null) {
    decimalSet.add(parseInt(match[1], 10));
  }
  return decimalSet;
}

export function computeNextDecimalPhase(basePhase: string, decimalSet: Set<number>): NextDecimalPhaseResult {
  const existing = Array.from(decimalSet)
    .sort((a, b) => a - b)
    .map((n) => `${basePhase}.${n}`);

  const next = decimalSet.size === 0
    ? `${basePhase}.1`
    : `${basePhase}.${Math.max(...decimalSet) + 1}`;

  return { next, existing };
}
