#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

const pkg = require('../package.json');
const NPM_PACKAGE = pkg.name;
const NPM_PACKAGE_LATEST = `${NPM_PACKAGE}@latest`;
const UPSTREAM_PACKAGE = 'get-shit-done-cc';
const UPSTREAM_REPO = 'https://github.com/glittercowboy/get-shit-done';
const FORK_REPO = 'https://github.com/undeemed/get-shit-done-codex';

const banner = `
${green}   ██████╗ ███████╗██████╗
   ██╔════╝ ██╔════╝██╔══██╗
   ██║  ███╗███████╗██║  ██║
   ██║   ██║╚════██║██║  ██║
   ╚██████╔╝███████║██████╔╝
    ╚═════╝ ╚══════╝╚═════╝${reset}

   Get Shit Done ${dim}v${pkg.version}${reset}
   A meta-prompting, context engineering, and spec-driven
   development system for OpenAI Codex (CLI + Desktop).
`;

const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasHelp = args.includes('--help') || args.includes('-h');
const hasVerify = args.includes('--verify');
const hasRepair = args.includes('--repair');
const hasNoVersionCheck = args.includes('--no-version-check') || process.env.GSD_SKIP_VERSION_CHECK === '1';
const hasMigrate = args.includes('--migrate');
const hasSkipMigrate = args.includes('--skip-migrate') || args.includes('--no-migrate');
const isInteractiveTerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const CODEX_MODES = new Set(['prompts', 'skills']);
const hasCodexModeArg = args.some((arg) =>
  arg.startsWith('--codex-mode=') || arg === '--codex-mode' || arg === '-m'
);

function parseCodexModeArg(argv) {
  const explicit = argv.find((arg) => arg.startsWith('--codex-mode='));
  const flagIndex = argv.findIndex((arg) => arg === '--codex-mode' || arg === '-m');
  let mode = 'skills';

  if (explicit) {
    mode = explicit.split('=')[1] || '';
  }

  if (flagIndex !== -1) {
    const next = argv[flagIndex + 1];
    if (!next || next.startsWith('-')) {
      console.error(`  ${yellow}--codex-mode requires one of: prompts, skills${reset}`);
      process.exit(1);
    }
    mode = next;
  }

  mode = String(mode).toLowerCase().trim();
  if (!CODEX_MODES.has(mode)) {
    console.error(`  ${yellow}Invalid --codex-mode '${mode}'. Expected prompts or skills.${reset}`);
    process.exit(1);
  }

  return mode;
}

const codexMode = hasHelp ? 'skills' : parseCodexModeArg(args);

console.log(banner);

if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx ${NPM_PACKAGE} [options]

  ${yellow}Options:${reset}
    ${cyan}-g, --global${reset}              Install globally (to ~/.codex/)
    ${cyan}-l, --local${reset}               Install locally (to current directory)
    ${cyan}-m, --codex-mode <mode>${reset}   Command mode: skills or prompts
    ${cyan}--migrate${reset}                 Apply detected legacy surface cleanup without prompting
    ${cyan}--skip-migrate${reset}            Keep legacy surface files when migration is detected
    ${cyan}--verify${reset}                  Verify current install integrity
    ${cyan}--repair${reset}                  Repair failed verification checks
    ${cyan}--no-version-check${reset}        Skip npm version lookup
    ${cyan}-h, --help${reset}                Show this help message

  ${yellow}Examples:${reset}
    ${dim}# Install globally${reset}
    npx ${NPM_PACKAGE} --global

    ${dim}# Install to current project only${reset}
    npx ${NPM_PACKAGE} --local

    ${dim}# Install native Codex skills only${reset}
    npx ${NPM_PACKAGE} --global --codex-mode skills

    ${dim}# Install prompt aliases only${reset}
    npx ${NPM_PACKAGE} --global --codex-mode prompts

    ${dim}# Verify global installation${reset}
    npx ${NPM_PACKAGE} --verify --global

    ${dim}# Verify and auto-repair local installation${reset}
    npx ${NPM_PACKAGE} --verify --repair --local

    ${dim}# Force migration cleanup in non-interactive runs${reset}
    npx ${NPM_PACKAGE} --global --migrate

  ${yellow}Notes:${reset}
    - Installs AGENTS.md into the target directory
    - If --codex-mode is omitted in interactive mode, installer prompts to choose
    - Non-interactive runs default to skills mode
    - If legacy surface files are detected, installer asks before removing them
    - Installs get-shit-done/ workflow files
