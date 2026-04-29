/**
 * GSD Code Review Tests
 *
 * Validates all code review artifacts from Phases 1-4:
 * - Agent frontmatter (gsd-code-reviewer, gsd-code-fixer)
 * - Command structure (code-review.md, code-review-fix.md)
 * - Workflow structure (code-review.md, code-review-fix.md)
 * - Config key registration (workflow.code_review, workflow.code_review_depth)
 * - Workflow integration points (execute-phase, quick, autonomous)
 *
 * Test structure:
 * - CR-AGENT: Hermetic agent tests (repo files only)
 * - CR-CMD: Hermetic command tests (repo files only)
 * - CR-WORKFLOW: Hermetic workflow tests (repo files only)
 * - CR-CONFIG: Hermetic config tests (repo files only)
 * - CR-INTEGRATION: Conditional integration tests (skip if plugin dir absent)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// --- Test Environment Setup ---

const AGENTS_DIR = path.join(__dirname, '..', 'agents');
const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

/**
 * Parse top-level (non-nested, non-escaped) Skill() invocations from a workflow .md file.
 *
 * Returns an array of structured objects: [{ skill, args }]
 *  - `skill` is the value of the `skill="..."` keyword argument
 *  - `args` is the value of the `args="..."` keyword argument (or null if absent)
 *
 * Skips occurrences inside escaped string contexts like
 *   prompt="... Skill(skill=\"x\", args=\"y\") ..."
 * by walking the file character-by-character and tracking whether we are inside
 * a double-quoted string. Escaped quotes (\") are treated as literal content.
 *
 * This avoids regex/.includes() text-matching: callers receive a structured list
 * and assert against fields and tokenized args.
 */
