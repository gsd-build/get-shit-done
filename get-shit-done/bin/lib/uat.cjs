/**
 * UAT Audit — Cross-phase UAT/VERIFICATION scanner
 *
 * Reads all *-UAT.md and *-VERIFICATION.md files across all phases.
 * Extracts non-passing items. Returns structured JSON for workflow consumption.
 */

const fs = require('fs');
const path = require('path');
const { output, error, getMilestonePhaseFilter, toPosixPath } = require('./core.cjs');
const { planningDir } = require('./planning-workspace.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const { requireSafePath, sanitizeForDisplay } = require('./security.cjs');

function cmdAuditUat(cwd, raw) {
  const phasesDir = path.join(planningDir(cwd), 'phases');
  if (!fs.existsSync(phasesDir)) {
    error('No phases directory found in planning directory');
  }

  const isDirInMilestone = getMilestonePhaseFilter(cwd);
  const results = [];

  // Scan all phase directories
  const dirs = fs.readdirSync(phasesDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(isDirInMilestone)
    .sort();

  for (const dir of dirs) {
    const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    const phaseNum = phaseMatch ? phaseMatch[1] : dir;
    const phaseDir = path.join(phasesDir, dir);
    const files = fs.readdirSync(phaseDir);

    // Process UAT files
    for (const file of files.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
      const content = fs.readFileSync(path.join(phaseDir, file), 'utf-8');
      const items = parseUatItems(content);
      if (items.length > 0) {
        results.push({
          phase: phaseNum,
          phase_dir: dir,
          file,
          file_path: toPosixPath(path.relative(cwd, path.join(phaseDir, file))),
          type: 'uat',
          status: (extractFrontmatter(content).status || 'unknown'),
          items,
        });
      }
    }

    // Process VERIFICATION files
    for (const file of files.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
      const content = fs.readFileSync(path.join(phaseDir, file), 'utf-8');
      const status = extractFrontmatter(content).status || 'unknown';
      if (status === 'human_needed' || status === 'gaps_found') {
        const items = parseVerificationItems(content, status);
        if (items.length > 0) {
          results.push({
            phase: phaseNum,
            phase_dir: dir,
            file,
            file_path: toPosixPath(path.relative(cwd, path.join(phaseDir, file))),
            type: 'verification',
            status,
            items,
          });
        }
      }
    }
  }

  // Compute summary
  const summary = {
    total_files: results.length,
    total_items: results.reduce((sum, r) => sum + r.items.length, 0),
    by_category: {},
    by_phase: {},
  };

  for (const r of results) {
    if (!summary.by_phase[r.phase]) summary.by_phase[r.phase] = 0;
    for (const item of r.items) {
      summary.by_phase[r.phase]++;
      const cat = item.category || 'unknown';
      summary.by_category[cat] = (summary.by_category[cat] || 0) + 1;
    }
  }

  output({ results, summary }, raw);
}

function cmdRenderCheckpoint(cwd, options = {}, raw) {
  const filePath = options.file;
  if (!filePath) {
    error('UAT file required: use uat render-checkpoint --file <path>');
  }

  const resolvedPath = requireSafePath(filePath, cwd, 'UAT file', { allowAbsolute: true });
  if (!fs.existsSync(resolvedPath)) {
    error(`UAT file not found: ${filePath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const currentTest = parseCurrentTest(content);

  if (currentTest.complete) {
    error('UAT session is already complete; no pending checkpoint to render');
  }

  const checkpoint = buildCheckpoint(currentTest);
  output({
    file_path: toPosixPath(path.relative(cwd, resolvedPath)),
    test_number: currentTest.number,
    test_name: currentTest.name,
    checkpoint,
  }, raw, checkpoint);
}

function parseCurrentTest(content) {
  const currentTestMatch = content.match(/##\s*Current Test\s*(?:\n<!--[\s\S]*?-->)?\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!currentTestMatch) {
    error('UAT file is missing a Current Test section');
  }

  const section = currentTestMatch[1].trimEnd();
  if (!section.trim()) {
    error('Current Test section is empty');
  }

  if (/\[testing complete\]/i.test(section)) {
    return { complete: true };
  }

  const numberMatch = section.match(/^number:\s*(\d+)\s*$/m);
  const nameMatch = section.match(/^name:\s*(.+)\s*$/m);
  const expectedBlockMatch = section.match(/^expected:\s*\|\n([\s\S]*?)(?=^\w[\w-]*:\s)/m)
    || section.match(/^expected:\s*\|\n([\s\S]+)/m);
  const expectedInlineMatch = section.match(/^expected:\s*(.+)\s*$/m);

  if (!numberMatch || !nameMatch || (!expectedBlockMatch && !expectedInlineMatch)) {
    error('Current Test section is malformed');
  }

  let expected;
  if (expectedBlockMatch) {
    expected = expectedBlockMatch[1]
      .split('\n')
      .map(line => line.replace(/^ {2}/, ''))
      .join('\n')
      .trim();
  } else {
    expected = expectedInlineMatch[1].trim();
  }

  return {
    complete: false,
    number: parseInt(numberMatch[1], 10),
    name: sanitizeForDisplay(nameMatch[1].trim()),
    expected: sanitizeForDisplay(expected),
  };
}

function buildCheckpoint(currentTest) {
  return [
    '╔══════════════════════════════════════════════════════════════╗',
    '║  CHECKPOINT: Verification Required                           ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `**Test ${currentTest.number}: ${currentTest.name}**`,
    '',
    currentTest.expected,
    '',
    '──────────────────────────────────────────────────────────────',
    'Type `pass` or describe what\'s wrong.',
    '──────────────────────────────────────────────────────────────',
  ].join('\n');
}

function parseUatItems(content) {
  const items = [];
  // Match test blocks: ### N. Name\nexpected: ...\nresult: ...\n
  // Accept both bare (result: pending) and bracketed (result: [pending]) formats (#2273)
  const testPattern = /###\s*(\d+)\.\s*([^\n]+)\nexpected:\s*([^\n]+)\nresult:\s*\[?(\w+)\]?(?:\n(?:reported|reason|blocked_by):\s*[^\n]*)?/g;
  let match;
  while ((match = testPattern.exec(content)) !== null) {
    const [, num, name, expected, result] = match;
    if (result === 'pending' || result === 'skipped' || result === 'blocked') {
      // Extract optional fields — limit to current test block (up to next ### or EOF)
      const afterMatch = content.slice(match.index);
      const nextHeading = afterMatch.indexOf('\n###', 1);
      const blockText = nextHeading > 0 ? afterMatch.slice(0, nextHeading) : afterMatch;
      const reasonMatch = blockText.match(/reason:\s*(.+)/);
      const blockedByMatch = blockText.match(/blocked_by:\s*(.+)/);

      const item = {
        test: parseInt(num, 10),
        name: name.trim(),
        expected: expected.trim(),
        result,
        category: categorizeItem(result, reasonMatch?.[1], blockedByMatch?.[1]),
      };
      if (reasonMatch) item.reason = reasonMatch[1].trim();
      if (blockedByMatch) item.blocked_by = blockedByMatch[1].trim();
      items.push(item);
    }
  }
  return items;
}

function parseVerificationItems(content, status) {
  const items = [];
  if (status === 'human_needed') {
    // Extract from human_verification section — look for numbered items or table rows
    const hvSection = content.match(/##\s*Human Verification.*?\n([\s\S]*?)(?=\n##\s|\n---\s|$)/i);
    if (hvSection) {
      const lines = hvSection[1].split('\n');
      for (const line of lines) {
        // Match table rows: | N | description | ... |
        const tableMatch = line.match(/\|\s*(\d+)\s*\|\s*([^|]+)/);
        // Match bullet items: - description
        const bulletMatch = line.match(/^[-*]\s+(.+)/);
        // Match numbered items: 1. description
        const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);

        if (tableMatch) {
          // Skip rows that already have a passing result (PASS, pass, resolved, etc.)
          const rowRemainder = line.slice(tableMatch.index + tableMatch[0].length);
          const cellValues = rowRemainder.split('|').map(c => c.trim());
          const hasPassResult = cellValues.some(c => /^pass$/i.test(c) || /^resolved$/i.test(c));
          if (hasPassResult) continue;
          items.push({
            test: parseInt(tableMatch[1], 10),
            name: tableMatch[2].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        } else if (numberedMatch) {
          items.push({
            test: parseInt(numberedMatch[1], 10),
            name: numberedMatch[2].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        } else if (bulletMatch && bulletMatch[1].length > 10) {
          items.push({
            name: bulletMatch[1].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        }
      }
    }
  }
  // gaps_found items are already handled by plan-phase --gaps pipeline
  return items;
}

function categorizeItem(result, reason, blockedBy) {
  if (result === 'blocked' || blockedBy) {
    if (blockedBy) {
      if (/server/i.test(blockedBy)) return 'server_blocked';
      if (/device|physical/i.test(blockedBy)) return 'device_needed';
      if (/build|release|preview/i.test(blockedBy)) return 'build_needed';
      if (/third.party|twilio|stripe/i.test(blockedBy)) return 'third_party';
    }
    return 'blocked';
  }
  if (result === 'skipped') {
    if (reason) {
      if (/server|not running|not available/i.test(reason)) return 'server_blocked';
      if (/simulator|physical|device/i.test(reason)) return 'device_needed';
      if (/build|release|preview/i.test(reason)) return 'build_needed';
    }
    return 'skipped_unresolved';
  }
  if (result === 'pending') return 'pending';
  if (result === 'human_needed') return 'human_uat';
  return 'unknown';
}

module.exports = {
  cmdAuditUat,
  cmdRenderCheckpoint,
  parseCurrentTest,
  buildCheckpoint,
};