`);
  process.exit(0);
}

function applyPathPrefixReplacements(content, pathPrefix) {
  if (pathPrefix === '~/.codex/') {
    return content
      .replace(/\.\/\.codex\//g, '~/.codex/')
      .replace(/~\/\.codex\//g, '~/.codex/');
  }

  return content
    .replace(/\.\/\.codex\//g, pathPrefix)
    .replace(/~\/\.codex\//g, pathPrefix);
}

function applyReplacements(content, pathPrefix) {
  content = applyPathPrefixReplacements(content, pathPrefix);

  content = content.replace(/Codex CLI/g, 'Codex CLI');
  content = content.replace(/Codex/g, 'Codex');

  content = content.replace(/\/gsd:/g, '/prompts:gsd-');

  // Keep update workflows pointed to this fork's npm package/repo.
  content = content.replace(new RegExp(UPSTREAM_PACKAGE, 'g'), NPM_PACKAGE);
  content = content.replace(new RegExp(UPSTREAM_REPO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), FORK_REPO);
  content = content.replace(/npmjs\.com\/package\/get-shit-done-cc/g, `npmjs.com/package/${encodeURIComponent(NPM_PACKAGE)}`);

  return content;
}

function convertPromptRefsToSkillRefs(content) {
  let converted = content.replace(/\/prompts:gsd-([a-z0-9-]+)/gi, (_, commandName) => `$gsd-${String(commandName).toLowerCase()}`);
  converted = converted.replace(/\/gsd:([a-z0-9-]+)/gi, (_, commandName) => `$gsd-${String(commandName).toLowerCase()}`);
  converted = converted.replace(/\/gsd-help\b/gi, '$gsd-help');
  return converted;
}

function convertSkillRefsToPromptRefs(content) {
  return content.replace(/\$gsd-([a-z0-9-]+)/gi, (_, commandName) => `/prompts:gsd-${String(commandName).toLowerCase()}`);
}

function convertCommandRefsToSkillMentions(content) {
  return convertPromptRefsToSkillRefs(content).replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
}

function rewriteAgentInvocationLine(content, replacement) {
  return content
    .replace('Invoke them with `/gsd:command-name`:', replacement)
    .replace('Invoke them with `/prompts:gsd-command-name`:', replacement)
    .replace('Invoke them with `$gsd-command-name`:', replacement);
}

function adaptAgentsForCodexMode(content, mode) {
  if (mode === 'skills') {
    let adapted = convertPromptRefsToSkillRefs(content);
    adapted = rewriteAgentInvocationLine(adapted, 'Invoke them with `$gsd-command-name`:');
    return adapted;
  }

  if (mode === 'prompts') {
    let adapted = convertSkillRefsToPromptRefs(content);
    adapted = rewriteAgentInvocationLine(adapted, 'Invoke them with `/prompts:gsd-command-name`:');
    return adapted;
  }

  return content;
}

function extractFrontmatterAndBody(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: null, body: content };
  }
  return { frontmatter: match[1], body: content.slice(match[0].length) };
}

function extractFrontmatterField(frontmatter, fieldName) {
  if (!frontmatter) return null;
  const match = frontmatter.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'mi'));
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function toSingleLine(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function getCodexSkillAdapterHeader(skillName) {
  return `<codex_skill_adapter>
Codex native skill mode:
- AGENTS-first: treat AGENTS.md as the persistent source of truth for behavior and constraints.
- Invoke this workflow with \`$${skillName}\`.
- Treat user text after \`$${skillName}\` as \`{{GSD_ARGS}}\` (empty when omitted).
- Any legacy \`Task(...)\` notation in referenced docs means "spawn a specialized subagent" in Codex.
</codex_skill_adapter>`;
}

