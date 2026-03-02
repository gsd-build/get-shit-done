#!/usr/bin/env node

// gsdd - GSD Distilled CLI

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, cpSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DISTILLED_DIR = join(__dirname, '..', 'distilled');
const CWD = process.cwd();
const PLANNING_DIR = join(CWD, '.planning');

const [,, command, ...args] = process.argv;

const COMMANDS = {
  init: cmdInit,
  update: cmdUpdate,
  'find-phase': cmdFindPhase,
  verify: cmdVerify,
  scaffold: cmdScaffold,
  help: cmdHelp,
};

if (!command || !COMMANDS[command]) {
  cmdHelp();
  process.exit(command ? 1 : 0);
}

(async () => {
  await COMMANDS[command](...args);
})();

const WORKFLOWS = [
  { name: 'gsdd-new-project', workflow: 'new-project.md', description: 'New project - questioning, codebase audit, research, spec, roadmap', agent: 'Plan', opencodeType: 'plan' },
  { name: 'gsdd-plan', workflow: 'plan.md', description: 'Plan a phase - research check, backward planning, task creation', agent: 'Plan', opencodeType: 'plan' },
  { name: 'gsdd-execute', workflow: 'execute.md', description: 'Execute a phase plan - implement tasks, commit atomically, verify', agent: 'Code', opencodeType: 'edit' },
  { name: 'gsdd-verify', workflow: 'verify.md', description: 'Verify a completed phase - 3-level checks, anti-pattern scan', agent: 'Plan', opencodeType: 'plan' },
];

