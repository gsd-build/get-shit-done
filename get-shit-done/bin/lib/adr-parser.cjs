'use strict';

const fs = require('fs');
const path = require('path');
const { requireSafePath } = require('./security.cjs');

const STATUS_REJECT_SET = new Set(['superseded', 'rejected', 'deprecated']);

const CANONICAL_HEADERS = {
  status: ['status', 'state', 'lifecycle', 'stage'],
  goal: [
    'context',
    'background',
    'problem statement',
    'problem',
    'situation',
    'forces',
    'motivation',
    'issue',
    'drivers',
    'pain points',
    'story',
    'setting',
    'premise',
    'status quo',
    'context and problem statement',
  ],
  decisions: [
    'decision',
    'decisions',
    'resolution',
    'conclusion',
    'choice',
    'we decided',
    'direction',
    'approach',
    'solution',
    'outcome',
    'selected option',
    'recommendation',
    'strategy',
    'decision outcome',
  ],
  considered_options: [
    'considered options',
    'alternatives',
    'options',
    'choices',
    'candidates',
    'approaches considered',
    'variants',
    'trade-offs',
    'pros and cons of the options',
    'discussion',
  ],
  risks: [
    'risks',
    'trade-offs',
    'drawbacks',
    'cost',
    'tensions',
    'liabilities',
    'negative consequences',
    'side effects',
  ],
  success_criteria: [
    'success criteria',
    'acceptance criteria',
    'validation',
    "how we'll know",
    'metrics',
    'kpis',
    'verification',
    'test strategy',
    'compliance',
    'definition of done',
    'exit criteria',
    'positive consequences',
  ],
  plan_sequence: [
    'implementation plan',
    'implementation notes',
    'steps',
    'tasks',
    'roadmap',
    'sequence',
    'migration plan',
    'plan',
    'action items',
    'work breakdown',
    'phases',
    'milestones',
    'stages',
  ],
  key_files: [
    'affected files',
    'files touched',
    'surface area',
    'modules affected',
    'code locations',
    'file changes',
    'diff summary',
    'touched code',
  ],
  out_of_scope: [
    'out of scope',
    'non-goals',
    'excluded',
    'not in this adr',
    'out of bounds',
    "won't do",
    "won't have",
    'beyond scope',
    'anti-goals',
  ],
  deferred: [
    'future work',
    'deferred',
    'future',
    'later',
    'follow-up',
    'next steps',
  ],
  dependencies: [
    'dependencies',
    'depends on',
    'prerequisites',
    'sequencing',
    'order',
    'blocked by',
    'cross-cuts',
    'related adrs',
    'links',
    'references',
    'see also',
    'upstream',
    'inbound',
  ],
  update: [
    'update',
    'revision',
    'amendment',
    'locked design',
    'final decision',
    'post-grilling',
    'addendum',
  ],
  consequences: [
    'consequences',
    'implications',
    'impact',
    'what this means',
    'result',
  ],
};

const CONSEQUENCE_NEGATIVE_HINTS = [
  'negative',
  'drawback',
  'risk',
  'cost',
  'liability',
  'trade-off',
  'tension',
  'side effect',
];

const CONSEQUENCE_POSITIVE_HINTS = [
  'positive',
  'success',
  'metric',
  'kpi',
  'verification',
  'acceptance',
  'benefit',
];

function normalizeAdrHeader(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s:._-]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function classifyHeader(normalizedHeader) {
  for (const [canonical, synonyms] of Object.entries(CANONICAL_HEADERS)) {
    for (const synonym of synonyms) {
      if (normalizedHeader === synonym) return canonical;
      if (normalizedHeader.startsWith(`${synonym} `)) return canonical;
    }
  }
  return null;
}

function splitEntries(blockText) {
  return String(blockText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*+]\s+/, '').trim())
    .filter(Boolean);
}

