/**
 * Profile output handlers — USER-PROFILE.md, dev-preferences, CLAUDE.md sections.
 * Ported from `get-shit-done/bin/lib/profile-output.cjs` (`cmdWriteProfile`,
 * `cmdGenerateDevPreferences`, `cmdGenerateClaudeProfile`, `cmdGenerateClaudeMd`).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../config.js';
import { GSDError, ErrorClassification } from '../errors.js';
import { CLAUDE_INSTRUCTIONS } from './profile-questionnaire-data.js';
import type { QueryHandler } from './utils.js';

const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../get-shit-done/templates');

const DIMENSION_KEYS = [
  'communication_style',
  'decision_speed',
  'explanation_depth',
  'debugging_approach',
  'ux_philosophy',
  'vendor_philosophy',
  'frustration_triggers',
  'learning_style',
] as const;

const CLAUDE_MD_FALLBACKS = {
  project: 'Project not yet initialized. Run /gsd-new-project to set up.',
  stack: 'Technology stack not yet documented. Will populate after codebase mapping or first phase.',
  conventions: 'Conventions not yet established. Will populate as patterns emerge during development.',
  architecture: 'Architecture not yet mapped. Follow existing patterns found in the codebase.',
  skills:
    'No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.',
};

const SKILL_SEARCH_DIRS = ['.claude/skills', '.agents/skills', '.cursor/skills', '.github/skills', '.codex/skills'];

const CLAUDE_MD_WORKFLOW_ENFORCEMENT = [
  'Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.',
  '',
  'Use these entry points:',
  '- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks',
  '- `/gsd-debug` for investigation and bug fixing',
  '- `/gsd-execute-phase` for planned phase work',
  '',
  'Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.',
].join('\n');

const CLAUDE_MD_PROFILE_PLACEHOLDER = [
  '<!-- GSD:profile-start -->',
  '## Developer Profile',
  '',
  '> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.',
  '> This section is managed by `generate-claude-profile` -- do not edit manually.',
  '<!-- GSD:profile-end -->',
].join('\n');

function safeReadFile(filePath: string): string | null {
  try {
    return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null;
  } catch {
    return null;
  }
}

function extractMarkdownSection(content: string, sectionName: string): string | null {
  if (!content) return null;
  const lines = content.split('\n');
  let capturing = false;
  const result: string[] = [];
  const headingPattern = new RegExp(`^## ${sectionName}\\s*$`);
  for (const line of lines) {
    if (headingPattern.test(line)) {
      capturing = true;
      result.push(line);
      continue;
    }
    if (capturing && /^## /.test(line)) break;
    if (capturing) result.push(line);
  }
  return result.length > 0 ? result.join('\n').trim() : null;
}

function extractSectionContent(fileContent: string, sectionName: string): string | null {
  const startMarker = `<!-- GSD:${sectionName}-start`;
  const endMarker = `<!-- GSD:${sectionName}-end -->`;
  const startIdx = fileContent.indexOf(startMarker);
  const endIdx = fileContent.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return null;
  const startTagEnd = fileContent.indexOf('-->', startIdx);
  if (startTagEnd === -1) return null;
  return fileContent.substring(startTagEnd + 3, endIdx);
}

function buildSection(sectionName: string, sourceFile: string, content: string): string {
  return [`<!-- GSD:${sectionName}-start source:${sourceFile} -->`, content, `<!-- GSD:${sectionName}-end -->`].join('\n');
}

function updateSection(
  fileContent: string,
  sectionName: string,
  newContent: string,
): { content: string; action: string } {
  const startMarker = `<!-- GSD:${sectionName}-start`;
  const endMarker = `<!-- GSD:${sectionName}-end -->`;
  const startIdx = fileContent.indexOf(startMarker);
  const endIdx = fileContent.indexOf(endMarker);
  if (startIdx !== -1 && endIdx !== -1) {
    const before = fileContent.substring(0, startIdx);
    const after = fileContent.substring(endIdx + endMarker.length);
    return { content: before + newContent + after, action: 'replaced' };
  }
  return { content: fileContent.trimEnd() + '\n\n' + newContent + '\n', action: 'appended' };
}

function detectManualEdit(fileContent: string, sectionName: string, expectedContent: string): boolean {
  const currentContent = extractSectionContent(fileContent, sectionName);
  if (currentContent === null) return false;
  const normalize = (s: string) => s.trim().replace(/\n{3,}/g, '\n\n');
  return normalize(currentContent) !== normalize(expectedContent);
}

function generateProjectSection(cwd: string): { content: string; source: string; hasFallback: boolean } {
  const projectPath = join(cwd, '.planning', 'PROJECT.md');
  const content = safeReadFile(projectPath);
  if (!content) {
    return { content: CLAUDE_MD_FALLBACKS.project, source: 'PROJECT.md', hasFallback: true };
  }
  const parts: string[] = [];
  const h1Match = content.match(/^# (.+)$/m);
  if (h1Match) parts.push(`**${h1Match[1]}**`);
  const whatThisIs = extractMarkdownSection(content, 'What This Is');
  if (whatThisIs) {
    const body = whatThisIs.replace(/^## What This Is\s*/i, '').trim();
    if (body) parts.push(body);
  }
  const coreValue = extractMarkdownSection(content, 'Core Value');
  if (coreValue) {
    const body = coreValue.replace(/^## Core Value\s*/i, '').trim();
    if (body) parts.push(`**Core Value:** ${body}`);
  }
  const constraints = extractMarkdownSection(content, 'Constraints');
  if (constraints) {
    const body = constraints.replace(/^## Constraints\s*/i, '').trim();
    if (body) parts.push(`### Constraints\n\n${body}`);
  }
  if (parts.length === 0) {
    return { content: CLAUDE_MD_FALLBACKS.project, source: 'PROJECT.md', hasFallback: true };
  }
  return { content: parts.join('\n\n'), source: 'PROJECT.md', hasFallback: false };
}

function generateStackSection(cwd: string): { content: string; source: string; hasFallback: boolean } {
  const codebasePath = join(cwd, '.planning', 'codebase', 'STACK.md');
  const researchPath = join(cwd, '.planning', 'research', 'STACK.md');
  let content = safeReadFile(codebasePath);
  let source = 'codebase/STACK.md';
  if (!content) {
    content = safeReadFile(researchPath);
    source = 'research/STACK.md';
  }
  if (!content) {
    return { content: CLAUDE_MD_FALLBACKS.stack, source: 'STACK.md', hasFallback: true };
  }
  const lines = content.split('\n');
  const summaryLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('#')) {
      if (!line.startsWith('# ') || summaryLines.length > 0) summaryLines.push(line);
      continue;
    }
    if (line.startsWith('|')) {
      inTable = true;
      summaryLines.push(line);
      continue;
    }
    if (inTable && line.trim() === '') inTable = false;
    if (line.startsWith('- ') || line.startsWith('* ')) summaryLines.push(line);
  }
  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : content.trim();
  return { content: summary, source, hasFallback: false };
}

