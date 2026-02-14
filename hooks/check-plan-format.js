#!/usr/bin/env node
// PostToolUse(Write/Edit) hook — validates PLAN.md and SUMMARY.md structure
// Activates when file matches PLAN*.md or SUMMARY*.md in .planning/ directory
//
// Checks for PLAN files:
//   - Frontmatter exists (between --- markers)
//   - Required frontmatter fields: phase, plan
//   - Task sections exist (## Task N or ### Task N headings)
//   - Task count: warn if >3, error if >5
//
// Checks for SUMMARY files:
//   - Frontmatter exists
//   - Required fields: phase, plan, status
//
// Input: JSON on stdin with { tool_name, tool_input, tool_result, cwd }
// Output: Informational only (PostToolUse hooks cannot block)

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();

    // Only handle Write and Edit tools
    if (data.tool_name !== 'Write' && data.tool_name !== 'Edit') {
      process.exit(0);
    }

    // Check config toggle
    const config = loadHookConfig(cwd);
    if (config.checkPlanFormat === false) {
      process.exit(0);
    }

    const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';
    if (!filePath) {
      process.exit(0);
    }

    // Normalize path separators for cross-platform matching
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Only activate for files in .planning/ directory
    if (!normalizedPath.includes('.planning/')) {
      process.exit(0);
    }

    const basename = path.basename(filePath);

    // Determine file type
    const isPlan = /^.*PLAN.*\.md$/i.test(basename) && !basename.includes('SUMMARY');
    const isSummary = /^.*SUMMARY.*\.md$/i.test(basename);

    if (!isPlan && !isSummary) {
      process.exit(0);
    }

    // Read the file content
    let content = '';
    try {
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(cwd, filePath);
      content = fs.readFileSync(resolvedPath, 'utf8');
    } catch (e) {
      // File may not exist yet or be unreadable — skip silently
      process.exit(0);
    }

    const warnings = [];

    // Extract frontmatter
    const frontmatter = extractFrontmatter(content);

    if (isPlan) {
      validatePlan(content, frontmatter, basename, warnings);
    } else if (isSummary) {
      validateSummary(frontmatter, basename, warnings);
    }

    // Output warnings to stderr (PostToolUse is informational)
    if (warnings.length > 0) {
      process.stderr.write(`[check-plan-format] ${basename}:\n`);
      for (const w of warnings) {
        process.stderr.write(`  - ${w}\n`);
      }
    }

    // Log event
    logEvent(cwd, isPlan ? 'plan' : 'summary', basename, warnings);

  } catch (e) {
    // Silent fail — never block on hook bugs
  }
  process.exit(0);
});

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fields = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const kvMatch = line.match(/^(\S[^:]*?):\s*(.*)/);
    if (kvMatch) {
      fields[kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }
  return fields;
}

function validatePlan(content, frontmatter, basename, warnings) {
  // Check frontmatter exists
  if (!frontmatter) {
    warnings.push('Missing frontmatter (expected --- delimited YAML block)');
    return;
  }

  // Check required fields
  if (!frontmatter.phase) {
    warnings.push('Missing required frontmatter field: phase');
  }
  if (!frontmatter.plan) {
    warnings.push('Missing required frontmatter field: plan');
  }

  // Count tasks (headings like ## Task N or ### Task N)
  const taskPattern = /^#{2,3}\s+Task\s+\d+/gim;
  const tasks = content.match(taskPattern) || [];
  const taskCount = tasks.length;

  if (taskCount === 0) {
    warnings.push('No task sections found (expected ## Task N or ### Task N headings)');
  } else if (taskCount > 5) {
    warnings.push(`Too many tasks: ${taskCount} (maximum 5 per plan, consider splitting)`);
  } else if (taskCount > 3) {
    warnings.push(`High task count: ${taskCount} (recommended maximum is 3 per plan)`);
  }
}

function validateSummary(frontmatter, basename, warnings) {
  // Check frontmatter exists
  if (!frontmatter) {
    warnings.push('Missing frontmatter (expected --- delimited YAML block)');
    return;
  }

  // Check required fields
  if (!frontmatter.phase) {
    warnings.push('Missing required frontmatter field: phase');
  }
  if (!frontmatter.plan) {
    warnings.push('Missing required frontmatter field: plan');
  }
  if (!frontmatter.status) {
    warnings.push('Missing required frontmatter field: status');
  }
}

function loadHookConfig(cwd) {
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.hooks || {};
    }
  } catch (e) { /* ignore parse errors */ }
  return {};
}

function logEvent(cwd, fileType, filename, warnings) {
  try {
    const logsDir = path.join(cwd, '.planning', 'logs');
    const logFile = path.join(logsDir, 'hooks.jsonl');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      hook: 'check-plan-format',
      event: 'PostToolUse',
      decision: warnings.length > 0 ? 'warn' : 'allow',
      fileType,
      file: filename,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (e) { /* ignore logging errors */ }
}