function parseSections(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const sections = [];
  let current = { heading: null, body: [] };

  for (const line of lines) {
    const m = line.match(/^#{1,6}\s+(.*)$/);
    if (m) {
      if (current.heading || current.body.length) sections.push(current);
      current = { heading: m[1].trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }

  if (current.heading || current.body.length) sections.push(current);
  return sections;
}

function parseStatusFromSections(sections) {
  for (const section of sections) {
    const canonical = classifyHeader(normalizeAdrHeader(section.heading));
    if (canonical !== 'status') continue;
    const line = splitEntries(section.body.join('\n'))[0] || '';
    const norm = normalizeAdrHeader(line);
    if (!norm) return '';
    if (norm.includes('accepted')) return 'accepted';
    if (norm.includes('proposed')) return 'proposed';
    if (norm.includes('superseded')) return 'superseded';
    if (norm.includes('rejected')) return 'rejected';
    if (norm.includes('deprecated')) return 'deprecated';
    return norm;
  }
  return '';
}

function pushUnique(target, values) {
  const seen = new Set(target);
  for (const value of values) {
    if (!seen.has(value)) {
      target.push(value);
      seen.add(value);
    }
  }
}

function parseConsequences(lines, out) {
  for (const entry of lines) {
    const lower = entry.toLowerCase();
    if (CONSEQUENCE_NEGATIVE_HINTS.some((hint) => lower.includes(hint))) {
      out.consequences_negative.push(entry);
      continue;
    }
    if (CONSEQUENCE_POSITIVE_HINTS.some((hint) => lower.includes(hint))) {
      out.consequences_positive.push(entry);
      continue;
    }
    out.consequences_positive.push(entry);
  }
}

function parseAdrMarkdown(markdown, { sourcePath = '', format = 'auto' } = {}) {
  const sections = parseSections(markdown);
  const titleLine = String(markdown || '').split(/\r?\n/).find((line) => /^#\s+/.test(line)) || '';
  const title = titleLine.replace(/^#\s+/, '').trim();

  const out = {
    title,
    status: parseStatusFromSections(sections) || 'accepted',
    context: '',
    decisions: [],
    options_considered: [],
    consequences_positive: [],
    consequences_negative: [],
    out_of_scope: [],
    deferred: [],
    dependencies: [],
    updates: [],
    source_path: sourcePath,
    key_files: [],
    plan_sequence: [],
    format,
    unmapped_headers: [],
  };

  for (const section of sections) {
    const heading = section.heading || '';
    if (!heading) continue;
    const canonical = classifyHeader(normalizeAdrHeader(heading));
    const entries = splitEntries(section.body.join('\n'));
    const prose = section.body.join('\n').trim();

    if (!canonical) {
      out.unmapped_headers.push(heading);
      continue;
    }

    switch (canonical) {
      case 'goal':
        if (!out.context && prose) out.context = prose;
        break;
      case 'decisions':
        pushUnique(out.decisions, entries);
        break;
      case 'considered_options':
        pushUnique(out.options_considered, entries);
        break;
      case 'risks':
        pushUnique(out.consequences_negative, entries);
        break;
      case 'success_criteria':
        pushUnique(out.consequences_positive, entries);
        break;
      case 'plan_sequence':
        pushUnique(out.plan_sequence, entries);
        break;
      case 'key_files':
        pushUnique(out.key_files, entries);
        break;
      case 'out_of_scope':
        pushUnique(out.out_of_scope, entries);
        break;
      case 'deferred':
        pushUnique(out.deferred, entries);
        break;
      case 'dependencies':
        pushUnique(out.dependencies, entries);
        break;
      case 'update':
        out.updates.push({ heading, entries });
        break;
      case 'consequences':
        parseConsequences(entries, out);
        break;
      default:
        break;
    }
  }

  return out;
}

function shouldRejectAdrStatus(status) {
  return STATUS_REJECT_SET.has(normalizeAdrHeader(status));
}

function parseCliArgs(argv) {
  const opts = { input: null, format: 'auto', projectDir: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') {
      opts.input = argv[++i] || null;
    } else if (arg === '--format') {
      opts.format = argv[++i] || 'auto';
    } else if (arg === '--project-dir') {
      opts.projectDir = argv[++i] || process.cwd();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.input) {
    throw new Error('Missing required --input <path>');
  }
  return opts;
}

function main(argv) {
  const opts = parseCliArgs(argv);
  const safePath = requireSafePath(opts.input, path.resolve(opts.projectDir), 'ADR input path', { allowAbsolute: true });
  const content = fs.readFileSync(safePath, 'utf8');
  const parsed = parseAdrMarkdown(content, { sourcePath: opts.input, format: opts.format });
  process.stdout.write(JSON.stringify(parsed, null, 2));
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  CANONICAL_HEADERS,
  normalizeAdrHeader,
  parseAdrMarkdown,
  shouldRejectAdrStatus,
};