function generateConventionsSection(cwd: string): { content: string; source: string; hasFallback: boolean } {
  const conventionsPath = join(cwd, '.planning', 'codebase', 'CONVENTIONS.md');
  const content = safeReadFile(conventionsPath);
  if (!content) {
    return { content: CLAUDE_MD_FALLBACKS.conventions, source: 'CONVENTIONS.md', hasFallback: true };
  }
  const lines = content.split('\n');
  const summaryLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) {
      if (!line.startsWith('# ')) summaryLines.push(line);
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('|')) summaryLines.push(line);
  }
  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : content.trim();
  return { content: summary, source: 'CONVENTIONS.md', hasFallback: false };
}

function generateArchitectureSection(cwd: string): { content: string; source: string; hasFallback: boolean } {
  const architecturePath = join(cwd, '.planning', 'codebase', 'ARCHITECTURE.md');
  const content = safeReadFile(architecturePath);
  if (!content) {
    return { content: CLAUDE_MD_FALLBACKS.architecture, source: 'ARCHITECTURE.md', hasFallback: true };
  }
  const lines = content.split('\n');
  const summaryLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) {
      if (!line.startsWith('# ')) summaryLines.push(line);
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('|') || line.startsWith('```')) {
      summaryLines.push(line);
    }
  }
  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : content.trim();
  return { content: summary, source: 'ARCHITECTURE.md', hasFallback: false };
}