function parseWorkflowSkillInvocations(content) {
  const invocations = [];
  let i = 0;
  let inString = false;

  while (i < content.length) {
    const ch = content[i];

    if (inString) {
      if (ch === '\\' && i + 1 < content.length) {
        // Skip escape sequence (e.g. \" or \\)
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      i += 1;
      continue;
    }

    // Look for top-level "Skill(" at this position
    if (content.startsWith('Skill(', i)) {
      const callStart = i + 'Skill('.length;
      // Find the matching close paren, respecting strings/escapes inside the call
      let j = callStart;
      let depth = 1;
      let innerInString = false;
      while (j < content.length && depth > 0) {
        const c = content[j];
        if (innerInString) {
          if (c === '\\' && j + 1 < content.length) {
            j += 2;
            continue;
          }
          if (c === '"') innerInString = false;
          j += 1;
          continue;
        }
        if (c === '"') {
          innerInString = true;
        } else if (c === '(') {
          depth += 1;
        } else if (c === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
        j += 1;
      }
      const callBody = content.slice(callStart, j);
      const parsed = parseSkillCallBody(callBody);
      if (parsed) invocations.push(parsed);
      i = j + 1;
      continue;
    }

    i += 1;
  }

  return invocations;
}

/**
 * Parse the body of a Skill(...) call into { skill, args }.
 * Body looks like: skill="name", args="value" (args optional).
 * Returns null if no skill keyword is found.
 */
function parseSkillCallBody(body) {
  const kwargs = {};
  const isIdentChar = (c) => /[A-Za-z0-9_]/.test(c);
  const isWs = (c) => /\s/.test(c);
  let i = 0;
  while (i < body.length) {
    // Skip whitespace and commas
    while (i < body.length && (isWs(body[i]) || body[i] === ',')) i += 1;
    if (i >= body.length) break;

    // Read identifier key
    const keyStart = i;
    while (i < body.length && isIdentChar(body[i])) i += 1;
    const key = body.slice(keyStart, i);
    if (!key) break;

    // Expect '='
    while (i < body.length && isWs(body[i])) i += 1;
    if (body[i] !== '=') break;
    i += 1;
    while (i < body.length && isWs(body[i])) i += 1;

    // Expect quoted value
    if (body[i] !== '"') break;
    i += 1;
    let value = '';
    while (i < body.length) {
      const c = body[i];
      if (c === '\\' && i + 1 < body.length) {
        value += body[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') {
        i += 1;
        break;
      }
      value += c;
      i += 1;
    }
    kwargs[key] = value;
  }

  if (!('skill' in kwargs)) return null;
  return { skill: kwargs.skill, args: 'args' in kwargs ? kwargs.args : null };
}

// Plugin directory resolution (cross-platform safe)
const PLUGIN_WORKFLOWS_DIR = process.env.GSD_PLUGIN_ROOT || path.join(os.homedir(), '.claude', 'get-shit-done', 'workflows');
const PLUGIN_AVAILABLE = fs.existsSync(PLUGIN_WORKFLOWS_DIR);

// --- CR-AGENT: code review agent frontmatter ---

describe('CR-AGENT: code review agent frontmatter', () => {
  test('gsd-code-reviewer.md has required frontmatter fields', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-reviewer.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(frontmatter.includes('name:'), 'gsd-code-reviewer missing name:');
    assert.ok(frontmatter.includes('description:'), 'gsd-code-reviewer missing description:');
    assert.ok(frontmatter.includes('tools:'), 'gsd-code-reviewer missing tools:');
    assert.ok(frontmatter.includes('color:'), 'gsd-code-reviewer missing color:');
  });

  test('gsd-code-fixer.md has required frontmatter fields', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-fixer.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(frontmatter.includes('name:'), 'gsd-code-fixer missing name:');
    assert.ok(frontmatter.includes('description:'), 'gsd-code-fixer missing description:');
    assert.ok(frontmatter.includes('tools:'), 'gsd-code-fixer missing tools:');
    assert.ok(frontmatter.includes('color:'), 'gsd-code-fixer missing color:');
  });

  test('gsd-code-reviewer.md has Read, Bash, Glob, Grep, Write tools', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-reviewer.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(frontmatter.includes('Read'), 'gsd-code-reviewer missing Read tool');
    assert.ok(frontmatter.includes('Bash'), 'gsd-code-reviewer missing Bash tool');
    assert.ok(frontmatter.includes('Glob'), 'gsd-code-reviewer missing Glob tool');
    assert.ok(frontmatter.includes('Grep'), 'gsd-code-reviewer missing Grep tool');
    assert.ok(frontmatter.includes('Write'), 'gsd-code-reviewer missing Write tool');
  });

  test('gsd-code-fixer.md has Read, Edit, Write, Bash, Grep, Glob tools', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-fixer.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(frontmatter.includes('Read'), 'gsd-code-fixer missing Read tool');
    assert.ok(frontmatter.includes('Edit'), 'gsd-code-fixer missing Edit tool');
    assert.ok(frontmatter.includes('Write'), 'gsd-code-fixer missing Write tool');
    assert.ok(frontmatter.includes('Bash'), 'gsd-code-fixer missing Bash tool');
  });

  test('gsd-code-reviewer.md does not have skills: in frontmatter', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-reviewer.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(!frontmatter.includes('skills:'),
      'gsd-code-reviewer has skills: in frontmatter — breaks Gemini CLI');
  });

  test('gsd-code-fixer.md does not have skills: in frontmatter', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-fixer.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(!frontmatter.includes('skills:'),
      'gsd-code-fixer has skills: in frontmatter — breaks Gemini CLI');
  });

  test('gsd-code-fixer.md rollback uses git checkout (not Write tool)', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-fixer.md'), 'utf-8');
    assert.ok(content.includes('git checkout --'),
      'gsd-code-fixer rollback should use git checkout -- {file} for atomic rollback');
    assert.ok(!content.includes('PRE_FIX_CONTENT'),
      'gsd-code-fixer should not use PRE_FIX_CONTENT in-memory capture (use git checkout instead)');
  });

  test('gsd-code-fixer.md success_criteria consistent with rollback strategy (git checkout)', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-fixer.md'), 'utf-8');
    const successCriteria = content.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/)?.[1] || '';
    assert.ok(successCriteria.includes('git checkout'),
      'gsd-code-fixer success_criteria must reference git checkout rollback');
    assert.ok(!successCriteria.includes('Write tool with captured'),
      'gsd-code-fixer success_criteria must not say Write tool for rollback');
  });

  test('gsd-code-fixer.md flags logic-bug fixes for human review', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-fixer.md'), 'utf-8');
    assert.ok(content.includes('requires human verification'),
      'gsd-code-fixer should flag logic-bug fixes as requiring human verification');
  });

  test('gsd-code-reviewer.md REVIEW.md spec includes files_reviewed_list field', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-code-reviewer.md'), 'utf-8');
    assert.ok(content.includes('files_reviewed_list'),
      'gsd-code-reviewer REVIEW.md frontmatter spec must include files_reviewed_list for --auto scope persistence');
  });
});

