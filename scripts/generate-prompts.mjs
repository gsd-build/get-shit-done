// scripts/generate-prompts.mjs
// Generates .github/prompts/*.prompt.md from upstream commands/gsd/*.md
// No external deps. Minimal YAML frontmatter parsing.
// Adds: Preflight + Copilot Runtime Adapter shim (universal).
// Fixes: ~/.claude and /.claude path rewrites to workspace-local ./.claude.
//
// Determinism:
// - stable file ordering
// - stable formatting
// - overwrite outputs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const COMMANDS_DIR = path.join(ROOT, "commands", "gsd");
const OUT_DIR = path.join(ROOT, ".github", "prompts");

function readFile(p) {
  return fs.readFileSync(p, "utf8");
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.endsWith(".bak"))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => path.join(dir, f));
}

// extremely small frontmatter parser: expects leading --- block
function parseFrontmatter(md) {
  if (!md.startsWith("---")) return { data: {}, body: md };

  // Find closing delimiter on its own line
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: md };

  const fm = match[1].trim();
  const body = match[2].trimStart();

  const data = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)\s*$/);
    if (!m) continue;
    let [, k, v] = m;
    v = v.trim();

    // strip surrounding quotes if present
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }

    data[k] = v;
  }

  return { data, body };
}

/**
 * Extract the `allowed-tools` array from a markdown file's YAML frontmatter.
 *
 * @param {string} content  Raw file content
 * @param {string} [filePath]  For warning messages only
 * @returns {string[] | null}
 *   - string[]  when field is present and non-empty (lowercased tool names)
 *   - []        when field is present but explicitly empty
 *   - null      when field is absent
 *
 * Zero external dependencies. Hand-rolled state machine.
 * Handles:
 *   - Multi-line block sequence:  allowed-tools:\n  - Read\n  - Write
 *   - Inline comma-separated scalar:  allowed-tools: Read, Write, Edit
 *   - Field absent → null
 *   - Wildcard entries (mcp__context7__*) preserved as-is (lowercased)
 */
export function parseFrontmatterTools(content, filePath = "<unknown>") {
  // Normalize line endings once
  const normalized = content.replace(/\r\n/g, "\n");

  // Extract frontmatter block.
  // Handles trailing spaces on delimiters and closing --- at EOF (no trailing newline).
  const fmMatch = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!fmMatch) return null;

  const fmText = fmMatch[1];
  const lines = fmText.split("\n");

  const KEY_LINE = /^allowed-tools\s*:\s*(.*)$/;
  const LIST_ITEM = /^\s+-\s+(.+)\s*$/;
  const NEW_KEY = /^[A-Za-z0-9_-]+\s*:/;

  let state = "SCANNING"; // SCANNING | COLLECTING
  const tools = [];
  let fieldFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (state === "SCANNING") {
      const m = line.match(KEY_LINE);
      if (!m) continue;

      fieldFound = true;
      const inline = m[1].trim();

      if (inline) {
        // Inline value: "Read, Write, Edit" or "[Read, Write, Edit]"
        const stripped = inline.replace(/^\[/, "").replace(/\]$/, "");
        const items = stripped
          .split(/\s*,\s*/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        return items.length ? items : [];
      }

      // Empty inline value — switch to block-collection mode
      state = "COLLECTING";
      continue;
    }

    if (state === "COLLECTING") {
      // Terminator: blank line or new top-level key
      if (line.trim() === "" || NEW_KEY.test(line)) break;

      const itemMatch = line.match(LIST_ITEM);
      if (itemMatch) {
        const val = itemMatch[1].trim().toLowerCase();
        if (val) tools.push(val);
      } else {
        // Unexpected line inside list block — warn and skip (do not crash)
        // Include line number (i+1) per error-message format decision
        console.warn(
          `[parseFrontmatterTools] ${filePath}: line ${i + 1}: unexpected line in allowed-tools block: ${JSON.stringify(line)}`
        );
      }
    }
  }

  if (!fieldFound) return null;
  return tools; // [] if block was present but had no valid list items
}