function generateWorkflowSection(): { content: string; source: string; hasFallback: boolean } {
  return { content: CLAUDE_MD_WORKFLOW_ENFORCEMENT, source: 'GSD defaults', hasFallback: false };
}

function extractSkillFrontmatter(content: string): { name: string; description: string } {
  const result = { name: '', description: '' };
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return result;

  const fmBlock = fmMatch[1]!;
  const lines = fmBlock.split('\n');

  let currentKey = '';
  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1]!;
      const value = kvMatch[2]!.trim();
      if (currentKey === 'name') result.name = value;
      if (currentKey === 'description') result.description = value;
      continue;
    }
    if (currentKey === 'description' && /^\s+/.test(line)) {
      result.description += ` ${line.trim()}`;
    } else {
      currentKey = '';
    }
  }

  return result;
}

function generateSkillsSection(cwd: string): { content: string; source: string; hasFallback: boolean } {
  const discovered: Array<{ name: string; description: string; path: string }> = [];

  for (const dir of SKILL_SEARCH_DIRS) {
    const absDir = join(cwd, dir);
    if (!existsSync(absDir)) continue;

    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('gsd-')) continue;

      const skillMdPath = join(absDir, entry.name, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;

      const content = safeReadFile(skillMdPath);
      if (!content) continue;

      const frontmatter = extractSkillFrontmatter(content);
      const name = frontmatter.name || entry.name;
      const description = frontmatter.description || '';

      if (discovered.some((s) => s.name === name)) continue;

      discovered.push({ name, description, path: `${dir}/${entry.name}` });
    }
  }

  if (discovered.length === 0) {
    return { content: CLAUDE_MD_FALLBACKS.skills, source: 'skills/', hasFallback: true };
  }

  const lines = ['| Skill | Description | Path |', '|-------|-------------|------|'];
  for (const skill of discovered) {
    const desc = skill.description.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    const safeName = skill.name.replace(/\|/g, '\\|');
    lines.push(`| ${safeName} | ${desc} | \`${skill.path}/SKILL.md\` |`);
  }

  return { content: lines.join('\n'), source: 'skills/', hasFallback: false };
}

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /password\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /\/Users\/[a-zA-Z0-9._-]+\//g,
  /\/home\/[a-zA-Z0-9._-]+\//g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /xoxb-[a-zA-Z0-9-]+/g,
];