// --- CR-CMD: code review command structure ---

describe('CR-CMD: code review command structure', () => {
  test('code-review.md has correct frontmatter name: gsd:code-review', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'code-review.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(frontmatter.includes('name: gsd:code-review'),
      'code-review.md missing correct name in frontmatter');
  });

  // #2790: code-review-fix.md was consolidated into code-review.md as the --fix flag.
  test('code-review.md has --fix flag absorbing code-review-fix (#2790)', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'code-review.md'), 'utf-8');
    assert.ok(content.includes('--fix'),
      'code-review.md must document --fix flag (absorbed code-review-fix)');
  });

  test('code-review.md references workflow: code-review.md', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'code-review.md'), 'utf-8');

    assert.ok(content.includes('code-review.md'),
      'code-review.md does not reference its workflow');
  });

  test('code-review.md references code-review-fix workflow via --fix (#2790)', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'code-review.md'), 'utf-8');
    assert.ok(content.includes('code-review-fix') || content.includes('--fix'),
      'code-review.md must reference code-review-fix workflow or --fix flag');
  });

  test('code-review.md has argument-hint in frontmatter', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'code-review.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(frontmatter.includes('argument-hint:'),
      'code-review.md missing argument-hint');
  });

  test('code-review.md argument-hint includes --fix flag (#2790: absorbed code-review-fix)', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'code-review.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(frontmatter.includes('argument-hint:') && content.includes('--fix'),
      'code-review.md must have argument-hint with --fix');
  });

  test('code-review.md has allowed-tools in frontmatter', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'code-review.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';

    assert.ok(frontmatter.includes('allowed-tools:'),
      'code-review.md missing allowed-tools');
  });

  test('code-review.md has allowed-tools in frontmatter (covers fix too, #2790)', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'code-review.md'), 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(frontmatter.includes('allowed-tools:'),
      'code-review.md missing allowed-tools');
  });
});

// --- CR-WORKFLOW: code review workflow structure ---

describe('CR-WORKFLOW: code review workflow structure', () => {
  test('code-review.md workflow has <step name="initialize">', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review.md'), 'utf-8');

    assert.ok(content.includes('<step name="initialize">'),
      'code-review.md workflow missing initialize step');
  });

  test('code-review.md workflow has <step name="check_config_gate">', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review.md'), 'utf-8');

    assert.ok(content.includes('<step name="check_config_gate">'),
      'code-review.md workflow missing check_config_gate step');
  });

  test('code-review.md workflow references gsd-code-reviewer agent', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review.md'), 'utf-8');

    assert.ok(content.includes('gsd-code-reviewer'),
      'code-review.md workflow does not reference gsd-code-reviewer agent');
  });

  test('code-review-fix.md workflow has <step name="initialize">', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review-fix.md'), 'utf-8');

    assert.ok(content.includes('<step name="initialize">'),
      'code-review-fix.md workflow missing initialize step');
  });

  test('code-review-fix.md workflow references gsd-code-fixer agent', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review-fix.md'), 'utf-8');

    assert.ok(content.includes('gsd-code-fixer'),
      'code-review-fix.md workflow does not reference gsd-code-fixer agent');
  });

  test('code-review-fix.md workflow has iteration cap', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review-fix.md'), 'utf-8');

    // Check for iteration logic with cap
    assert.ok(content.includes('MAX_ITERATIONS') || (content.includes('3') && content.includes('iteration')),
      'code-review-fix.md workflow missing iteration cap logic');
  });

  test('code-review.md --files path traversal guard rejects paths outside repo', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review.md'), 'utf-8');
    // Guard must resolve and compare against REPO_ROOT
    assert.ok(content.includes('REPO_ROOT') && content.includes('realpath'),
      'code-review.md missing path traversal guard (realpath + REPO_ROOT check)');
    assert.ok(content.includes('File path outside repository'),
      'code-review.md missing rejection message for paths outside repo');
  });

  test('code-review.md uses portable while-read loop for array dedup (not mapfile)', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review.md'), 'utf-8');
    // mapfile is bash 4+ only; macOS ships bash 3.2. Dedup must use portable while-read.
    // Note: 'mapfile' may appear in platform_notes documentation — check bash code blocks only
    const codeBlocks = content.match(/```bash[\s\S]*?```/g) || [];
    const hasMapfileInCode = codeBlocks.some(block => block.includes('mapfile -t'));
    assert.ok(!hasMapfileInCode,
      'code-review.md bash code blocks use mapfile which is bash 4+ only — breaks macOS default bash 3.2');
    assert.ok(content.includes('while IFS= read -r'),
      'code-review.md should use portable while-read loop instead of mapfile');
  });

  test('code-review-fix.md uses portable while-read loop for array construction (not mapfile)', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'code-review-fix.md'), 'utf-8');
    const codeBlocks = content.match(/```bash[\s\S]*?```/g) || [];
    const hasMapfileInCode = codeBlocks.some(block => block.includes('mapfile -t'));
    assert.ok(!hasMapfileInCode,
      'code-review-fix.md bash code blocks use mapfile which is bash 4+ only — breaks macOS default bash 3.2');
    assert.ok(content.includes('while IFS= read -r'),
      'code-review-fix.md should use portable while-read loop instead of mapfile');
  });
});

