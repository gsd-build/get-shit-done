// scripts/verify-prompts.mjs
// Multi-check verifier for the GSD → Copilot prompt compatibility layer.
// Checks: VER-01 (coverage), VER-02 (tool accuracy), VER-03 (structural integrity),
//         VER-04 (staleness — added in Plan 04-03), VER-05 (threshold warning)
// Zero external dependencies.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runPipeline, loadToolMap as loadToolMapGen } from './generate-prompts.mjs';

const ROOT = process.cwd();
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');
const OUT_DIR = path.join(ROOT, '.github', 'prompts');
const TOOLS_JSON_PATH = path.join(ROOT, 'scripts', 'tools.json');
const MIN_COMMAND_COUNT = 20;
const VERBOSE = process.argv.includes('--verbose');

// ─── Color helpers (TTY-guarded) ─────────────────────────────────────────────
const USE_COLOR = !!process.stdout.isTTY;
const c = {
  red:    s => USE_COLOR ? `\x1b[31m${s}\x1b[0m` : s,
  yellow: s => USE_COLOR ? `\x1b[33m${s}\x1b[0m` : s,
  green:  s => USE_COLOR ? `\x1b[32m${s}\x1b[0m` : s,
  bold:   s => USE_COLOR ? `\x1b[1m${s}\x1b[0m`  : s,
};

// ─── Error/warning collectors ────────────────────────────────────────────────
const errors = [];
const warnings = [];

function addError(checkType, file, message) {
  errors.push({ checkType, file, message });
}
function addWarning(checkType, file, message) {
  warnings.push({ checkType, file, message });
}

// ─── Grouped output ──────────────────────────────────────────────────────────
function printGrouped(items, headerFn) {
  const byType = {};
  for (const item of items) {
    (byType[item.checkType] ??= []).push(item);
  }
  for (const [checkType, group] of Object.entries(byType)) {
    console.log(headerFn(checkType, group.length));
    for (const { file, message } of group) {
      console.log(`  - ${file ? file + ': ' : ''}${message}`);
    }
  }
}

// ─── File listing helpers ────────────────────────────────────────────────────
function listUpstreamCommands() {
  if (!fs.existsSync(COMMANDS_DIR)) return [];
  return fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.md') && !f.endsWith('.bak'))
    .sort();
}