function cmdWriteProfileLogic(
  cwd: string,
  options: { input: string; output?: string | null },
): Record<string, unknown> {
  let analysisPath = options.input;
  if (!isAbsolute(analysisPath)) analysisPath = join(cwd, analysisPath);
  if (!existsSync(analysisPath)) {
    throw new GSDError(`Analysis file not found: ${analysisPath}`, ErrorClassification.Validation);
  }

  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(readFileSync(analysisPath, 'utf-8')) as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GSDError(`Failed to parse analysis JSON: ${msg}`, ErrorClassification.Validation);
  }

  if (!analysis.dimensions || typeof analysis.dimensions !== 'object') {
    throw new GSDError('Analysis JSON must contain a "dimensions" object', ErrorClassification.Validation);
  }
  if (!analysis.profile_version) {
    throw new GSDError('Analysis JSON must contain "profile_version"', ErrorClassification.Validation);
  }

  let redactedCount = 0;

  function redactSensitive(text: string): string {
    if (typeof text !== 'string') return text;
    let result = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = result.match(pattern);
      if (matches) {
        redactedCount += matches.length;
        result = result.replace(pattern, '[REDACTED]');
      }
    }
    return result;
  }

  const dimensions = analysis.dimensions as Record<string, Record<string, unknown>>;
  for (const dimKey of Object.keys(dimensions)) {
    const dim = dimensions[dimKey];
    if (!dim) continue;
    if (dim.evidence && Array.isArray(dim.evidence)) {
      for (const ev of dim.evidence as Array<Record<string, unknown>>) {
        if (ev.quote) ev.quote = redactSensitive(String(ev.quote));
        if (ev.example) ev.example = redactSensitive(String(ev.example));
        if (ev.signal) ev.signal = redactSensitive(String(ev.signal));
      }
    }
  }

  if (redactedCount > 0) {
    process.stderr.write(`Sensitive content redacted: ${redactedCount} pattern(s) removed from evidence quotes\n`);
  }

  const templatePath = join(TEMPLATE_DIR, 'user-profile.md');
  if (!existsSync(templatePath)) {
    throw new GSDError(`Template not found: ${templatePath}`, ErrorClassification.Validation);
  }
  let template = readFileSync(templatePath, 'utf-8');

  const dimensionLabels: Record<string, string> = {
    communication_style: 'Communication',
    decision_speed: 'Decisions',
    explanation_depth: 'Explanations',
    debugging_approach: 'Debugging',
    ux_philosophy: 'UX Philosophy',
    vendor_philosophy: 'Vendor Philosophy',
    frustration_triggers: 'Frustration Triggers',
    learning_style: 'Learning Style',
  };

  const summaryLines: string[] = [];
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let dimensionsScored = 0;

  for (const dimKey of DIMENSION_KEYS) {
    const dim = dimensions[dimKey];
    if (!dim) continue;
    const conf = String(dim.confidence ?? '').toUpperCase();
    if (conf === 'HIGH' || conf === 'MEDIUM' || conf === 'LOW') dimensionsScored++;
    if (conf === 'HIGH') {
      highCount++;
      if (dim.claude_instruction) {
        summaryLines.push(`- **${dimensionLabels[dimKey] || dimKey}:** ${dim.claude_instruction} (HIGH)`);
      }
    } else if (conf === 'MEDIUM') {
      mediumCount++;
      if (dim.claude_instruction) {
        summaryLines.push(`- **${dimensionLabels[dimKey] || dimKey}:** ${dim.claude_instruction} (MEDIUM)`);
      }
    } else if (conf === 'LOW') {
      lowCount++;
    }
  }

  const summaryInstructions =
    summaryLines.length > 0 ? summaryLines.join('\n') : '- No high or medium confidence dimensions scored yet.';

  const projectsList = (analysis.projects_list ?? analysis.projects_analyzed) as unknown[] | undefined;
  const projectsArr = Array.isArray(projectsList) ? projectsList : [];

  template = template.replace(/\{\{generated_at\}\}/g, new Date().toISOString());
  template = template.replace(/\{\{data_source\}\}/g, String(analysis.data_source ?? 'session_analysis'));
  template = template.replace(/\{\{projects_list\}\}/g, projectsArr.join(', '));
  template = template.replace(/\{\{message_count\}\}/g, String(analysis.message_count ?? analysis.messages_analyzed ?? 0));
  template = template.replace(/\{\{summary_instructions\}\}/g, summaryInstructions);
  template = template.replace(/\{\{profile_version\}\}/g, String(analysis.profile_version));
  template = template.replace(/\{\{projects_count\}\}/g, String(projectsArr.length));
  template = template.replace(/\{\{dimensions_scored\}\}/g, String(dimensionsScored));
  template = template.replace(/\{\{high_confidence_count\}\}/g, String(highCount));
  template = template.replace(/\{\{medium_confidence_count\}\}/g, String(mediumCount));
  template = template.replace(/\{\{low_confidence_count\}\}/g, String(lowCount));
  template = template.replace(
    /\{\{sensitive_excluded_summary\}\}/g,
    redactedCount > 0 ? `${redactedCount} pattern(s) redacted` : 'None detected',
  );

  for (const dimKey of DIMENSION_KEYS) {
    const dim = dimensions[dimKey] || {};
    const rating = String(dim.rating ?? 'UNSCORED');
    const confidence = String(dim.confidence ?? 'UNSCORED');
    const instruction = String(
      dim.claude_instruction ??
        'No strong preference detected. Ask the developer when this dimension is relevant.',
    );
    const summary = String(dim.summary ?? '');

    let evidenceBlock = '';
    const evidenceArr = (dim.evidence_quotes ?? dim.evidence) as unknown;
    if (evidenceArr && Array.isArray(evidenceArr) && evidenceArr.length > 0) {
      const evidenceLines = (evidenceArr as Array<Record<string, unknown>>).map((ev) => {
        const signal = String(ev.signal ?? ev.pattern ?? '');
        const quote = String(ev.quote ?? ev.example ?? '');
        const project = String(ev.project ?? 'unknown');
        return `- **Signal:** ${signal} / **Example:** "${quote}" -- project: ${project}`;
      });
      evidenceBlock = evidenceLines.join('\n');
    } else {
      evidenceBlock = '- No evidence collected for this dimension.';
    }

    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.rating\\}\\}`, 'g'), rating);
    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.confidence\\}\\}`, 'g'), confidence);
    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.claude_instruction\\}\\}`, 'g'), instruction);
    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.summary\\}\\}`, 'g'), summary);
    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.evidence\\}\\}`, 'g'), evidenceBlock);
  }

  let outputPath = options.output;
  if (!outputPath) {
    outputPath = join(homedir(), '.claude', 'get-shit-done', 'USER-PROFILE.md');
  } else if (!isAbsolute(outputPath)) {
    outputPath = join(cwd, outputPath);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, template, 'utf-8');

  return {
    profile_path: outputPath,
    dimensions_scored: dimensionsScored,
    high_confidence: highCount,
    medium_confidence: mediumCount,
    low_confidence: lowCount,
    sensitive_redacted: redactedCount,
    source: String(analysis.data_source ?? 'session_analysis'),
  };
}

export const writeProfile: QueryHandler = async (args, projectDir) => {
  const inputFlag = args.indexOf('--input');
  const inputPath = inputFlag >= 0 ? args[inputFlag + 1] : null;
  const outputFlag = args.indexOf('--output');
  const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : null;
  if (!inputPath) {
    throw new GSDError('--input <analysis-json-path> is required', ErrorClassification.Validation);
  }
  const data = cmdWriteProfileLogic(projectDir, { input: inputPath, output: outputPath ?? null });
  return { data };
};

export const generateDevPreferences: QueryHandler = async (args, projectDir) => {
  const analysisIdx = args.indexOf('--analysis');
  const analysisPath = analysisIdx >= 0 ? args[analysisIdx + 1] : null;
  const outputIdx = args.indexOf('--output');
  const outputPathOpt = outputIdx >= 0 ? args[outputIdx + 1] : null;
  const stackIdx = args.indexOf('--stack');
  const stackOpt = stackIdx >= 0 ? args[stackIdx + 1] : null;

  if (!analysisPath) {
    throw new GSDError('--analysis <path> is required', ErrorClassification.Validation);
  }

  let ap = analysisPath;
  if (!isAbsolute(ap)) ap = join(projectDir, ap);
  if (!existsSync(ap)) {
    throw new GSDError(`Analysis file not found: ${ap}`, ErrorClassification.Validation);
  }

  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(readFileSync(ap, 'utf-8')) as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GSDError(`Failed to parse analysis JSON: ${msg}`, ErrorClassification.Validation);
  }

  if (!analysis.dimensions || typeof analysis.dimensions !== 'object') {
    throw new GSDError('Analysis JSON must contain a "dimensions" object', ErrorClassification.Validation);
  }

  const devPrefLabels: Record<string, string> = {
    communication_style: 'Communication',
    decision_speed: 'Decision Support',
    explanation_depth: 'Explanations',
    debugging_approach: 'Debugging',
    ux_philosophy: 'UX Approach',
    vendor_philosophy: 'Library & Tool Choices',
    frustration_triggers: 'Boundaries',
    learning_style: 'Learning Support',
  };

  const templatePath = join(TEMPLATE_DIR, 'dev-preferences.md');
  if (!existsSync(templatePath)) {
    throw new GSDError(`Template not found: ${templatePath}`, ErrorClassification.Validation);
  }
  let template = readFileSync(templatePath, 'utf-8');

  const directiveLines: string[] = [];
  const dimensionsIncluded: string[] = [];
  const dimensions = analysis.dimensions as Record<string, Record<string, unknown>>;

  for (const dimKey of DIMENSION_KEYS) {
    const dim = dimensions[dimKey];
    if (!dim) continue;
    const label = devPrefLabels[dimKey] || dimKey;
    const confidence = String(dim.confidence ?? 'UNSCORED');
    let instruction = dim.claude_instruction as string | undefined;
    if (!instruction) {
      const lookup = CLAUDE_INSTRUCTIONS[dimKey];
      const rating = dim.rating as string | undefined;
      if (lookup && rating && lookup[rating]) {
        instruction = lookup[rating];
      } else {
        instruction = `Adapt to this developer's ${dimKey.replace(/_/g, ' ')} preference.`;
      }
    }
    directiveLines.push(`### ${label}\n${instruction} (${confidence} confidence)\n`);
    dimensionsIncluded.push(dimKey);
  }

  const directivesBlock = directiveLines.join('\n').trim();
  template = template.replace(/\{\{behavioral_directives\}\}/g, directivesBlock);
  template = template.replace(/\{\{generated_at\}\}/g, new Date().toISOString());
  template = template.replace(/\{\{data_source\}\}/g, String(analysis.data_source ?? 'session_analysis'));

  let stackBlock: string;
  if (analysis.data_source === 'questionnaire') {
    stackBlock =
      'Stack preferences not available (questionnaire-only profile). Run `/gsd-profile-user --refresh` with session data to populate.';
  } else if (stackOpt) {
    stackBlock = stackOpt;
  } else {
    stackBlock = 'Stack preferences will be populated from session analysis.';
  }
  template = template.replace(/\{\{stack_preferences\}\}/g, stackBlock);

  let outPath = outputPathOpt;
  if (!outPath) {
    outPath = join(homedir(), '.claude', 'commands', 'gsd', 'dev-preferences.md');
  } else if (!isAbsolute(outPath)) {
    outPath = join(projectDir, outPath);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, template, 'utf-8');

  return {
    data: {
      command_path: outPath,
      command_name: '/gsd-dev-preferences',
      dimensions_included: dimensionsIncluded,
      source: String(analysis.data_source ?? 'session_analysis'),
    },
  };
};