function loadToolMap() {
  const p = path.join(ROOT, 'scripts', 'tools.json');
  if (!fs.existsSync(p)) {
    console.warn('[loadToolMap] scripts/tools.json not found — using empty map');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`[loadToolMap] Failed to parse scripts/tools.json: ${e.message}`);
    process.exitCode = 1;
    return {};
  }
}

function mapTools(upstreamTools, filePath, toolMap, pendingStubs) {
  if (!upstreamTools || upstreamTools.length === 0) {
    return { tools: [], omitted: [] };
  }
  const result = new Set();
  const omitted = [];
  const cmdBase = path.basename(filePath);

  for (const tool of upstreamTools) {
    if (tool.startsWith('mcp__')) {
      result.add(tool);
      continue;
    }
    // Bridge: parseFrontmatterTools() outputs lowercase; tools.json keys are Title-Case
    const originalKey = Object.keys(toolMap).find(k => k.toLowerCase() === tool);
    if (!originalKey) {
      omitted.push(tool);
      if (!(tool in pendingStubs)) pendingStubs[tool] = 'UNMAPPED';
      console.warn(`WARN: unknown tool "${tool}" in ${cmdBase} — omitted`);
      continue;
    }
    const mapped = toolMap[originalKey];
    if (mapped === 'UNMAPPED') {
      omitted.push(tool);
      console.warn(`WARN: unknown tool "${tool}" in ${cmdBase} — omitted (UNMAPPED in tools.json)`);
      continue;
    }
    result.add(mapped);
  }
  return { tools: [...result].sort(), omitted };
}

function normalizeName(name) {
  // upstream uses gsd:new-project; VS Code prompt uses gsd.new-project
  return String(name).replace(/^gsd:/, "gsd.").replace(/:/g, ".");
}

function convertIncludes(text) {
  // Convert Claude-style @ includes into Copilot-friendly "Read file at:" bullets
  // Be conservative: only lines where first non-whitespace is '@'
  return text.replace(/^\s*@(?:include\s+)?(.+?)\s*$/gm, (m, p1) => {
    return `- Read file at: ${p1.trim()}`;
  });
}

