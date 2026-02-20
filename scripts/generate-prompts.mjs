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

function buildPrompt({ cmdFile, fm, body, upstreamTools, tools, omitted }) {
  const upstreamName = fm.name || "";
  const cmdName = upstreamName
    ? normalizeName(upstreamName)
    : "gsd." + path.basename(cmdFile, ".md");

  const description = fm.description || `GSD command ${cmdName}`;
  const argumentHint = fm["argument-hint"] || "";

  // Transform body with minimal changes
  let converted = body;
  converted = convertIncludes(converted);
  converted = normalizeRuntimePathsForLocalInstall(converted);

  // Normalize newlines
  converted = converted.replace(/\r\n/g, "\n");

  // Adapter shim is conditional: only emit when vscode/askQuestions is in the mapped tools list
  const needsAskTool = tools.includes('vscode/askQuestions');

  const sourceRel = path.posix.join(
    "commands",
    "gsd",
    path.basename(cmdFile)
  );

  const toolsAnnotation = upstreamTools === null
    ? "<!-- upstream-tools: null (field absent in upstream command) -->"
    : `<!-- upstream-tools: ${JSON.stringify(upstreamTools)} -->`;

  // tools and omitted come from mapTools() — passed in as parameters
  const toolsYaml = tools.length > 0
    ? `[${tools.map((t) => `'${t}'`).join(', ')}]`
    : '[]';

  const omittedComment = omitted.length > 0
    ? `<!-- omitted-tools: ${JSON.stringify(omitted)} — no Copilot equivalent found -->`
    : '';

  return `---
name: ${cmdName}
description: "${escapeYamlString(description)}"
argument-hint: "${escapeYamlString(argumentHint)}"
tools: ${toolsYaml}
agent: agent
---

${generatedBanner(sourceRel)}
${toolsAnnotation}
${omittedComment ? omittedComment + '\n' : ''}
${preflightBlock(cmdName)}
${needsAskTool ? adapterBlock() : ''}
${converted.trimEnd()}
`;
}

function main() {
  const strict = process.argv.includes('--strict');
  const toolMap = loadToolMap();
  const toolsJsonPath = path.join(ROOT, 'scripts', 'tools.json');
  const pendingStubs = {};
  let totalOmitted = 0;
  const allOmittedNames = new Set();

  const files = listMarkdownFiles(COMMANDS_DIR);
  if (!files.length) {
    console.error(`No command files found at ${COMMANDS_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const f of files) {
    const md = readFile(f);
    const { data, body } = parseFrontmatter(md);
    const upstreamTools = parseFrontmatterTools(md, f);
    const { tools, omitted } = mapTools(upstreamTools, f, toolMap, pendingStubs);

    totalOmitted += omitted.length;
    for (const t of omitted) allOmittedNames.add(t);

    const prompt = buildPrompt({ cmdFile: f, fm: data, body, upstreamTools, tools, omitted });

    const base = path.basename(f, '.md'); // e.g., new-project
    const outName = `gsd.${base}.prompt.md`;
    const outPath = path.join(OUT_DIR, outName);

    writeFile(outPath, prompt);
  }

  // auto-stub write-back — one batch write AFTER all files processed
  if (Object.keys(pendingStubs).length > 0) {
    const updated = { ...toolMap, ...pendingStubs };
    fs.writeFileSync(toolsJsonPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    console.warn(`\nWARN: auto-stubbed ${Object.keys(pendingStubs).length} unknown tools as UNMAPPED:`);
    for (const t of Object.keys(pendingStubs)) console.warn(`  "${t}": "UNMAPPED"`);
    console.warn('  Fill in Copilot equivalents before next run.\n');
  }

  if (totalOmitted > 0) {
    const hint = strict ? '' : ' (run with --strict to fail on unknown tools)';
    console.log(`\n⚠ ${totalOmitted} unknown tool occurrences omitted: ${[...allOmittedNames].join(', ')}${hint}`);
  }

  if (strict && totalOmitted > 0) process.exitCode = 1;
  console.log(`Generated ${files.length} prompt files into ${OUT_DIR}`);
}

main();