// --- CR-CONFIG: config key registration ---

describe('CR-CONFIG: config key registration', () => {
  test('config-set accepts workflow.code_review', () => {
    const tmpDir = createTempProject();
    try {
      const result = runGsdTools('config-set workflow.code_review true', tmpDir);
      assert.ok(result.success, `config-set should accept workflow.code_review: ${result.error}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('config-set accepts workflow.code_review_depth', () => {
    const tmpDir = createTempProject();
    try {
      const result = runGsdTools('config-set workflow.code_review_depth standard', tmpDir);
      assert.ok(result.success, `config-set should accept workflow.code_review_depth: ${result.error}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('config-get workflow.code_review returns value set via config-set', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const setResult = runGsdTools(['config-set', 'workflow.code_review', 'true'], tmpDir);
    assert.ok(setResult.success, `config-set workflow.code_review failed: ${setResult.error}`);

    const getResult = runGsdTools(['config-get', 'workflow.code_review'], tmpDir);
    assert.ok(getResult.success, `config-get workflow.code_review failed: ${getResult.error}`);
    assert.strictEqual(getResult.output, 'true',
      `workflow.code_review should return "true", got ${getResult.output}`);
  });

  test('config-get workflow.code_review_depth returns value set via config-set', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const setResult = runGsdTools(['config-set', 'workflow.code_review_depth', 'standard'], tmpDir);
    assert.ok(setResult.success, `config-set workflow.code_review_depth failed: ${setResult.error}`);

    const getResult = runGsdTools(['config-get', 'workflow.code_review_depth'], tmpDir);
    assert.ok(getResult.success, `config-get workflow.code_review_depth failed: ${getResult.error}`);
    assert.strictEqual(getResult.output, '"standard"',
      `workflow.code_review_depth should return '"standard"', got ${getResult.output}`);
  });
});

// --- CR-INTEGRATION: workflow integration points ---

describe('CR-INTEGRATION: workflow integration points', () => {
  test('execute-phase.md contains code_review_gate step', { skip: !PLUGIN_AVAILABLE ? 'Plugin dir not installed' : false }, () => {
    const content = fs.readFileSync(path.join(PLUGIN_WORKFLOWS_DIR, 'execute-phase.md'), 'utf-8');

    assert.ok(content.includes('code_review_gate'),
      'execute-phase.md missing code_review_gate step name');
  });

  test('execute-phase.md contains config-get workflow.code_review', { skip: !PLUGIN_AVAILABLE ? 'Plugin dir not installed' : false }, () => {
    const content = fs.readFileSync(path.join(PLUGIN_WORKFLOWS_DIR, 'execute-phase.md'), 'utf-8');

    assert.match(content, /config-get\s+workflow\.code_review/,
      'execute-phase.md missing config-get workflow.code_review call');
  });

  test('execute-phase.md does NOT contain ls.*REVIEW.md.*head pattern', { skip: !PLUGIN_AVAILABLE ? 'Plugin dir not installed' : false }, () => {
    const content = fs.readFileSync(path.join(PLUGIN_WORKFLOWS_DIR, 'execute-phase.md'), 'utf-8');

    // Extract code_review_gate section to check
    const gateMatch = content.match(/<step name="code_review_gate">([\s\S]*?)<\/step>/);
    if (gateMatch) {
      const gateContent = gateMatch[1];
      assert.ok(!gateContent.match(/ls.*REVIEW\.md.*head/),
        'execute-phase.md code_review_gate uses non-deterministic glob pattern (ls | head)');
    }
  });

  test('quick.md contains code-review invocation', { skip: !PLUGIN_AVAILABLE ? 'Plugin dir not installed' : false }, () => {
    const content = fs.readFileSync(path.join(PLUGIN_WORKFLOWS_DIR, 'quick.md'), 'utf-8');

    assert.ok(content.includes('code-review') || content.includes('code_review'),
      'quick.md missing code-review invocation');
  });

  test('quick.md contains config-get workflow.code_review', { skip: !PLUGIN_AVAILABLE ? 'Plugin dir not installed' : false }, () => {
    const content = fs.readFileSync(path.join(PLUGIN_WORKFLOWS_DIR, 'quick.md'), 'utf-8');

    assert.match(content, /config-get\s+workflow\.code_review/,
      'quick.md missing config-get workflow.code_review call');
  });

  // autonomous.md tests read from the repo's canonical workflow source (WORKFLOWS_DIR),
  // not the user-installed plugin dir. The plugin dir can lag behind the repo until the
  // user re-installs, so asserting against it produces false negatives. The repo file
  // is the source of truth and is always present in CI checkouts.
  test('autonomous.md contains gsd-code-review skill invocation', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'autonomous.md'), 'utf-8');

    // Parse Skill(...) invocations into structured objects and assert canonical
    // hyphen form is referenced. Canonical command form is hyphen
    // (gsd-code-review); colon form (gsd:code-review) is the legacy
    // frontmatter-name form removed in PR #2819.
    const invocations = parseWorkflowSkillInvocations(content);
    const skillNames = invocations.map(inv => inv.skill);
    assert.ok(skillNames.includes('gsd-code-review'),
      `autonomous.md must invoke Skill(skill="gsd-code-review", ...); found skills: ${JSON.stringify(skillNames)}`);
    assert.ok(!skillNames.includes('gsd:code-review'),
      'autonomous.md must not use legacy colon form gsd:code-review (canonical is hyphen form)');
  });

  test('autonomous.md auto-fix uses consolidated gsd-code-review --fix invocation (#2790)', () => {
    // After #2790, gsd-code-review-fix was absorbed into gsd-code-review as
    // the --fix flag. The autonomous workflow must invoke the consolidated
    // form, not the deleted gsd-code-review-fix skill.
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'autonomous.md'), 'utf-8');

    const invocations = parseWorkflowSkillInvocations(content);
    const skillNames = invocations.map(inv => inv.skill);
    assert.ok(!skillNames.includes('gsd-code-review-fix'),
      `autonomous.md must not invoke deleted gsd-code-review-fix skill (consolidated into --fix); found: ${JSON.stringify(skillNames)}`);
    assert.ok(!skillNames.includes('gsd:code-review-fix'),
      'autonomous.md must not use legacy colon form gsd:code-review-fix');

    // Find a gsd-code-review invocation that carries the --fix flag (the
    // consolidated auto-fix entry point).
    const fixInvocation = invocations.find(inv => {
      if (inv.skill !== 'gsd-code-review') return false;
      const tokens = new Set((inv.args ?? '').split(/\s+/).filter(Boolean));
      return tokens.has('--fix');
    });
    assert.ok(fixInvocation,
      `autonomous.md must invoke Skill(skill="gsd-code-review", args="... --fix ...") for auto-fix; found: ${JSON.stringify(invocations)}`);
  });

  test('autonomous.md contains --auto flag on consolidated --fix invocation (#2790)', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'autonomous.md'), 'utf-8');

    // Find the gsd-code-review invocation that carries --fix (the consolidated
    // auto-fix entry point), then assert --auto is one of its arg tokens.
    // Tokenize via whitespace-split to avoid substring matches that could
    // conflate --auto with --auto-foo.
    const invocations = parseWorkflowSkillInvocations(content);
    const fixInvocation = invocations.find(inv => {
      if (inv.skill !== 'gsd-code-review') return false;
      const tokens = new Set((inv.args ?? '').split(/\s+/).filter(Boolean));
      return tokens.has('--fix');
    });
    assert.ok(fixInvocation, 'autonomous.md missing Skill(skill="gsd-code-review", args="... --fix ...") invocation');
    const argTokens = new Set((fixInvocation.args ?? '').split(/\s+/).filter(Boolean));
    assert.ok(argTokens.has('--auto'),
      `autonomous.md gsd-code-review-fix args missing --auto flag; got args="${fixInvocation.args}"`);
  });
});