export const generateClaudeProfile: QueryHandler = async (args, projectDir) => {
  const analysisIdx = args.indexOf('--analysis');
  const analysisPath = analysisIdx >= 0 ? args[analysisIdx + 1] : null;
  const outputIdx = args.indexOf('--output');
  const outputPathOpt = outputIdx >= 0 ? args[outputIdx + 1] : null;
  const globalFlag = args.includes('--global');

  if (!analysisPath) {
    throw new GSDError('--analysis <path> is required', ErrorClassification.Validation);
  }

  let ap = analysisPath;
  if (!isAbsolute(ap)) ap = join(projectDir, ap);
  if (!existsSync(ap)) {
    throw new GSDError(`Analysis file not found: ${ap}`, ErrorClassification.Validation);
  }

  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(readFileSync(ap, 'utf-8')) as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GSDError(`Failed to parse analysis JSON: ${msg}`, ErrorClassification.Validation);
  }

  if (!analysis.dimensions || typeof analysis.dimensions !== 'object') {
    throw new GSDError('Analysis JSON must contain a "dimensions" object', ErrorClassification.Validation);
  }

  const profileLabels: Record<string, string> = {
    communication_style: 'Communication',
    decision_speed: 'Decisions',
    explanation_depth: 'Explanations',
    debugging_approach: 'Debugging',
    ux_philosophy: 'UX Philosophy',
    vendor_philosophy: 'Vendor Choices',
    frustration_triggers: 'Frustrations',
    learning_style: 'Learning',
  };

  const dataSource = String(analysis.data_source ?? 'session_analysis');
  const tableRows: string[] = [];
  const directiveLines: string[] = [];
  const dimensionsIncluded: string[] = [];
  const dimensions = analysis.dimensions as Record<string, Record<string, unknown>>;

  for (const dimKey of DIMENSION_KEYS) {
    const dim = dimensions[dimKey];
    if (!dim) continue;
    const label = profileLabels[dimKey] || dimKey;
    const rating = String(dim.rating ?? 'UNSCORED');
    const confidence = String(dim.confidence ?? 'UNSCORED');
    tableRows.push(`| ${label} | ${rating} | ${confidence} |`);
    let instruction = dim.claude_instruction as string | undefined;
    if (!instruction) {
      const lookup = CLAUDE_INSTRUCTIONS[dimKey];
      const r = dim.rating as string | undefined;
      if (lookup && r && lookup[r]) {
        instruction = lookup[r];
      } else {
        instruction = `Adapt to this developer's ${dimKey.replace(/_/g, ' ')} preference.`;
      }
    }
    directiveLines.push(`- **${label}:** ${instruction}`);
    dimensionsIncluded.push(dimKey);
  }

  const sectionLines = [
    '<!-- GSD:profile-start -->',
    '## Developer Profile',
    '',
    `> Generated by GSD from ${dataSource}. Run \`/gsd-profile-user --refresh\` to update.`,
    '',
    '| Dimension | Rating | Confidence |',
    '|-----------|--------|------------|',
    ...tableRows,
    '',
    '**Directives:**',
    ...directiveLines,
    '<!-- GSD:profile-end -->',
  ];

  const sectionContent = sectionLines.join('\n');

  let targetPath: string;
  if (globalFlag) {
    targetPath = join(homedir(), '.claude', 'CLAUDE.md');
  } else if (outputPathOpt) {
    targetPath = isAbsolute(outputPathOpt) ? outputPathOpt : join(projectDir, outputPathOpt);
  } else {
    let configClaudeMdPath = './CLAUDE.md';
    try {
      const config = await loadConfig(projectDir);
      const p = config.claude_md_path;
      if (typeof p === 'string' && p) configClaudeMdPath = p;
    } catch {
      /* default */
    }
    targetPath = isAbsolute(configClaudeMdPath)
      ? configClaudeMdPath
      : join(projectDir, configClaudeMdPath);
  }

  let action: string;

  if (existsSync(targetPath)) {
    let existingContent = readFileSync(targetPath, 'utf-8');
    const startMarker = '<!-- GSD:profile-start -->';
    const endMarker = '<!-- GSD:profile-end -->';
    const startIdx = existingContent.indexOf(startMarker);
    const endIdx = existingContent.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
      const before = existingContent.substring(0, startIdx);
      const after = existingContent.substring(endIdx + endMarker.length);
      existingContent = before + sectionContent + after;
      action = 'updated';
    } else {
      existingContent = existingContent.trimEnd() + '\n\n' + sectionContent + '\n';
      action = 'appended';
    }
    writeFileSync(targetPath, existingContent, 'utf-8');
  } else {
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, `${sectionContent}\n`, 'utf-8');
    action = 'created';
  }

  return {
    data: {
      claude_md_path: targetPath,
      action,
      dimensions_included: dimensionsIncluded,
      is_global: globalFlag,
    },
  };
};

