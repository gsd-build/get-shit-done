#!/usr/bin/env node

const TRUSTED_AUTHOR_ASSOCIATIONS = new Set([
  'CONTRIBUTOR',
  'COLLABORATOR',
  'MEMBER',
  'OWNER',
]);

const DEFAULT_TEMPLATE_MARKERS = [
  'Wrong template',
  'Every PR must use a typed template',
  'Select the template that matches your PR',
];

const TEMPLATES = [
  {
    name: 'fix',
    heading: 'Fix PR',
    requiredHeadings: [
      'Fix PR',
      'Linked Issue',
      'What was broken',
      'What this fix does',
      'Testing',
      'Checklist',
    ],
  },
  {
    name: 'enhancement',
    heading: 'Enhancement PR',
    requiredHeadings: [
      'Enhancement PR',
      'Linked Issue',
      'What this enhancement improves',
      'Before / After',
      'How it was implemented',
      'Testing',
      'Scope confirmation',
      'Checklist',
    ],
  },
  {
    name: 'feature',
    heading: 'Feature PR',
    requiredHeadings: [
      'Feature PR',
      'Linked Issue',
      'Feature summary',
      'What changed',
      'Implementation notes',
      'Spec compliance',
      'Testing',
      'Scope confirmation',
      'Checklist',
    ],
  },
];

function stripMarkdownDecoration(value) {
  return value
    .replace(/^\s*#+\s*/, '')
    .replace(/\s*#+\s*$/, '')
    .replace(/\*\*/g, '')
    .trim()
    .toLowerCase();
}

function extractHeadings(body) {
  const headings = new Set();
  for (const line of String(body || '').split(/\r?\n/)) {
    if (/^\s*#{1,6}\s+\S/.test(line)) {
      headings.add(stripMarkdownDecoration(line));
    }
  }
  return headings;
}

function includesDefaultTemplate(body) {
  const text = String(body || '').toLowerCase();
  return DEFAULT_TEMPLATE_MARKERS.some((marker) => text.includes(marker.toLowerCase()));
}

function matchingTemplate(body) {
  const headings = extractHeadings(body);
  for (const template of TEMPLATES) {
    if (!headings.has(stripMarkdownDecoration(template.heading))) continue;
    const missingHeadings = template.requiredHeadings.filter((heading) => {
      return !headings.has(stripMarkdownDecoration(heading));
    });
    return {
      template: template.name,
      missingHeadings,
    };
  }
  return {
    template: null,
    missingHeadings: [],
  };
}

function evaluatePrTemplate(body, authorAssociation) {
  const association = String(authorAssociation || '').toUpperCase();
  const trusted = TRUSTED_AUTHOR_ASSOCIATIONS.has(association);
  const normalizedBody = String(body || '').trim();

  let valid = true;
  let reason = 'PR body uses a typed pull request template.';
  let template = null;
  let missingHeadings = [];

  if (!normalizedBody) {
    valid = false;
    reason = 'PR body is empty; a typed pull request template is required.';
  } else if (includesDefaultTemplate(normalizedBody)) {
    valid = false;
    reason = 'PR body still contains the default wrong-template guidance.';
  } else {
    const match = matchingTemplate(normalizedBody);
    template = match.template;
    missingHeadings = match.missingHeadings;
    if (!template) {
      valid = false;
      reason = 'PR body does not match the fix, enhancement, or feature template.';
    } else if (missingHeadings.length > 0) {
      valid = false;
      reason = `PR body appears to use the ${template} template but is missing required headings.`;
    }
  }

  let action = 'pass';
  if (!valid) {
    action = trusted ? 'warn' : 'close';
  }

  return {
    valid,
    action,
    trusted,
    authorAssociation: association || 'UNKNOWN',
    template,
    reason,
    missingHeadings,
  };
}

function main() {
  const result = evaluatePrTemplate(process.env.PR_BODY || '', process.env.AUTHOR_ASSOCIATION || '');
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    const fs = require('fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `result=${JSON.stringify(result)}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `action=${result.action}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `valid=${result.valid ? 'true' : 'false'}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  evaluatePrTemplate,
  extractHeadings,
  includesDefaultTemplate,
  matchingTemplate,
};