function convertCommandToCodexSkill(commandContent, skillName, pathPrefix) {
  const replaced = applyReplacements(commandContent, pathPrefix);
  const converted = convertCommandRefsToSkillMentions(replaced);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  const description = toSingleLine(
    extractFrontmatterField(frontmatter, 'description') || `Run GSD workflow ${skillName}.`
  );
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;

  return `---
name: ${yamlQuote(skillName)}
description: ${yamlQuote(description)}
metadata:
  short-description: ${yamlQuote(shortDescription)}
---

${getCodexSkillAdapterHeader(skillName)}

${body.trimStart()}`;
}

function installPrompts(commandsDir, promptsDir, markdownEntries, pathPrefix) {
  fs.mkdirSync(promptsDir, { recursive: true });
  for (const entry of markdownEntries) {
    const srcPath = path.join(commandsDir, entry);
    const destPath = path.join(promptsDir, `gsd-${entry}`);
    const content = applyReplacements(fs.readFileSync(srcPath, 'utf8'), pathPrefix);
    fs.writeFileSync(destPath, content, 'utf8');
  }
}

function installCodexSkills(commandsDir, skillsDir, markdownEntries, pathPrefix) {
  fs.mkdirSync(skillsDir, { recursive: true });

  const existingSkills = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existingSkills) {
    if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true, force: true });
    }
  }

  for (const entry of markdownEntries) {
    const commandPath = path.join(commandsDir, entry);
    const commandContent = fs.readFileSync(commandPath, 'utf8');
    const commandName = entry.replace(/\.md$/i, '');
    const skillName = `gsd-${commandName}`;
    const skillDir = path.join(skillsDir, skillName);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      convertCommandToCodexSkill(commandContent, skillName, pathPrefix),
      'utf8'
    );
  }
}

function removePromptAliases(promptsDir) {
  if (!fs.existsSync(promptsDir)) return 0;
  const entries = fs.readdirSync(promptsDir);
  let removed = 0;
  for (const entry of entries) {
    if (/^gsd-.*\.md$/i.test(entry)) {
      fs.rmSync(path.join(promptsDir, entry), { force: true });
      removed++;
    }
  }
  return removed;
}

function removeSkillAliases(skillsDir) {
  if (!fs.existsSync(skillsDir)) return 0;
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}

function detectMigrationPlan(codexDir, mode) {
  const promptsDir = path.join(codexDir, 'prompts');
  const skillsDir = path.join(codexDir, 'skills');
  const promptFiles = listPromptCommandFiles(promptsDir);
  const skillNames = listSkillNames(skillsDir);

  const promptCountToRemove = mode === 'skills' ? promptFiles.length : 0;
  const skillCountToRemove = mode === 'prompts' ? skillNames.length : 0;

  return {
    mode,
    promptsDir,
    skillsDir,
    promptCountToRemove,
    skillCountToRemove,
    hasChanges: promptCountToRemove > 0 || skillCountToRemove > 0,
  };
}

function describeMigrationPlan(plan) {
  const items = [];
  if (plan.promptCountToRemove > 0) {
    items.push(`${plan.promptCountToRemove} legacy prompt alias file(s) in prompts/`);
  }
  if (plan.skillCountToRemove > 0) {
    items.push(`${plan.skillCountToRemove} legacy skill director${plan.skillCountToRemove === 1 ? 'y' : 'ies'} in skills/`);
  }
  return items.join(' and ');
}

function applyMigrationPlan(plan) {
  let removedPrompts = 0;
  let removedSkills = 0;

  if (plan.promptCountToRemove > 0) {
    removedPrompts = removePromptAliases(plan.promptsDir);
  }
  if (plan.skillCountToRemove > 0) {
    removedSkills = removeSkillAliases(plan.skillsDir);
  }

  if (removedPrompts > 0 || removedSkills > 0) {
    const changes = [];
    if (removedPrompts > 0) changes.push(`${removedPrompts} prompt alias file(s)`);
    if (removedSkills > 0) changes.push(`${removedSkills} skill director${removedSkills === 1 ? 'y' : 'ies'}`);
    console.log(`  ${green}✓${reset} Migration applied: removed ${changes.join(', ')}`);
  }
}

function copyWithPathReplacement(srcDir, destDir, pathPrefix) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix);
      continue;
    }

    if (entry.name.endsWith('.md')) {
      const content = fs.readFileSync(srcPath, 'utf8');
      fs.writeFileSync(destPath, applyReplacements(content, pathPrefix), 'utf8');
      continue;
    }

    fs.copyFileSync(srcPath, destPath);
  }
}

