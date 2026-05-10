'use strict';

const cp = require('node:child_process');
const path = require('node:path');

const { parseFragment } = require('./parse.cjs');

const SECTION_ORDER = ['Fixed', 'Added', 'Changed', 'Deprecated', 'Removed', 'Security'];

const FIXED_GROUPS = [
  {
    title: 'Verification, update & review safety',
    pattern: /\b(verifier|verification|verify|probe|probes|debt|tbd|fixme|xxx|detect-custom-files|review|summary|blocker|critical)\b/i,
  },
  {
    title: 'State, planning & execution',
    pattern: /\b(state|planning|planner|plan-phase|phase|roadmap|execute|executor|worktree|worktrees|resolve-model|init\.progress|model override|human_needed|ship preflight)\b/i,
  },
  {
    title: 'Install & runtime conversion',
    pattern: /\b(install|installer|runtime|windows|powershell|codex|gemini|antigravity|hook|hooks|gsd-sdk|sdk readiness|cjs|model-catalog|path|shim)\b/i,
  },
];

const REMOVED_GROUPS = [
  {
    title: 'Intel updater',
    pattern: /\b(intel|gsd-intel-updater|layout detection)\b/i,
  },
];

function runGit(repo, args) {
  return cp.execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function validateGitRef({ repo, ref, label }) {
  if (typeof ref !== 'string' || ref.trim() !== ref || ref.length === 0) {
    throw new Error(`Invalid git ref for ${label}: expected a non-empty trimmed string`);
  }
  if (
    ref.startsWith('-') ||
    ref.includes('..') ||
    ref.includes('//') ||
    !/^[A-Za-z0-9._/-]+$/.test(ref)
  ) {
    throw new Error(`Invalid git ref for ${label}: ${ref}`);
  }
  runGit(repo, ['rev-parse', '--verify', `${ref}^{commit}`]);
  return ref;
}

function changedFragmentPaths({ repo, fromRef, toRef }) {
  const from = validateGitRef({ repo, ref: fromRef, label: 'fromRef' });
  const to = validateGitRef({ repo, ref: toRef, label: 'toRef' });
  const out = runGit(repo, ['diff', '--name-only', `${from}..${to}`, '--', '.changeset']);
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => /^\.changeset\/[^/]+\.md$/.test(file));
}

function readFileAtRef({ repo, ref, file }) {
  return runGit(repo, ['show', `${ref}:${file}`]);
}

function loadFragmentsFromRange({ repo, fromRef, toRef }) {
  const files = changedFragmentPaths({ repo, fromRef, toRef });
  const fragments = [];
  const failures = [];

  for (const file of files) {
    try {
      const src = readFileAtRef({ repo, ref: toRef, file });
      const parsed = parseFragment(src);
      if (parsed.ok) {
        fragments.push({
          ...parsed.fragment,
          file,
          slug: path.basename(file, '.md'),
        });
      } else {
        failures.push({ file, reason: parsed.reason, detail: parsed.detail || null });
      }
    } catch (e) {
      failures.push({ file, reason: 'read_failed', detail: e.message });
    }
  }

  return { fragments, failures };
}

function classifyGroup(fragment) {
  const haystack = `${fragment.slug || ''}\n${fragment.body || ''}`;
  const groups = fragment.type === 'Removed' ? REMOVED_GROUPS : FIXED_GROUPS;
  const match = groups.find((group) => group.pattern.test(haystack));
  if (match) return match.title;
  if (fragment.type === 'Removed') return 'Removed';
  if (fragment.type === 'Fixed') return 'Other fixes';
  return fragment.type;
}

function buildGithubReleaseNotesIr({ fragments }) {
  const sections = [];
  for (const type of SECTION_ORDER) {
    const typed = fragments.filter((fragment) => fragment.type === type);
    if (typed.length === 0) continue;

    const groupMap = new Map();
    for (const fragment of typed) {
      const groupTitle = classifyGroup(fragment);
      if (!groupMap.has(groupTitle)) groupMap.set(groupTitle, []);
      groupMap.get(groupTitle).push(fragment);
    }

    sections.push({
      type,
      groups: Array.from(groupMap, ([title, bullets]) => ({ title, bullets })),
    });
  }
  return { sections };
}

function formatBullet(fragment) {
  if (!Number.isInteger(fragment.pr) || fragment.pr <= 0) {
    throw new Error(`Fragment ${fragment.slug || fragment.file || '<unknown>'} missing valid pr field`);
  }
  const body = `${fragment.body.trim()} (#${fragment.pr})`;
  const lines = body.split(/\r?\n/);
  return lines.map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`)).join('\n');
}

function compareUrl({ repoSlug, fromRef, toRef }) {
  const normalizedSlug = String(repoSlug || '').trim();
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(normalizedSlug)) {
    throw new Error(`Invalid repoSlug format: ${repoSlug} (expected "owner/repo")`);
  }
  return `https://github.com/${normalizedSlug}/compare/${fromRef}...${toRef}`;
}

function serializeGithubReleaseNotes({
  ir,
  fromRef,
  toRef,
  repoSlug = 'gsd-build/get-shit-done',
  installCommand = 'npx get-shit-done-cc@latest',
}) {
  if (installCommand.includes('`')) {
    throw new Error('installCommand cannot contain backtick characters');
  }
  const lines = [];
  for (const section of ir.sections) {
    lines.push(`## ${section.type}`);
    lines.push('');
    for (const group of section.groups) {
      lines.push(`### ${group.title}`);
      for (const bullet of group.bullets) {
        lines.push(formatBullet(bullet));
      }
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(`Install/upgrade: \`${installCommand}\``);
  lines.push('');
  lines.push(`**Full Changelog**: ${compareUrl({ repoSlug, fromRef, toRef })}`);
  lines.push('');
  return lines.join('\n');
}

function renderGithubReleaseNotes(options) {
  const { fragments, failures } = loadFragmentsFromRange(options);
  if (failures.length > 0) {
    return { ok: false, fragments, failures, body: null };
  }
  const ir = buildGithubReleaseNotesIr({ fragments });
  return {
    ok: true,
    fragments,
    failures: [],
    ir,
    body: serializeGithubReleaseNotes({ ir, ...options }),
  };
}

module.exports = {
  changedFragmentPaths,
  loadFragmentsFromRange,
  buildGithubReleaseNotesIr,
  serializeGithubReleaseNotes,
  renderGithubReleaseNotes,
  classifyGroup,
  validateGitRef,
};