export const generateClaudeMd: QueryHandler = async (args, projectDir) => {
  const outputIdx = args.indexOf('--output');
  const outputPathOpt = outputIdx >= 0 ? args[outputIdx + 1] : null;
  const autoFlag = args.includes('--auto');

  const MANAGED_SECTIONS = ['project', 'stack', 'conventions', 'architecture', 'skills', 'workflow'] as const;
  const generators: Record<
    (typeof MANAGED_SECTIONS)[number],
    (cwd: string) => { content: string; source: string; hasFallback: boolean }
  > = {
    project: generateProjectSection,
    stack: generateStackSection,
    conventions: generateConventionsSection,
    architecture: generateArchitectureSection,
    skills: generateSkillsSection,
    workflow: () => generateWorkflowSection(),
  };
  const sectionHeadings: Record<(typeof MANAGED_SECTIONS)[number], string> = {
    project: '## Project',
    stack: '## Technology Stack',
    conventions: '## Conventions',
    architecture: '## Architecture',
    skills: '## Project Skills',
    workflow: '## GSD Workflow Enforcement',
  };

  const generated: Record<
    string,
    { content: string; source: string; hasFallback: boolean }
  > = {};
  const sectionsGenerated: string[] = [];
  const sectionsFallback: string[] = [];
  const sectionsSkipped: string[] = [];

  for (const name of MANAGED_SECTIONS) {
    const gen = generators[name](projectDir);
    generated[name] = gen;
    if (gen.hasFallback) {
      sectionsFallback.push(name);
    } else {
      sectionsGenerated.push(name);
    }
  }

  let outputPath: string;
  if (!outputPathOpt) {
    let configClaudeMdPath = './CLAUDE.md';
    try {
      const config = await loadConfig(projectDir);
      const p = config.claude_md_path;
      if (typeof p === 'string' && p) configClaudeMdPath = p;
    } catch {
      /* default */
    }
    outputPath = isAbsolute(configClaudeMdPath)
      ? configClaudeMdPath
      : join(projectDir, configClaudeMdPath);
  } else if (!isAbsolute(outputPathOpt)) {
    outputPath = join(projectDir, outputPathOpt);
  } else {
    outputPath = outputPathOpt;
  }

  let existingContent = safeReadFile(outputPath);
  let action: string;

  if (existingContent === null) {
    const sections: string[] = [];
    for (const name of MANAGED_SECTIONS) {
      const gen = generated[name]!;
      const heading = sectionHeadings[name];
      const body = `${heading}\n\n${gen.content}`;
      sections.push(buildSection(name, gen.source, body));
    }
    sections.push('');
    sections.push(CLAUDE_MD_PROFILE_PLACEHOLDER);
    existingContent = `${sections.join('\n\n')}\n`;
    action = 'created';
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, existingContent, 'utf-8');
  } else {
    action = 'updated';
    let fileContent = existingContent;

    for (const name of MANAGED_SECTIONS) {
      const gen = generated[name]!;
      const heading = sectionHeadings[name];
      const body = `${heading}\n\n${gen.content}`;
      const fullSection = buildSection(name, gen.source, body);
      const hasMarkers = fileContent.indexOf(`<!-- GSD:${name}-start`) !== -1;

      if (hasMarkers) {
        if (autoFlag) {
          const expectedBody = `${heading}\n\n${gen.content}`;
          if (detectManualEdit(fileContent, name, expectedBody)) {
            sectionsSkipped.push(name);
            const genIdx = sectionsGenerated.indexOf(name);
            if (genIdx !== -1) sectionsGenerated.splice(genIdx, 1);
            const fbIdx = sectionsFallback.indexOf(name);
            if (fbIdx !== -1) sectionsFallback.splice(fbIdx, 1);
            continue;
          }
        }
        const result = updateSection(fileContent, name, fullSection);
        fileContent = result.content;
      } else {
        const result = updateSection(fileContent, name, fullSection);
        fileContent = result.content;
      }
    }

    if (!autoFlag && fileContent.indexOf('<!-- GSD:profile-start') === -1) {
      fileContent = `${fileContent.trimEnd()}\n\n${CLAUDE_MD_PROFILE_PLACEHOLDER}\n`;
    }

    writeFileSync(outputPath, fileContent, 'utf-8');
  }

  const finalContent = safeReadFile(outputPath);
  let profileStatus: string;
  if (finalContent && finalContent.indexOf('<!-- GSD:profile-start') !== -1) {
    if (action === 'created' || existingContent.indexOf('<!-- GSD:profile-start') === -1) {
      profileStatus = 'placeholder_added';
    } else {
      profileStatus = 'exists';
    }
  } else {
    profileStatus = 'already_present';
  }

  const genCount = sectionsGenerated.length;
  const totalManaged = MANAGED_SECTIONS.length;
  let message = `Generated ${genCount}/${totalManaged} sections.`;
  if (sectionsFallback.length > 0) message += ` Fallback: ${sectionsFallback.join(', ')}.`;
  if (sectionsSkipped.length > 0) message += ` Skipped (manually edited): ${sectionsSkipped.join(', ')}.`;
  if (profileStatus === 'placeholder_added') message += ' Run /gsd-profile-user to unlock Developer Profile.';

  return {
    data: {
      claude_md_path: outputPath,
      action,
      sections_generated: sectionsGenerated,
      sections_fallback: sectionsFallback,
      sections_skipped: sectionsSkipped,
      sections_total: totalManaged,
      profile_status: profileStatus,
      message,
    },
  };
};