function writeVersionFile(destDir, isGlobal) {
  const versionFile = path.join(destDir, 'VERSION');
  const installType = isGlobal ? 'GLOBAL' : 'LOCAL';
  fs.writeFileSync(versionFile, `${pkg.version}\n${installType}\n`, 'utf8');
}

function showCachedVersionWarning() {
  try {
    const latest = execSync(`npm view ${NPM_PACKAGE} version`, {
      encoding: 'utf8',
      timeout: 4000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (latest && latest !== pkg.version) {
      console.log(`  ${yellow}Update available:${reset} v${pkg.version} -> v${latest}`);
      console.log(`  Run ${cyan}npx ${NPM_PACKAGE_LATEST}${reset} to install the latest release.\n`);
    }
  } catch (_) {
    // Offline or npm unavailable - skip.
  }
}

function getInstallContext(isGlobal) {
  const codexDir = isGlobal ? path.join(os.homedir(), '.codex') : process.cwd();
  return {
    codexDir,
    locationLabel: isGlobal ? '~/.codex' : '.',
    pathPrefix: isGlobal ? '~/.codex/' : './',
  };
}

function listPromptCommandFiles(promptsDir) {
  if (!fs.existsSync(promptsDir)) return [];
  return fs.readdirSync(promptsDir)
    .filter((name) => /^gsd-.*\.md$/i.test(name))
    .sort();
}

function listSkillNames(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('gsd-'))
    .filter((entry) => fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
}

function detectInstalledMode(promptCount, skillCount) {
  if (promptCount > 0 && skillCount > 0) return 'mixed';
  if (promptCount > 0) return 'prompts';
  if (skillCount > 0) return 'skills';
  return 'none';
}

function verifyInstall(isGlobal, expectedMode, strictMode = false) {
  const src = path.join(__dirname, '..');
  const { codexDir, locationLabel } = getInstallContext(isGlobal);
  const promptsDir = path.join(codexDir, 'prompts');
  const skillsDir = path.join(codexDir, 'skills');
  const workflowRoot = path.join(codexDir, 'get-shit-done');
  const versionFile = path.join(workflowRoot, 'VERSION');
  const expectedCount = fs.readdirSync(path.join(src, 'commands', 'gsd'))
    .filter((entry) => entry.endsWith('.md'))
    .length;

  const promptFiles = listPromptCommandFiles(promptsDir);
  const skillNames = listSkillNames(skillsDir);
  const detectedMode = detectInstalledMode(promptFiles.length, skillNames.length);
  const modeToCheck = strictMode ? expectedMode : (detectedMode === 'none' ? expectedMode : detectedMode);

  const checks = [];
  const addCheck = (ok, label, detail) => checks.push({ ok, label, detail });

  addCheck(fs.existsSync(codexDir), 'Config directory exists', codexDir);
  addCheck(fs.existsSync(path.join(codexDir, 'AGENTS.md')), 'AGENTS.md installed', path.join(codexDir, 'AGENTS.md'));
  addCheck(fs.existsSync(workflowRoot), 'get-shit-done assets installed', workflowRoot);
  addCheck(fs.existsSync(path.join(workflowRoot, 'workflows')), 'Workflow directory installed', path.join(workflowRoot, 'workflows'));
  addCheck(fs.existsSync(path.join(workflowRoot, 'templates')), 'Template directory installed', path.join(workflowRoot, 'templates'));
  addCheck(fs.existsSync(versionFile), 'VERSION file installed', versionFile);

  if (fs.existsSync(versionFile)) {
    const version = fs.readFileSync(versionFile, 'utf8').split(/\r?\n/)[0].trim();
    addCheck(version === pkg.version, 'VERSION matches installer package', `${version || '(empty)'} vs ${pkg.version}`);
  }

  if (modeToCheck === 'prompts') {
    addCheck(promptFiles.length === expectedCount, 'Prompt aliases complete', `${promptFiles.length}/${expectedCount}`);
  }
  if (modeToCheck === 'skills') {
    addCheck(skillNames.length === expectedCount, 'Native skills complete', `${skillNames.length}/${expectedCount}`);
  }
  if (modeToCheck === 'mixed') {
    addCheck(
      false,
      'Single command surface required',
      'Both skills and prompt aliases found. Choose one mode and run install with --migrate.'
    );
  }
  if (modeToCheck === 'none') {
    addCheck(false, 'At least one command surface installed', 'No skills/ or prompts/ entries found');
  }

  console.log(`  Verifying ${cyan}${locationLabel}${reset} (detected mode: ${cyan}${detectedMode}${reset}, check mode: ${cyan}${modeToCheck}${reset})`);
  for (const check of checks) {
    const icon = check.ok ? `${green}✓${reset}` : `${yellow}✗${reset}`;
    const detail = check.detail ? ` ${dim}(${check.detail})${reset}` : '';
    console.log(`  ${icon} ${check.label}${detail}`);
  }

  const ok = checks.every((check) => check.ok);
  if (ok) {
    console.log(`\n  ${green}Integrity check passed.${reset}`);
  } else {
    console.log(`\n  ${yellow}Integrity check failed.${reset}`);
  }

  return { ok, detectedMode, checkedMode: modeToCheck };
}

function installCore(isGlobal, mode, migrationPlan, applyMigration) {
  const src = path.join(__dirname, '..');
  const { codexDir, locationLabel, pathPrefix } = getInstallContext(isGlobal);
  const installPromptsEnabled = mode === 'prompts';
  const installSkillsEnabled = mode === 'skills';

  console.log(`  Installing to ${cyan}${locationLabel}${reset}\n`);
  fs.mkdirSync(codexDir, { recursive: true });
  if (applyMigration && migrationPlan && migrationPlan.hasChanges) {
    applyMigrationPlan(migrationPlan);
  }

  const agentsSrc = path.join(src, 'AGENTS.md');
  const agentsDest = path.join(codexDir, 'AGENTS.md');
  let agentsContent = applyReplacements(fs.readFileSync(agentsSrc, 'utf8'), pathPrefix);
  agentsContent = adaptAgentsForCodexMode(agentsContent, mode);
  fs.writeFileSync(agentsDest, agentsContent, 'utf8');
  console.log(`  ${green}✓${reset} Installed AGENTS.md`);

  const gsdSrc = path.join(src, 'commands', 'gsd');
  const entries = fs.readdirSync(gsdSrc);
  const markdownEntries = entries.filter((entry) => entry.endsWith('.md'));

  if (installPromptsEnabled) {
    const promptsDir = path.join(codexDir, 'prompts');
    installPrompts(gsdSrc, promptsDir, markdownEntries, pathPrefix);
    console.log(`  ${green}✓${reset} Installed prompts/gsd-*.md (${markdownEntries.length} commands)`);
  }

  if (installSkillsEnabled) {
    const skillsDir = path.join(codexDir, 'skills');
    installCodexSkills(gsdSrc, skillsDir, markdownEntries, pathPrefix);
    console.log(`  ${green}✓${reset} Installed skills/gsd-*/SKILL.md (${markdownEntries.length} skills)`);
  }

  const skillSrc = path.join(src, 'get-shit-done');
  const skillDest = path.join(codexDir, 'get-shit-done');
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix);
  writeVersionFile(skillDest, isGlobal);
  console.log(`  ${green}✓${reset} Installed get-shit-done/ workflow files`);
  console.log(`  ${green}✓${reset} Wrote get-shit-done/VERSION (${pkg.version})`);

  console.log(`
  ${green}Done!${reset}

  ${yellow}For Codex (CLI + Desktop):${reset}
  - AGENTS.md: ${cyan}${codexDir}/AGENTS.md${reset}
  ${installPromptsEnabled ? `- Prompt commands: ${cyan}${codexDir}/prompts/${reset}` : ''}
  ${installSkillsEnabled ? `- Native skills: ${cyan}${codexDir}/skills/gsd-*/SKILL.md${reset}` : ''}

  ${yellow}Getting Started:${reset}
  1. Run ${cyan}codex${reset} (CLI) or ${cyan}codex app${reset} (Desktop)
  2. Use ${cyan}${installSkillsEnabled ? '$gsd-help' : '/prompts:gsd-help'}${reset} to list commands
  3. Start with ${cyan}${installSkillsEnabled ? '$gsd-new-project' : '/prompts:gsd-new-project'}${reset}

  ${yellow}Staying Updated:${reset}
  - In Codex: ${cyan}${installSkillsEnabled ? '$gsd-update' : '/prompts:gsd-update'}${reset}
  - In terminal: ${cyan}npx ${NPM_PACKAGE_LATEST}${reset}
`);
}

function install(isGlobal, mode = codexMode, done = () => {}) {
  const { codexDir } = getInstallContext(isGlobal);
  const migrationPlan = detectMigrationPlan(codexDir, mode);

  if (!migrationPlan.hasChanges) {
    installCore(isGlobal, mode, migrationPlan, false);
    done();
    return;
  }

  const summary = describeMigrationPlan(migrationPlan);
  console.log(`  ${yellow}Migration detected:${reset} ${summary}`);

  if (hasMigrate) {
    console.log(`  ${green}✓${reset} Migration approved by --migrate`);
    installCore(isGlobal, mode, migrationPlan, true);
    done();
    return;
  }

  if (hasSkipMigrate) {
    console.log(`  ${yellow}Skipping migration due to --skip-migrate.${reset}`);
    installCore(isGlobal, mode, migrationPlan, false);
    done();
    return;
  }

  if (!isInteractiveTerminal) {
    console.log(`  ${yellow}Skipping migration in non-interactive mode.${reset}`);
    console.log(`  ${dim}Re-run with --migrate to apply cleanup or --skip-migrate to keep legacy files explicitly.${reset}`);
    installCore(isGlobal, mode, migrationPlan, false);
    done();
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`  Remove legacy files now? ${dim}[Y/n]${reset}: `, (answer) => {
    rl.close();
    const normalized = answer.trim().toLowerCase();
    const applyMigration = normalized === '' || normalized === 'y' || normalized === 'yes';
    if (!applyMigration) {
      console.log(`  ${yellow}Keeping legacy files.${reset}`);
    }
    installCore(isGlobal, mode, migrationPlan, applyMigration);
    done();
  });
}

function promptCodexMode(done) {
  if (hasCodexModeArg || !isInteractiveTerminal) {
    done(codexMode);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`  ${yellow}Which command surface do you want?${reset}

  ${cyan}1${reset}) Skills  ${dim}($gsd-*, recommended)${reset}
  ${cyan}2${reset}) Prompts ${dim}(/prompts:gsd-*)${reset}
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const normalized = answer.trim().toLowerCase();
    const mode = normalized === '2' || normalized === 'prompt' || normalized === 'prompts'
      ? 'prompts'
      : 'skills';
    done(mode);
  });
}

function promptLocation(done) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`  ${yellow}Where would you like to install?${reset}

  ${cyan}1${reset}) Global ${dim}(~/.codex)${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(.)${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    done(choice !== '2');
  });
}

if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
}