async function cmdInit(...initArgs) {
  console.log('gsdd init - setting up SDD workflow\n');

  // 1) Create .planning/ structure
  if (existsSync(PLANNING_DIR)) {
    console.log('  - .planning/ already exists (skipping folder creation)');
  } else {
    mkdirSync(join(PLANNING_DIR, 'phases'), { recursive: true });
    mkdirSync(join(PLANNING_DIR, 'research'), { recursive: true });
    console.log('  - created .planning/ directory structure');
  }

  // 2) Copy templates into .planning/templates/
  const localTemplatesDir = join(PLANNING_DIR, 'templates');
  const globalTemplatesDir = join(DISTILLED_DIR, 'templates');
  if (!existsSync(localTemplatesDir)) {
    if (existsSync(globalTemplatesDir)) {
      cpSync(globalTemplatesDir, localTemplatesDir, { recursive: true });
      console.log('  - copied templates to .planning/templates/');
    } else {
      console.log('  - WARN: missing distilled/templates/; cannot copy templates');
    }
  } else {
    console.log('  - .planning/templates/ already exists');
  }

  // 3) Create config.json via interactive CLI (only if missing)
  const configFile = join(PLANNING_DIR, 'config.json');
  if (!existsSync(configFile)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log("  Let's configure the planning strategy for this project:\n");

    // --- Research depth ---
    console.log('  Research depth:');
    console.log('   - balanced: SOTA research per phase (recommended)');
    console.log('   - fast: skip deep domain research, plan from existing knowledge');
    console.log('   - deep: exhaustive web sweeps + parallel researchers for every feature');
    let researchDepth = await askQuestion('  Depth [balanced/fast/deep] (default: balanced): ');
    researchDepth = researchDepth.trim().toLowerCase();
    if (!['balanced', 'fast', 'deep'].includes(researchDepth)) researchDepth = 'balanced';

    // --- Parallelization ---
    console.log('\n  Parallelization (run independent agents simultaneously):');
    console.log('   - yes: faster, uses more tokens (recommended for non-trivial projects)');
    console.log('   - no: sequential, lower token usage');
    let parallelInput = await askQuestion('  Parallelize agents? [yes/no] (default: yes): ');
    const parallelization = parallelInput.trim().toLowerCase() !== 'no';

    // --- Commit planning docs ---
    console.log('\n  Version control for planning docs:');
    console.log('   - yes: .planning/ tracked in git (recommended — enables history + recovery)');
    console.log('   - no: .planning/ added to .gitignore (local only)');
    let commitInput = await askQuestion('  Commit planning docs to git? [yes/no] (default: yes): ');
    const commitDocs = commitInput.trim().toLowerCase() !== 'no';

    // --- Model profile ---
    console.log('\n  AI model profile for planning agents:');
    console.log('   - balanced: capable model for most agents (recommended)');
    console.log('   - quality: most capable model for research/roadmap (higher cost)');
    console.log('   - budget: fastest/cheapest model (lower quality for complex tasks)');
    let modelProfile = await askQuestion('  Model profile [balanced/quality/budget] (default: balanced): ');
    modelProfile = modelProfile.trim().toLowerCase();
    if (!['balanced', 'quality', 'budget'].includes(modelProfile)) modelProfile = 'balanced';

    // --- Workflow toggles ---
    console.log('\n  Workflow agents (each adds quality but costs tokens/time):');

    let researchInput = await askQuestion('  Research before planning each phase? [yes/no] (default: yes): ');
    const workflowResearch = researchInput.trim().toLowerCase() !== 'no';

    let planCheckInput = await askQuestion('  Verify plans achieve their goals before executing? [yes/no] (default: yes): ');
    const workflowPlanCheck = planCheckInput.trim().toLowerCase() !== 'no';

    let verifierInput = await askQuestion('  Verify phase deliverables after execution? [yes/no] (default: yes): ');
    const workflowVerifier = verifierInput.trim().toLowerCase() !== 'no';

    // --- Git protocol ---
    console.log('\n  Version Control Protocol (Hybrid Git Strategy)');
    console.log('   Deterministic rules reduce hallucinated branch names and commits.');

    let branchStrategy = await askQuestion('   Branch strategy (default: feature/[category]-[name]): ');
    branchStrategy = branchStrategy.trim() || 'feature/[category]-[name]';

    let commitStrategy = await askQuestion('   Commit strategy (default: Conventional Commits, logical grouping): ');
    commitStrategy = commitStrategy.trim() || 'Conventional Commits, logical grouping';

    let prStrategy = await askQuestion('   PR strategy (default: Create PR via gh cli on phase verification): ');
    prStrategy = prStrategy.trim() || 'Create PR via gh cli on phase verification';

    if (!commitDocs) {
      const gitignorePath = join(CWD, '.gitignore');
      const ignoreEntry = '\n# GSDD planning docs (local only)\n.planning/\n';
      if (existsSync(gitignorePath)) {
        const existing = readFileSync(gitignorePath, 'utf-8');
        if (!existing.includes('.planning/')) {
          writeFileSync(gitignorePath, existing + ignoreEntry);
          console.log('  - added .planning/ to .gitignore');
        }
      } else {
        writeFileSync(gitignorePath, ignoreEntry.trimStart());
        console.log('  - created .gitignore with .planning/ entry');
      }
    }

    const config = {
      researchDepth,
      parallelization,
      commitDocs,
      modelProfile,
      workflow: {
        research: workflowResearch,
        planCheck: workflowPlanCheck,
        verifier: workflowVerifier,
      },
      gitProtocol: { branch: branchStrategy, commit: commitStrategy, pr: prStrategy },
      initVersion: 'v1.1',
    };
    writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log('\n  - saved .planning/config.json\n');
    rl.close();
  } else {
    console.log('  - .planning/config.json already exists');
  }

  // 4) Always generate open-standard skills into .agents/skills/gsdd-*
  // This is project-local and does not require touching root AGENTS.md.
  generateOpenStandardSkills();
  console.log('  - generated open-standard skills (.agents/skills/gsdd-*)');

  // 5) Generate requested/detected adapters
  const requestedTools = parseToolsFlag(initArgs);
  const platforms = requestedTools.length > 0 ? requestedTools : detectPlatforms();

  for (const platform of platforms) {
    if (platform === 'claude') {
      generateClaudeSkills();
      console.log('  - generated Claude Code skills (.claude/skills/gsdd-*)');
    }
    if (platform === 'opencode') {
      generateOpenCodeSkills();
      console.log('  - generated OpenCode slash commands (.opencode/commands/gsdd-*.md)');
    }
    if (platform === 'codex') {
      generateCodexConfig();
      console.log('  - generated Codex CLI adapter (.codex/AGENTS.md)');
    }
    if (['agents', 'cursor', 'copilot', 'gemini'].includes(platform)) {
      generateRootAgentsMd();
      console.log('  - generated/updated root AGENTS.md (bounded GSDD block)');
    }
  }

  console.log('\nSDD initialized.');
  console.log('Next: run the new-project workflow using your tool:');
  console.log('  - open `.agents/skills/gsdd-new-project/SKILL.md` (or run the equivalent slash command if your tool supports skills)');
  console.log('  - then follow the new-project workflow to produce `.planning/SPEC.md` and `.planning/ROADMAP.md`\n');
}

