/**
 * Template — Template selection and fill operations
 */

const fs = require('fs');
const path = require('path');
const { normalizePhaseName, findPhaseInternal, generateSlugInternal, output, error } = require('./core.cjs');
const { reconstructFrontmatter } = require('./frontmatter.cjs');

function cmdTemplateSelect(cwd, planPath, raw) {
  if (!planPath) {
    error('plan-path required');
  }

  try {
    const fullPath = path.join(cwd, planPath);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Simple heuristics
    const taskMatch = content.match(/###\s*Task\s*\d+/g) || [];
    const taskCount = taskMatch.length;

    const decisionMatch = content.match(/decision/gi) || [];
    const hasDecisions = decisionMatch.length > 0;

    // Count file mentions
    const fileMentions = new Set();
    const filePattern = /`([^`]+\.[a-zA-Z]+)`/g;
    let m;
    while ((m = filePattern.exec(content)) !== null) {
      if (m[1].includes('/') && !m[1].startsWith('http')) {
        fileMentions.add(m[1]);
      }
    }
    const fileCount = fileMentions.size;

    let template = 'templates/summary-standard.md';
    let type = 'standard';

    if (taskCount <= 2 && fileCount <= 3 && !hasDecisions) {
      template = 'templates/summary-minimal.md';
      type = 'minimal';
    } else if (hasDecisions || fileCount > 6 || taskCount > 5) {
      template = 'templates/summary-complex.md';
      type = 'complex';
    }

    const result = { template, type, taskCount, fileCount, hasDecisions };
    output(result, raw, template);
  } catch (e) {
    // Fallback to standard
    output({ template: 'templates/summary-standard.md', type: 'standard', error: e.message }, raw, 'templates/summary-standard.md');
  }
}

function cmdTemplateFill(cwd, templateType, options, raw) {
  if (!templateType) { error('template type required: summary, plan, or verification'); }
  if (!options.phase) { error('--phase required'); }

  const phaseInfo = findPhaseInternal(cwd, options.phase);
  if (!phaseInfo || !phaseInfo.found) { output({ error: 'Phase not found', phase: options.phase }, raw); return; }

  const padded = normalizePhaseName(options.phase);
  const today = new Date().toISOString().split('T')[0];
  const phaseName = options.name || phaseInfo.phase_name || 'Unnamed';
  const phaseSlug = phaseInfo.phase_slug || generateSlugInternal(phaseName);
  const phaseId = `${padded}-${phaseSlug}`;
  const planNum = (options.plan || '01').padStart(2, '0');
  const fields = options.fields || {};

  let frontmatter, body, fileName;

  switch (templateType) {
    case 'summary': {
      frontmatter = {
        phase: phaseId,
        plan: planNum,
        subsystem: '[primary category]',
        tags: [],
        provides: [],
        affects: [],
        'tech-stack': { added: [], patterns: [] },
        'key-files': { created: [], modified: [] },
        'key-decisions': [],
        'patterns-established': [],
        duration: '[X]min',
        completed: today,
        ...fields,
      };
      body = [
        `# Phase ${options.phase}: ${phaseName} Summary`,
        '',
        '**[Substantive one-liner describing outcome]**',
        '',
        '## Performance',
        '- **Duration:** [time]',
        '- **Tasks:** [count completed]',
        '- **Files modified:** [count]',
        '',
        '## Accomplishments',
        '- [Key outcome 1]',
        '- [Key outcome 2]',
        '',
        '## Task Commits',
        '1. **Task 1: [task name]** - `hash`',
        '',
        '## Files Created/Modified',
        '- `path/to/file.ts` - What it does',
        '',
        '## Decisions & Deviations',
        '[Key decisions or "None - followed plan as specified"]',
        '',
        '## Next Phase Readiness',
        '[What\'s ready for next phase]',
      ].join('\n');
      fileName = `${padded}-${planNum}-SUMMARY.md`;
      break;
    }
    case 'plan': {
      const planType = options.type || 'execute';
      const wave = parseInt(options.wave) || 1;
      frontmatter = {
        phase: phaseId,
        plan: planNum,
        type: planType,
        wave,
        depends_on: [],
        files_modified: [],
        autonomous: true,
        user_setup: [],
        must_haves: { truths: [], artifacts: [], key_links: [] },
        ...fields,
      };
      body = [
        `# Phase ${options.phase} Plan ${planNum}: [Title]`,
        '',
        '## Objective',
        '- **What:** [What this plan builds]',
        '- **Why:** [Why it matters for the phase goal]',
        '- **Output:** [Concrete deliverable]',
        '',
        '## Context',
        '@.planning/PROJECT.md',
        '@.planning/ROADMAP.md',
        '@.planning/STATE.md',
        '',
        '## Tasks',
        '',
        '<task type="code">',
        '  <name>[Task name]</name>',
        '  <files>[file paths]</files>',
        '  <action>[What to do]</action>',
        '  <verify>[How to verify]</verify>',
        '  <done>[Definition of done]</done>',
        '</task>',
        '',
        '## Verification',
        '[How to verify this plan achieved its objective]',
        '',
        '## Success Criteria',
        '- [ ] [Criterion 1]',
        '- [ ] [Criterion 2]',
      ].join('\n');
      fileName = `${padded}-${planNum}-PLAN.md`;
      break;
    }
    case 'verification': {
      frontmatter = {
        phase: phaseId,
        verified: new Date().toISOString(),
        status: 'pending',
        score: '0/0 must-haves verified',
        ...fields,
      };
      body = [
        `# Phase ${options.phase}: ${phaseName} — Verification`,
        '',
        '## Observable Truths',
        '| # | Truth | Status | Evidence |',
        '|---|-------|--------|----------|',
        '| 1 | [Truth] | pending | |',
        '',
        '## Required Artifacts',
        '| Artifact | Expected | Status | Details |',
        '|----------|----------|--------|---------|',
        '| [path] | [what] | pending | |',
        '',
        '## Key Link Verification',
        '| From | To | Via | Status | Details |',
        '|------|----|----|--------|---------|',
        '| [source] | [target] | [connection] | pending | |',
        '',
        '## Requirements Coverage',
        '| Requirement | Status | Blocking Issue |',
        '|-------------|--------|----------------|',
        '| [req] | pending | |',
        '',
        '## Result',
        '[Pending verification]',
      ].join('\n');
      fileName = `${padded}-VERIFICATION.md`;
      break;
    }
    default:
      error(`Unknown template type: ${templateType}. Available: summary, plan, verification`);
      return;
  }

  const fullContent = `---\n${reconstructFrontmatter(frontmatter)}\n---\n\n${body}\n`;
  const outPath = path.join(cwd, phaseInfo.directory, fileName);

  if (fs.existsSync(outPath)) {
    output({ error: 'File already exists', path: path.relative(cwd, outPath) }, raw);
    return;
  }

  fs.writeFileSync(outPath, fullContent, 'utf-8');
  const relPath = path.relative(cwd, outPath);
  output({ created: true, path: relPath, template: templateType }, raw, relPath);
}

module.exports = { cmdTemplateSelect, cmdTemplateFill };