if (hasRepair && !hasVerify) {
  console.error(`  ${yellow}--repair requires --verify${reset}`);
  process.exit(1);
}

if (hasMigrate && hasSkipMigrate) {
  console.error(`  ${yellow}Cannot combine --migrate and --skip-migrate${reset}`);
  process.exit(1);
}

if (!hasNoVersionCheck && !hasVerify) {
  showCachedVersionWarning();
}

if (hasVerify) {
  const isGlobal = hasLocal ? false : true;
  const strictMode = hasCodexModeArg;
  let result = verifyInstall(isGlobal, codexMode, strictMode);

  if (!result.ok && hasRepair) {
    const repairMode = codexMode;
    console.log(`\n  ${yellow}Repairing install using mode '${repairMode}'...${reset}\n`);
    install(isGlobal, repairMode, () => {
      console.log('');
      const repaired = verifyInstall(isGlobal, repairMode, true);
      process.exit(repaired.ok ? 0 : 1);
    });
  } else {
    process.exit(result.ok ? 0 : 1);
  }
} else {
  const installWithSelectedMode = (isGlobal) => {
    promptCodexMode((selectedMode) => {
      install(isGlobal, selectedMode);
    });
  };

  if (hasGlobal) {
    installWithSelectedMode(true);
  } else if (hasLocal) {
    installWithSelectedMode(false);
  } else {
    promptLocation(installWithSelectedMode);
  }
}