function cmdUpdate(...updateArgs) {
  console.log('gsdd update - regenerating adapter files\n');

  const requestedTools = parseToolsFlag(updateArgs);
  const platforms = requestedTools.length > 0 ? requestedTools : detectPlatforms();

  let updated = false;

  // Open-standard skills (if present or requested)
  if (platforms.length > 0 || existsSync(join(CWD, '.agents', 'skills'))) {
    generateOpenStandardSkills();
    console.log('  - updated open-standard skills (.agents/skills/gsdd-*)');
    updated = true;
  }

  if (platforms.includes('claude') || existsSync(join(CWD, '.claude', 'skills'))) {
    generateClaudeSkills();
    console.log('  - updated Claude Code skills (.claude/skills/gsdd-*)');
    updated = true;
  }

  if (platforms.includes('opencode') || existsSync(join(CWD, '.opencode', 'commands'))) {
    generateOpenCodeSkills();
    console.log('  - updated OpenCode slash commands (.opencode/commands/gsdd-*.md)');
    updated = true;
  }

  if (platforms.includes('codex') || existsSync(join(CWD, '.codex', 'AGENTS.md'))) {
    generateCodexConfig();
    console.log('  - updated Codex CLI adapter (.codex/AGENTS.md)');
    updated = true;
  }

  // Root AGENTS.md is updated if explicitly requested or already present.
  if (
    platforms.includes('agents') ||
    platforms.includes('cursor') ||
    platforms.includes('copilot') ||
    platforms.includes('gemini') ||
    existsSync(join(CWD, 'AGENTS.md'))
  ) {
    generateRootAgentsMd();
    console.log('  - updated root AGENTS.md (bounded GSDD block)');
    updated = true;
  }

  if (!updated) {
    console.log('  - no adapters found to update (run `gsdd init` first)');
  } else {
    console.log('\nAdapters updated.\n');
  }
}

function cmdFindPhase(...args) {
  const phaseNum = args[0];

  if (!existsSync(PLANNING_DIR)) {
    output({ error: 'No .planning/ directory found. Run `gsdd init` then the new-project workflow first.' });
    return;
  }

  const roadmapPath = join(PLANNING_DIR, 'ROADMAP.md');
  if (!existsSync(roadmapPath)) {
    output({ error: 'No ROADMAP.md found. Run the new-project workflow first.' });
    return;
  }

  const phasesDir = join(PLANNING_DIR, 'phases');
  const researchDir = join(PLANNING_DIR, 'research');

  if (phaseNum) {
    const plans = findFiles(phasesDir, `${padPhase(phaseNum)}-PLAN`);
    const summaries = findFiles(phasesDir, `${padPhase(phaseNum)}-SUMMARY`);

    output({
      phase: parseInt(phaseNum, 10),
      directory: phasesDir,
      plans,
      summaries,
      hasResearch: existsSync(researchDir) && readdirSync(researchDir).length > 0,
      incomplete: plans.filter((p) => !summaries.some((s) => s.replace('SUMMARY', '') === p.replace('PLAN', ''))),
    });
    return;
  }

  const allFiles = existsSync(phasesDir) ? readdirSync(phasesDir) : [];
  const plans = allFiles.filter((f) => f.includes('PLAN'));
  const summaries = allFiles.filter((f) => f.includes('SUMMARY'));

  const roadmap = readFileSync(roadmapPath, 'utf-8');
  const phases = parsePhaseStatuses(roadmap);

  output({
    phases,
    planCount: plans.length,
    summaryCount: summaries.length,
    currentPhase: phases.find((p) => p.status === 'in_progress') || phases.find((p) => p.status === 'not_started') || null,
    hasResearch: existsSync(researchDir) && readdirSync(researchDir).length > 0,
  });
}