function normalizeRuntimePathsForLocalInstall(text) {
  // Convert global/home runtime paths to workspace-local paths.
  // Handles:
  // - ~/.claude/... -> ./.claude/...
  // - /.claude/...  -> ./.claude/...   (important: appears in some upstream renderings)
  // Also supports opencode/gemini if present.
  return text
    .replace(/~\/\.(claude|opencode|gemini)\//g, "./.$1/")
    .replace(/\/\.(claude|opencode|gemini)\//g, "./.$1/");
}

function preflightBlock(cmdName) {
  return `## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: \`./.claude/get-shit-done/\`
2. If missing, run:

\`\`\`bash
npx get-shit-done-cc --claude --local
\`\`\`

3. Then re-run the slash command: \`/${cmdName}\`

---
`;
}

function adapterBlock() {
  // Universal shim: map upstream AskUserQuestion to VS Code's askQuestions tool.
  return `## Copilot Runtime Adapter (important)

Upstream GSD command sources may reference an \`AskUserQuestion\` tool (Claude/OpenCode runtime concept).

In VS Code Copilot, **do not attempt to call a tool named \`AskUserQuestion\`**.
Instead, whenever the upstream instructions say "Use AskUserQuestion", use **#tool:vscode/askQuestions** with:

- Combine the **Header** and **Question** into a single clear question string.
- If the upstream instruction specifies **Options**, present them as numbered choices.
- If no options are specified, ask as a freeform question.

**Rules:**
1. If the options include "Other", "Something else", or "Let me explain", and the user selects it, follow up with a freeform question via #tool:vscode/askQuestions.
2. Follow the upstream branching and loop rules exactly as written (e.g., "if X selected, do Y; otherwise continue").
3. If the upstream flow says to **exit/stop** and run another command, tell the user to run that slash command next, then stop.
4. Use #tool:vscode/askQuestions freely — do not guess or assume user intent.

---
`;
}

function generatedBanner(sourceRel) {
  return `<!-- GENERATED FILE — DO NOT EDIT.
Source: ${sourceRel}
Regenerate: node scripts/generate-prompts.mjs
-->`;
}

function escapeYamlString(s) {
  // safest deterministic quoting for YAML one-liners
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Join non-empty string blocks with exactly one blank line between them.
 * Filters out empty/whitespace-only blocks. No leading or trailing blank lines.
 */
function joinBlocks(...blocks) {
  return blocks
    .map(b => (typeof b === 'string' ? b.trimEnd() : ''))
    .filter(b => b.length > 0)
    .join('\n\n');
}

// ─── Pipeline Steps ──────────────────────────────────────────────────────────

function stepParseFrontmatter(ctx) {
  const { data, body } = parseFrontmatter(ctx.source);
  ctx.fm = data;
  ctx.body = body;
  return ctx;
}

function stepNormalizeEol(ctx) {
  if (ctx.source.includes('\r\n')) {
    ctx._sourceEol = 'CRLF';
    ctx.body = ctx.body.replace(/\r\n/g, '\n');
  } else {
    ctx._sourceEol = 'LF';
  }
  return ctx;
}

function stepParseTools(ctx) {
  // Capture original-cased tool list BEFORE parseFrontmatterTools lowercases them.
  const fmMatch = ctx.source.replace(/\r\n/g, '\n').match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  let originals = null;
  if (fmMatch) {
    const fmText = fmMatch[1];
    const KEY_LINE = /^allowed-tools\s*:\s*(.*)$/;
    const LIST_ITEM = /^\s+-\s+(.+)\s*$/;
    const NEW_KEY = /^[A-Za-z0-9_-]+\s*:/;
    let state = 'SCANNING';
    const items = [];
    let found = false;
    for (const line of fmText.split('\n')) {
      if (state === 'SCANNING') {
        const m = line.match(KEY_LINE);
        if (!m) continue;
        found = true;
        const inline = m[1].trim();
        if (inline) {
          const stripped = inline.replace(/^\[/, '').replace(/\]$/, '');
          originals = stripped.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
          break;
        }
        state = 'COLLECTING';
        continue;
      }
      if (state === 'COLLECTING') {
        if (line.trim() === '' || NEW_KEY.test(line)) break;
        const itemMatch = line.match(LIST_ITEM);
        if (itemMatch) items.push(itemMatch[1].trim());
      }
    }
    if (state === 'COLLECTING') originals = items;
    if (!found) originals = null;
  }
  ctx.upstreamToolsOriginal = originals; // original casing, may be null
  ctx.upstreamTools = parseFrontmatterTools(ctx.source, ctx.cmdFile); // lowercased or null
  return ctx;
}

function stepMapTools(ctx) {
  const { tools, omitted } = mapTools(ctx.upstreamTools, ctx.cmdFile, ctx.toolMap, ctx.pendingStubs);
  ctx.tools = tools;
  ctx.omitted = omitted;
  ctx.totalOmitted = (ctx.totalOmitted || 0) + omitted.length;
  for (const t of omitted) ctx.allOmittedNames.add(t);
  return ctx;
}

function stepConvertIncludes(ctx) {
  ctx.body = convertIncludes(ctx.body);
  return ctx;
}

function stepNormalizeRuntimePaths(ctx) {
  ctx.body = normalizeRuntimePathsForLocalInstall(ctx.body);
  return ctx;
}

/**
 * Rewrite relative path references in body to workspace-relative paths.
 *
 * Handles:
 * 1. Relative paths like ../foo/bar.md — resolved from source file's directory
 * 2. @-prefixed file paths like @.planning/STATE.md — only when file exists
 *
 * Does NOT rewrite:
 * - URLs (guarded by (?<![:/]) lookbehind)
 * - @username tokens (require a / in the path portion to qualify)
 * - Paths that cannot resolve to within ROOT (warns, leaves unchanged)
 */
function stepRewritePaths(ctx) {
  const sourceDir = path.dirname(ctx.cmdFile);

  // 1. Rewrite ../relative paths
  ctx.body = ctx.body.replace(
    /(?<![:/])(\.\.\/[^\s"')>\]]+)/g,
    (match, relPath) => {
      try {
        const abs = path.resolve(sourceDir, relPath);
        // Only rewrite if the file actually exists at the resolved location.
        // Without this guard, ../foo from commands/gsd/ rewrites to commands/foo
        // even when the real file lives at the workspace root (e.g. .claude/...).
        if (!fs.existsSync(abs)) return match;
        const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
        if (rel.startsWith('..')) {
          console.warn(`WARN: [stepRewritePaths] ${path.basename(ctx.cmdFile)}: path resolves outside workspace root: ${relPath}`);
          return match;
        }
        return rel;
      } catch (e) {
        console.warn(`WARN: [stepRewritePaths] ${path.basename(ctx.cmdFile)}: could not resolve path ${relPath}: ${e.message}`);
        return match;
      }
    }
  );

  // 2. Rewrite @-prefixed file references (only if they contain a / and the file exists)
  ctx.body = ctx.body.replace(
    /(?<![A-Za-z0-9_-])@([\w./][^\s"')>\]]*\/[^\s"')>\]]*)/g,
    (match, refPath) => {
      try {
        const absFromRoot = path.resolve(ROOT, refPath);
        const absFromSource = path.resolve(sourceDir, refPath);
        let resolved = null;
        if (fs.existsSync(absFromRoot)) {
          resolved = path.relative(ROOT, absFromRoot).replace(/\\/g, '/');
        } else if (fs.existsSync(absFromSource)) {
          resolved = path.relative(ROOT, absFromSource).replace(/\\/g, '/');
        }
        if (resolved === null) return match;
        return '@' + resolved;
      } catch (e) {
        return match;
      }
    }
  );

  return ctx;
}

function stepAssemble(ctx) {
  const upstreamName = ctx.fm.name || '';
  const cmdName = upstreamName
    ? normalizeName(upstreamName)
    : 'gsd.' + path.basename(ctx.cmdFile, '.md');

  const description = ctx.fm.description || `GSD command ${cmdName}`;
  const argumentHint = ctx.fm['argument-hint'] || '';

  const needsAskTool = ctx.tools.includes('vscode/askQuestions');

  const sourceRel = path.posix.join('commands', 'gsd', path.basename(ctx.cmdFile));

  // upstream-tools comment: use original casing
  const toolsAnnotation = ctx.upstreamToolsOriginal === null
    ? '<!-- upstream-tools: null (field absent in upstream command) -->'
    : `<!-- upstream-tools: ${JSON.stringify(ctx.upstreamToolsOriginal)} -->`;

  const omittedComment = ctx.omitted.length > 0
    ? `<!-- omitted-tools: ${JSON.stringify(ctx.omitted)} — no Copilot equivalent found -->`
    : '';

  // tools frontmatter: omit field entirely when no upstream tools declared
  const toolsYamlLine = ctx.upstreamTools === null
    ? '' // omit
    : `tools: [${ctx.tools.map(t => `'${t}'`).join(', ')}]`;

  const frontmatterLines = [
    `name: ${cmdName}`,
    `description: "${escapeYamlString(description)}"`,
    `argument-hint: "${escapeYamlString(argumentHint)}"`,
    toolsYamlLine,
    `agent: agent`,
  ].filter(l => l.length > 0);

  const frontmatter = `---\n${frontmatterLines.join('\n')}\n---`;

  const banner = generatedBanner(sourceRel);
  const annotations = [toolsAnnotation, omittedComment].filter(Boolean).join('\n');

  ctx.output = joinBlocks(
    frontmatter,
    banner,
    annotations,
    preflightBlock(cmdName).trimEnd(),
    needsAskTool ? adapterBlock().trimEnd() : '',
    ctx.body.trimEnd()
  ) + '\n';

  ctx.cmdName = cmdName;
  return ctx;
}

function stepRestoreEol(ctx) {
  if (ctx._sourceEol === 'CRLF') {
    ctx.output = ctx.output.replace(/\n/g, '\r\n');
  }
  return ctx;
}

/**
 * Validate that triple-backtick fences in ctx.output are balanced.
 * Uses a line-scanning state machine (not regex) to avoid false positives.
 *
 * Sets ctx.skipWrite = true and emits an error to stderr if unbalanced.
 */
function stepValidateFences(ctx) {
  const lines = ctx.output.split('\n');
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (/^`{3,}/.test(trimmed)) {
      depth = depth === 0 ? 1 : 0;
    }
  }

  if (depth !== 0) {
    console.error(
      `ERROR: [stepValidateFences] ${path.basename(ctx.cmdFile)}: unbalanced fenced code block in output — file NOT written`
    );
    ctx.skipWrite = true;
  }
  return ctx;
}

function runPipeline(ctx) {
  const steps = [
    stepParseFrontmatter,
    stepNormalizeEol,
    stepParseTools,
    stepMapTools,
    stepConvertIncludes,
    stepNormalizeRuntimePaths,
    stepRewritePaths,
    stepAssemble,
    stepRestoreEol,
    stepValidateFences,
  ];
  for (const step of steps) step(ctx);
  return ctx;
}

function main() {
  const strict = process.argv.includes('--strict');
  const toolMap = loadToolMap();
  const toolsJsonPath = path.join(ROOT, 'scripts', 'tools.json');
  const pendingStubs = {};
  let totalOmitted = 0;
  const allOmittedNames = new Set();
  let fenceErrors = 0;
  const expectedFiles = new Set();

  const files = listMarkdownFiles(COMMANDS_DIR);
  if (!files.length) {
    console.error(`No command files found at ${COMMANDS_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const f of files) {
    const md = readFile(f);
    const ctx = runPipeline({
      source: md,
      cmdFile: f,
      toolMap,
      pendingStubs,
      allOmittedNames,
      totalOmitted: 0,
    });
    totalOmitted += ctx.totalOmitted;
    const prompt = ctx.output;

    const base = path.basename(f, '.md'); // e.g., new-project
    const outName = `gsd.${base}.prompt.md`;
    const outPath = path.join(OUT_DIR, outName);

    expectedFiles.add(outName);

    if (!ctx.skipWrite) {
      writeFile(outPath, prompt);
    } else {
      fenceErrors++;
    }
  }

  // ─── Orphan Cleanup (GEN-09) ─────────────────────────────────────────────
  // Remove .github/prompts/*.prompt.md files whose source command no longer exists.
  if (fs.existsSync(OUT_DIR)) {
    const existing = fs.readdirSync(OUT_DIR).filter(n => n.endsWith('.prompt.md'));
    for (const name of existing) {
      if (!expectedFiles.has(name)) {
        const orphanPath = path.join(OUT_DIR, name);
        fs.unlinkSync(orphanPath);
        console.log(`Removed orphan: ${name}`);
      }
    }
  }

  // auto-stub write-back — one batch write AFTER all files processed
  if (Object.keys(pendingStubs).length > 0) {
    const updated = { ...toolMap, ...pendingStubs };
    fs.writeFileSync(toolsJsonPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    console.warn(`\nWARN: auto-stubbed ${Object.keys(pendingStubs).length} unknown tools as UNMAPPED:`);
    for (const t of Object.keys(pendingStubs)) console.warn(`  "${t}": "UNMAPPED"`);
    console.warn('  Fill in Copilot equivalents before next run.\n');
  }

  if (fenceErrors > 0) {
    console.error(`\nERROR: ${fenceErrors} file(s) skipped due to unbalanced fences.`);
    process.exitCode = 1;
  }

  if (totalOmitted > 0) {
    const hint = strict ? '' : ' (run with --strict to fail on unknown tools)';
    console.log(`\n⚠ ${totalOmitted} unknown tool occurrences omitted: ${[...allOmittedNames].join(', ')}${hint}`);
  }

  if (strict && totalOmitted > 0) process.exitCode = 1;
  console.log(`Generated ${files.length} prompt files into ${OUT_DIR}`);
}

main();