function listPromptFiles() {
  if (!fs.existsSync(OUT_DIR)) return new Set();
  return new Set(fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.prompt.md')));
}

function readPrompt(name) {
  const p = path.join(OUT_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

// ─── SHA-256 helper ──────────────────────────────────────────────────────────
function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// ─── Tool map loader (mirrors generator — zero-dep, no import) ───────────────
function loadToolMap() {
  if (!fs.existsSync(TOOLS_JSON_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(TOOLS_JSON_PATH, 'utf8')); }
  catch { return {}; }
}

// ─── Prompt parsing helpers ──────────────────────────────────────────────────
function parseUpstreamToolsComment(promptContent) {
  if (promptContent.includes('<!-- upstream-tools: null')) return null;
  const m = promptContent.match(/<!-- upstream-tools: (\[.*?\]) -->/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function parseToolsFrontmatter(promptContent) {
  const m = promptContent.match(/^tools:\s*\[([^\]]*)\]/m);
  if (!m || !m[1].trim()) return null;
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

function mapUpstreamTools(upstreamOriginals, toolMap) {
  if (!upstreamOriginals || upstreamOriginals.length === 0) return [];
  const result = new Set();
  for (const tool of upstreamOriginals) {
    // mcp__ prefixed tools pass through as-is (mirrors generator behavior)
    if (tool.toLowerCase().startsWith('mcp__')) {
      result.add(tool.toLowerCase());
      continue;
    }
    const key = Object.keys(toolMap).find(k => k.toLowerCase() === tool.toLowerCase());
    if (!key) continue;
    const mapped = toolMap[key];
    if (mapped === 'UNMAPPED') continue;
    result.add(mapped);
  }
  return [...result].sort();
}

// ─── Check functions ─────────────────────────────────────────────────────────

// VER-05: threshold warning
function checkThreshold(cmdFiles) {
  if (cmdFiles.length < MIN_COMMAND_COUNT) {
    addWarning('VER-05', '', `only ${cmdFiles.length} upstream commands found (minimum: ${MIN_COMMAND_COUNT}) — possible silent upstream refactor`);
  }
}

// VER-01: coverage
function checkCoverage(cmdFiles, promptFiles) {
  for (const cmd of cmdFiles) {
    const base = cmd.replace(/\.md$/, '');
    const expected = `gsd.${base}.prompt.md`;
    if (!promptFiles.has(expected)) {
      addError('VER-01', expected, 'missing — no generated prompt for this upstream command');
    }
  }
}

// VER-02: tool accuracy
function checkToolAccuracy(promptName, promptContent, toolMap) {
  const upstream = parseUpstreamToolsComment(promptContent);
  if (upstream === null) return; // no upstream tools declared — skip

  const expected = mapUpstreamTools(upstream, toolMap);
  const actual = parseToolsFrontmatter(promptContent) ?? [];
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();

  if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
    addError('VER-02', promptName,
      `tools mismatch — expected [${expectedSorted.join(', ')}] but found [${actualSorted.join(', ')}]`);
  }
}

// VER-03: structural integrity
function checkStructuralIntegrity(promptName, promptContent, upstreamSource) {
  if (!promptContent.includes('If the local GSD install does not exist')) {
    addError('VER-03', promptName, 'missing preflight block');
  }
  // Only flag missing <execution_context> if the upstream source has one.
  // Some upstream commands (e.g. debug.md, join-discord.md, reapply-patches.md,
  // research-phase.md) have no <execution_context> block — their generated
  // prompts correctly omit it, so flagging them would be a false positive.
  if (upstreamSource.includes('<execution_context>') && !promptContent.includes('<execution_context>')) {
    addError('VER-03', promptName, 'missing <execution_context> block');
  }
  // Adapter shim only required when vscode/askQuestions is in the tools list
  const tools = parseToolsFrontmatter(promptContent);
  if (tools !== null && tools.includes('vscode/askQuestions')) {
    if (!promptContent.includes('#tool:vscode/askQuestions')) {
      addError('VER-03', promptName, 'missing adapter shim (#tool:vscode/askQuestions) — required because vscode/askQuestions is in tools list');
    }
  }
}

// VER-04: staleness detection (warning only)
function checkStaleness(cmdFiles, promptFiles) {
  const genToolMap = loadToolMapGen();
  const pendingStubs = {};

  for (const cmd of cmdFiles) {
    const base = cmd.replace(/\.md$/, '');
    const promptName = `gsd.${base}.prompt.md`;
    if (!promptFiles.has(promptName)) continue; // missing — already VER-01 error

    const onDisk = readPrompt(promptName);
    if (!onDisk) continue;

    const cmdPath = path.join(COMMANDS_DIR, cmd);
    const source = fs.readFileSync(cmdPath, 'utf8');

    const ctx = runPipeline({
      source,
      cmdFile: cmdPath,
      toolMap: genToolMap,
      pendingStubs,
      allOmittedNames: new Set(),
      totalOmitted: 0,
    });

    if (ctx.skipWrite) continue; // generator would have skipped this file (fence error)

    // LF-normalize both sides before comparing to avoid false positives on Windows
    const expected = ctx.output.replace(/\r\n/g, '\n');
    const actual   = onDisk.replace(/\r\n/g, '\n');

    if (sha256(expected) !== sha256(actual)) {
      addWarning('VER-04', promptName, 'stale — content differs from what generator would produce today; run: node scripts/generate-prompts.mjs');
    }
  }
}

// ─── main() ──────────────────────────────────────────────────────────────────
async function main() {
  const cmdFiles = listUpstreamCommands();
  const promptFiles = listPromptFiles();

  // VER-05: threshold (warning)
  checkThreshold(cmdFiles);

  // VER-01: coverage (hard error)
  checkCoverage(cmdFiles, promptFiles);

  // VER-02 and VER-03: per-prompt checks
  const toolMap = loadToolMap();
  for (const cmd of cmdFiles) {
    const base = cmd.replace(/\.md$/, '');
    const promptName = `gsd.${base}.prompt.md`;
    if (!promptFiles.has(promptName)) continue; // already flagged by VER-01
    const content = readPrompt(promptName);
    if (!content) continue;
    const upstreamSource = fs.readFileSync(path.join(COMMANDS_DIR, cmd), 'utf8');
    checkToolAccuracy(promptName, content, toolMap);
    checkStructuralIntegrity(promptName, content, upstreamSource);
  }

  // VER-04: staleness (warning only)
  checkStaleness(cmdFiles, promptFiles);

  // ─── Reporting ──────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.log('');
    printGrouped(warnings, (type, n) => c.yellow(`[${type}] ${n} warning(s):`));
  }

  if (errors.length > 0) {
    console.log('');
    printGrouped(errors, (type, n) => c.red(`[${type}] ${n} error(s):`));
    const checkTypes = new Set(errors.map(e => e.checkType));
    console.log('');
    console.log(c.red(c.bold(`${errors.length} error(s) across ${checkTypes.size} check type(s)`)));
    process.exit(1);
  }

  const detail = VERBOSE
    ? cmdFiles.map(f => `  ✓ gsd.${f.replace(/\.md$/, '')}.prompt.md`).join('\n') + '\n'
    : '';
  if (detail) console.log(detail.trimEnd());
  console.log(c.green(`✓ All checks passed (${cmdFiles.length} prompts verified)`));
}

main().catch(e => { console.error(e); process.exit(1); });