function cmdVerify(...args) {
  const phaseNum = args[0];
  if (!phaseNum) {
    console.error('Usage: gsdd verify <phase-number>');
    process.exit(1);
  }

  if (!existsSync(PLANNING_DIR)) {
    console.error('No .planning/ directory found.');
    process.exit(1);
  }

  const planFile = findFiles(join(PLANNING_DIR, 'phases'), `${padPhase(phaseNum)}-PLAN`)[0];
  if (!planFile) {
    console.error(`No plan found for phase ${phaseNum}`);
    process.exit(1);
  }

  const planPath = join(PLANNING_DIR, 'phases', planFile);
  const plan = readFileSync(planPath, 'utf-8');

  const fileMatches = plan.matchAll(/<files>([\s\S]*?)<\/files>/g);
  const expectedFiles = [];
  for (const match of fileMatches) {
    const lines = match[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-'));
    for (const line of lines) {
      const fileMatch = line.match(/(?:CREATE|MODIFY):\s*(.+)/);
      if (fileMatch) expectedFiles.push(fileMatch[1].trim());
    }
  }

  const results = expectedFiles.map((f) => {
    const fullPath = join(CWD, f);
    const exists = existsSync(fullPath);
    let substantive = false;
    if (exists) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        substantive = content.trim().length > 50 && !content.includes('// TODO: implement');
      } catch {
        substantive = false;
      }
    }
    return { file: f, exists, substantive };
  });

  const antiPatterns = [];
  for (const r of results) {
    if (!r.exists) continue;
    try {
      const content = readFileSync(join(CWD, r.file), 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/TODO|FIXME|HACK|XXX/.test(line)) {
          antiPatterns.push({ file: r.file, line: i + 1, pattern: 'TODO/FIXME', content: line.trim() });
        }
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
          antiPatterns.push({ file: r.file, line: i + 1, pattern: 'Empty catch', content: line.trim() });
        }
      });
    } catch {
      // skip unreadable files
    }
  }

  output({
    phase: parseInt(phaseNum, 10),
    artifacts: results,
    allExist: results.every((r) => r.exists),
    allSubstantive: results.filter((r) => r.exists).every((r) => r.substantive),
    antiPatterns,
    antiPatternCount: antiPatterns.length,
  });
}

function cmdScaffold(...args) {
  const [type, ...rest] = args;

  if (type !== 'phase') {
    console.error('Usage: gsdd scaffold phase <number> [name]');
    process.exit(1);
  }

  const phaseNum = rest[0];
  const phaseName = rest.slice(1).join(' ');
  if (!phaseNum) {
    console.error('Usage: gsdd scaffold phase <number> [name]');
    process.exit(1);
  }

  const phasesDir = join(PLANNING_DIR, 'phases');
  mkdirSync(phasesDir, { recursive: true });

  const planFile = join(phasesDir, `${padPhase(phaseNum)}-PLAN.md`);
  if (existsSync(planFile)) {
    console.log(`  - ${basename(planFile)} already exists`);
    return;
  }

  const content = `# Phase ${phaseNum}: ${phaseName || '[Name]'} - Plan

## Phase Goal
[From ROADMAP.md]

## Requirements Covered
[REQ-IDs from SPEC.md]

## Approach
[2-3 sentences]

## Must-Haves (from success criteria)
1. [Success criterion]

## Tasks

<!-- Add tasks using XML format:
<task id="${phaseNum}-01">
  <files>
    - CREATE: path/to/file
  </files>
  <action>Description of what to implement</action>
  <verify>How to verify it works</verify>
  <done>When is this task done</done>
</task>
-->

## Notes
`;

  writeFileSync(planFile, content);
  console.log(`  - created ${basename(planFile)}`);
}

function cmdHelp() {
  console.log(`
gsdd - GSD Distilled CLI
Spec-Driven Development for AI coding agents.

Usage: gsdd <command> [args]

Commands:
  init [--tools <platform>]   Set up SDD + generate adapters
  update [--tools <platform>] Regenerate adapters from latest framework sources
  find-phase [N]              Show phase info as JSON (for agent consumption)
  verify <N>                  Run artifact checks for phase N
  scaffold phase <N> [name]   Create a new phase plan file

Platforms (for --tools):
  claude    Generate Claude Code skills (.claude/skills/gsdd-*)
  opencode  Generate OpenCode local slash commands (.opencode/commands/gsdd-*.md)
  codex     Generate Codex CLI adapter (.codex/AGENTS.md)
  agents    Generate/Update root AGENTS.md (bounded GSDD block)
  cursor    Same as 'agents'
  copilot   Same as 'agents'
  gemini    Same as 'agents'
  all       Generate all adapters

Notes:
  - init always generates open-standard skills at .agents/skills/gsdd-* (portable workflow entrypoints)
  - root AGENTS.md is only written on init when explicitly requested via --tools agents (or all)

Examples:
  npx gsdd init
  npx gsdd init --tools claude
  npx gsdd init --tools agents
  npx gsdd init --tools all
  npx gsdd update
  npx gsdd find-phase
  npx gsdd verify 1
  npx gsdd scaffold phase 4 Payments
`);
}

function detectPlatforms() {
  const platforms = [];
  if (existsSync(join(CWD, 'CLAUDE.md')) || existsSync(join(CWD, '.claude'))) platforms.push('claude');
  if (existsSync(join(CWD, '.opencode'))) platforms.push('opencode');
  if (existsSync(join(CWD, '.codex'))) platforms.push('codex');
  return [...new Set(platforms)];
}

function parseToolsFlag(flagArgs) {
  const idx = flagArgs.indexOf('--tools');
  if (idx === -1) return [];
  const value = flagArgs[idx + 1];
  if (!value) return [];
  if (value === 'all') return ['claude', 'opencode', 'codex', 'agents'];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function renderSkillContent(w) {
  const workflowContent = getWorkflowContent(w.workflow);
  return `---
name: ${w.name}
description: ${w.description}
context: fork
agent: ${w.agent}
---

${workflowContent}`;
}

function generateOpenStandardSkills() {
  for (const w of WORKFLOWS) {
    const dir = join(CWD, '.agents', 'skills', w.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), renderSkillContent(w));
  }
}

function generateClaudeSkills() {
  for (const w of WORKFLOWS) {
    const dir = join(CWD, '.claude', 'skills', w.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), renderSkillContent(w));
  }
}

function generateOpenCodeSkills() {
  const opencodeDir = join(CWD, '.opencode', 'commands');
  mkdirSync(opencodeDir, { recursive: true });

  for (const w of WORKFLOWS) {
    const workflowContent = getWorkflowContent(w.workflow);
    const skillContent = `---
description: ${w.description}
---

${workflowContent}`;
    writeFileSync(join(opencodeDir, `${w.name}.md`), skillContent);
  }
}

function generateCodexConfig() {
  const codexDir = join(CWD, '.codex');
  mkdirSync(codexDir, { recursive: true });
  writeFileSync(join(codexDir, 'AGENTS.md'), renderAgentsFileContent());
}

function generateRootAgentsMd() {
  const agentsPath = join(CWD, 'AGENTS.md');
  const block = renderAgentsBoundedBlock();

  if (!existsSync(agentsPath)) {
    writeFileSync(agentsPath, renderAgentsFileContent());
    return;
  }

  const existing = readFileSync(agentsPath, 'utf-8');
  const updated = upsertBoundedBlock(existing, block);
  writeFileSync(agentsPath, updated);
}

function getWorkflowContent(workflowFile) {
  const filePath = join(DISTILLED_DIR, 'workflows', workflowFile);
  if (existsSync(filePath)) return readFileSync(filePath, 'utf-8');
  return `<!-- Workflow file not found: ${workflowFile} -->\n`;
}

function renderAgentsBoundedBlock() {
  const blockPath = join(DISTILLED_DIR, 'templates', 'agents.block.md');
  if (existsSync(blockPath)) return readFileSync(blockPath, 'utf-8').trim();
  return '## GSDD Governance (Generated)\n\n- Framework: GSDD\n- Planning: .planning/\n- Workflows: .agents/skills/gsdd-*/SKILL.md';
}

function renderAgentsFileContent() {
  const templatePath = join(DISTILLED_DIR, 'templates', 'agents.md');
  if (existsSync(templatePath)) {
    const tpl = readFileSync(templatePath, 'utf-8');
    return tpl.replace('{{GSDD_BLOCK}}', renderAgentsBoundedBlock()).trimEnd() + '\n';
  }
  const block = renderAgentsBoundedBlock();
  return `# AGENTS.md - GSDD Governance\n\n<!-- BEGIN GSDD -->\n${block}\n<!-- END GSDD -->\n`;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertBoundedBlock(existing, blockContent) {
  const begin = '<!-- BEGIN GSDD -->';
  const end = '<!-- END GSDD -->';
  const bounded = `${begin}\n${blockContent.trimEnd()}\n${end}`;

  const re = new RegExp(`${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}`, 'm');
  if (re.test(existing)) return existing.replace(re, bounded);

  const lines = existing.split(/\r?\n/);
  const h1Idx = lines.findIndex((l) => /^#\s+/.test(l));
  if (h1Idx !== -1) {
    const insertAt = h1Idx + 1;
    const out = [
      ...lines.slice(0, insertAt),
      '',
      bounded,
      '',
      ...lines.slice(insertAt),
    ];
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  return `${bounded}\n\n${existing}`.replace(/\n{3,}/g, '\n\n');
}

function findFiles(dir, prefix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.startsWith(prefix) || f.startsWith(prefix.replace(/^0+/, '')));
}

function padPhase(n) {
  return String(n).padStart(2, '0');
}

function parsePhaseStatuses(roadmap) {
  const phases = [];
  const lines = roadmap.split('\n');
  for (const line of lines) {
    // Supports:
    // - checkbox statuses: [ ] / [x]
    // - legacy emoji markers in ROADMAP templates: not started / in progress / done
    // - mojibake-encoded variants that exist in some files
    const match = line.match(
      /^[-*]\s*(\[[ x]\]|\[-\]|â¬œ|ðŸ”„|âœ…|⬜|🔄|✅)\s*\*\*Phase\s+(\d+):\s*(.+?)\*\*/i
    );
    if (match) {
      const rawStatus = match[1].toLowerCase();
      let status = 'not_started';
      if (rawStatus === '[x]' || rawStatus === 'âœ…' || rawStatus === '✅') status = 'done';
      else if (rawStatus === '[-]') status = 'in_progress';
      else if (rawStatus === 'ðÿ”„' || rawStatus === '🔄') status = 'in_progress';
      phases.push({
        number: parseInt(match[2], 10),
        name: match[3].replace(/\*\*/g, '').split('-')[0].trim(),
        status,
      });
    }
  }
  return phases;
}

function output(data) {
  console.log(JSON.stringify(data, null, 2));
}
