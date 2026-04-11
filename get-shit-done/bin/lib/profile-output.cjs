/**
 * Profile Output — profile rendering, questionnaire, and artifact generation
 *
 * Renders profiling analysis into user-facing artifacts:
 *   - write-profile: USER-PROFILE.md from analysis JSON
 *   - profile-questionnaire: fallback when no sessions available
 *   - generate-dev-preferences: dev-preferences.md command artifact
 *   - generate-claude-profile: Developer Profile section in CLAUDE.md
 *   - generate-claude-md: full CLAUDE.md with managed sections
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { output, error, safeReadFile, loadConfig } = require('./core.cjs');

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMENSION_KEYS = [
  'communication_style', 'decision_speed', 'explanation_depth',
  'debugging_approach', 'ux_philosophy', 'vendor_philosophy',
  'frustration_triggers', 'learning_style'
];

const PROFILING_QUESTIONS = [
  {
    dimension: 'communication_style',
    header: 'Communication Style',
    context: 'Think about the last few times you asked Claude to build or change something. How did you frame the request?',
    question: 'When you ask Claude to build something, how much context do you typically provide?',
    options: [
      { label: 'Minimal -- "fix the bug", "add dark mode", just say what\'s needed', value: 'a', rating: 'terse-direct' },
      { label: 'Some context -- explain what and why in a paragraph or two', value: 'b', rating: 'conversational' },
      { label: 'Detailed specs -- headers, numbered lists, problem analysis, constraints', value: 'c', rating: 'detailed-structured' },
      { label: 'It depends on the task -- simple tasks get short prompts, complex ones get detailed specs', value: 'd', rating: 'mixed' },
    ],
  },
  {
    dimension: 'decision_speed',
    header: 'Decision Making',
    context: 'Think about times when Claude presented you with multiple options -- like choosing a library, picking an architecture, or selecting an approach.',
    question: 'When Claude presents you with options, how do you typically decide?',
    options: [
      { label: 'Pick quickly based on gut feeling or past experience', value: 'a', rating: 'fast-intuitive' },
      { label: 'Ask for a comparison table or pros/cons, then decide', value: 'b', rating: 'deliberate-informed' },
      { label: 'Research independently (read docs, check GitHub stars) before deciding', value: 'c', rating: 'research-first' },
      { label: 'Let Claude recommend -- I generally trust the suggestion', value: 'd', rating: 'delegator' },
    ],
  },
  {
    dimension: 'explanation_depth',
    header: 'Explanation Preferences',
    context: 'Think about when Claude explains code it wrote or an approach it took. How much detail feels right?',
    question: 'When Claude explains something, how much detail do you want?',
    options: [
      { label: 'Just the code -- I\'ll read it and figure it out myself', value: 'a', rating: 'code-only' },
      { label: 'Brief explanation with the code -- a sentence or two about the approach', value: 'b', rating: 'concise' },
      { label: 'Detailed walkthrough -- explain the approach, trade-offs, and code structure', value: 'c', rating: 'detailed' },
      { label: 'Deep dive -- teach me the concepts behind it so I understand the fundamentals', value: 'd', rating: 'educational' },
    ],
  },
  {
    dimension: 'debugging_approach',
    header: 'Debugging Style',
    context: 'Think about the last few times something broke in your code. How did you approach it with Claude?',
    question: 'When something breaks, how do you typically approach debugging with Claude?',
    options: [
      { label: 'Paste the error and say "fix it" -- get it working fast', value: 'a', rating: 'fix-first' },
      { label: 'Share the error plus context, ask Claude to diagnose what went wrong', value: 'b', rating: 'diagnostic' },
      { label: 'Investigate myself first, then ask Claude about my specific theories', value: 'c', rating: 'hypothesis-driven' },
      { label: 'Walk through the code together step by step to understand the issue', value: 'd', rating: 'collaborative' },
    ],
  },
  {
    dimension: 'ux_philosophy',
    header: 'UX Philosophy',
    context: 'Think about user-facing features you have built recently. How did you balance functionality with design?',
    question: 'When building user-facing features, what do you prioritize?',
    options: [
      { label: 'Get it working first, polish the UI later (or never)', value: 'a', rating: 'function-first' },
      { label: 'Basic usability from the start -- nothing ugly, but no pixel-perfection', value: 'b', rating: 'pragmatic' },
      { label: 'Design and UX are as important as functionality -- I care about the experience', value: 'c', rating: 'design-conscious' },
      { label: 'I mostly build backend, CLI, or infrastructure -- UX is minimal', value: 'd', rating: 'backend-focused' },
    ],
  },
  {
    dimension: 'vendor_philosophy',
    header: 'Library & Vendor Choices',
    context: 'Think about the last time you needed a library or service for a project. How did you go about choosing it?',
    question: 'When choosing libraries or services, what is your typical approach?',
    options: [
      { label: 'Use whatever Claude suggests -- speed matters more than the perfect choice', value: 'a', rating: 'pragmatic-fast' },
      { label: 'Prefer well-known, battle-tested options (React, PostgreSQL, Express)', value: 'b', rating: 'conservative' },
      { label: 'Research alternatives, read docs, compare benchmarks before committing', value: 'c', rating: 'thorough-evaluator' },
      { label: 'Strong opinions -- I already know what I like and I stick with it', value: 'd', rating: 'opinionated' },
    ],
  },
  {
    dimension: 'frustration_triggers',
    header: 'Frustration Triggers',
    context: 'Think about moments when working with AI coding assistants that made you frustrated or annoyed.',
    question: 'What frustrates you most when working with AI coding assistants?',
    options: [
      { label: 'Doing things I didn\'t ask for -- adding features, refactoring code, scope creep', value: 'a', rating: 'scope-creep' },
      { label: 'Not following instructions precisely -- ignoring constraints or requirements I stated', value: 'b', rating: 'instruction-adherence' },
      { label: 'Over-explaining or being too verbose -- just give me the code and move on', value: 'c', rating: 'verbosity' },
      { label: 'Breaking working code while fixing something else -- regressions', value: 'd', rating: 'regression' },
    ],
  },
  {
    dimension: 'learning_style',
    header: 'Learning Preferences',
    context: 'Think about encountering something new -- an unfamiliar library, a codebase you inherited, a concept you hadn\'t used before.',
    question: 'When you encounter something new in your codebase, how do you prefer to learn about it?',
    options: [
      { label: 'Read the code directly -- I figure things out by reading and experimenting', value: 'a', rating: 'self-directed' },
      { label: 'Ask Claude to explain the relevant parts to me', value: 'b', rating: 'guided' },
      { label: 'Read official docs and tutorials first, then try things', value: 'c', rating: 'documentation-first' },
      { label: 'See a working example, then modify it to understand how it works', value: 'd', rating: 'example-driven' },
    ],
  },
];

const CLAUDE_INSTRUCTIONS = {
  communication_style: {
    'terse-direct': 'Keep responses concise and action-oriented. Skip lengthy preambles. Match this developer\'s direct style.',
    'conversational': 'Use a natural conversational tone. Explain reasoning briefly alongside code. Engage with the developer\'s questions.',
    'detailed-structured': 'Match this developer\'s structured communication: use headers for sections, numbered lists for steps, and acknowledge provided context before responding.',
    'mixed': 'Adapt response detail to match the complexity of each request. Brief for simple tasks, detailed for complex ones.',
  },
  decision_speed: {
    'fast-intuitive': 'Present a single strong recommendation with brief justification. Skip lengthy comparisons unless asked.',
    'deliberate-informed': 'Present options in a structured comparison table with pros/cons. Let the developer make the final call.',
    'research-first': 'Include links to docs, GitHub repos, or benchmarks when recommending tools. Support the developer\'s research process.',
    'delegator': 'Make clear recommendations with confidence. Explain your reasoning briefly, but own the suggestion.',
  },
  explanation_depth: {
    'code-only': 'Prioritize code output. Add comments inline rather than prose explanations. Skip walkthroughs unless asked.',
    'concise': 'Pair code with a brief explanation (1-2 sentences) of the approach. Keep prose minimal.',
    'detailed': 'Explain the approach, key trade-offs, and code structure alongside the implementation. Use headers to organize.',
    'educational': 'Teach the underlying concepts and principles, not just the implementation. Relate new patterns to fundamentals.',
  },
  debugging_approach: {
    'fix-first': 'Prioritize the fix. Show the corrected code first, then optionally explain what was wrong. Minimize diagnostic preamble.',
    'diagnostic': 'Diagnose the root cause before presenting the fix. Explain what went wrong and why the fix addresses it.',
    'hypothesis-driven': 'Engage with the developer\'s theories. Validate or refine their hypotheses before jumping to solutions.',
    'collaborative': 'Walk through the debugging process step by step. Explain the investigation approach, not just the conclusion.',
  },
  ux_philosophy: {
    'function-first': 'Focus on functionality and correctness. Keep UI minimal and functional. Skip design polish unless requested.',
    'pragmatic': 'Build clean, usable interfaces without over-engineering. Apply basic design principles (spacing, alignment, contrast).',
    'design-conscious': 'Invest in UX quality: thoughtful spacing, smooth transitions, responsive layouts. Treat design as a first-class concern.',
    'backend-focused': 'Optimize for developer experience (clear APIs, good error messages, helpful CLI output) over visual design.',
  },
  vendor_philosophy: {
    'pragmatic-fast': 'Suggest libraries quickly based on popularity and reliability. Don\'t over-analyze choices for non-critical dependencies.',
    'conservative': 'Recommend well-established, widely-adopted tools with strong community support. Avoid bleeding-edge options.',
    'thorough-evaluator': 'Compare alternatives with specific metrics (bundle size, GitHub stars, maintenance activity). Support informed decisions.',
    'opinionated': 'Respect the developer\'s existing tool preferences. Ask before suggesting alternatives to their preferred stack.',
  },
  frustration_triggers: {
    'scope-creep': 'Do exactly what is asked -- nothing more. Never add unrequested features, refactoring, or "improvements". Ask before expanding scope.',
    'instruction-adherence': 'Follow instructions precisely. Re-read constraints before responding. If requirements conflict, flag the conflict rather than silently choosing.',
    'verbosity': 'Be concise. Lead with code, follow with brief explanation only if needed. Avoid restating the problem or unnecessary context.',
    'regression': 'Before modifying working code, verify the change is safe. Run existing tests mentally. Flag potential regression risks explicitly.',
  },
  learning_style: {
    'self-directed': 'Point to relevant code sections and let the developer explore. Add signposts (file paths, function names) rather than full explanations.',
    'guided': 'Explain concepts in context of the developer\'s codebase. Use their actual code as examples when teaching.',
    'documentation-first': 'Link to official documentation and relevant sections. Structure explanations like reference material.',
    'example-driven': 'Lead with working code examples. Show a minimal example first, then explain how to extend or modify it.',
  },
};

const CLAUDE_MD_FALLBACKS = {
  project: 'Project not yet initialized. Run /gsd-new-project to set up.',
  stack: 'Technology stack not yet documented. Will populate after codebase mapping or first phase.',
  conventions: 'Conventions not yet established. Will populate as patterns emerge during development.',
  architecture: 'Architecture not yet mapped. Follow existing patterns found in the codebase.',
  skills: 'No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.',
};

// Directories where project skills may live (checked in order)
const SKILL_SEARCH_DIRS = ['.claude/skills', '.agents/skills', '.cursor/skills', '.github/skills'];

const CLAUDE_MD_WORKFLOW_ENFORCEMENT = [
  'Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.',
  '',
  'Use these entry points:',
  '- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks',
  '- `/gsd-debug` for investigation and bug fixing',
  '- `/gsd-execute-phase` for planned phase work',
  '',
  'Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.',
].join('\n');

const CLAUDE_MD_PROFILE_PLACEHOLDER = [
  '<!-- GSD:profile-start -->',
  '## Developer Profile',
  '',
  '> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.',
  '> This section is managed by `generate-claude-profile` -- do not edit manually.',
  '<!-- GSD:profile-end -->',
].join('\n');

// ─── Helper Functions ─────────────────────────────────────────────────────────

function isAmbiguousAnswer(dimension, value) {
  if (dimension === 'communication_style' && value === 'd') return true;
  const question = PROFILING_QUESTIONS.find(q => q.dimension === dimension);
  if (!question) return false;
  const option = question.options.find(o => o.value === value);
  if (!option) return false;
  return option.rating === 'mixed';
}

function generateClaudeInstruction(dimension, rating) {
  const dimInstructions = CLAUDE_INSTRUCTIONS[dimension];
  if (dimInstructions && dimInstructions[rating]) {
    return dimInstructions[rating];
  }
  return `Adapt to this developer's ${dimension.replace(/_/g, ' ')} preference: ${rating}.`;
}

function extractSectionContent(fileContent, sectionName) {
  const startMarker = `<!-- GSD:${sectionName}-start`;
  const endMarker = `<!-- GSD:${sectionName}-end -->`;
  const startIdx = fileContent.indexOf(startMarker);
  const endIdx = fileContent.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return null;
  const startTagEnd = fileContent.indexOf('-->', startIdx);
  if (startTagEnd === -1) return null;
  return fileContent.substring(startTagEnd + 3, endIdx);
}

function buildSection(sectionName, sourceFile, content) {
  return [
    `<!-- GSD:${sectionName}-start source:${sourceFile} -->`,
    content,
    `<!-- GSD:${sectionName}-end -->`,
  ].join('\n');
}

function updateSection(fileContent, sectionName, newContent) {
  const startMarker = `<!-- GSD:${sectionName}-start`;
  const endMarker = `<!-- GSD:${sectionName}-end -->`;
  const startIdx = fileContent.indexOf(startMarker);
  const endIdx = fileContent.indexOf(endMarker);
  if (startIdx !== -1 && endIdx !== -1) {
    const before = fileContent.substring(0, startIdx);
    const after = fileContent.substring(endIdx + endMarker.length);
    return { content: before + newContent + after, action: 'replaced' };
  }
  return { content: fileContent.trimEnd() + '\n\n' + newContent + '\n', action: 'appended' };
}

function detectManualEdit(fileContent, sectionName, expectedContent) {
  const currentContent = extractSectionContent(fileContent, sectionName);
  if (currentContent === null) return false;
  const normalize = (s) => s.trim().replace(/\n{3,}/g, '\n\n');
  return normalize(currentContent) !== normalize(expectedContent);
}

function extractMarkdownSection(content, sectionName) {
  if (!content) return null;
  const lines = content.split('\n');
  let capturing = false;
  const result = [];
  const headingPattern = new RegExp(`^## ${sectionName}\\s*$`);
  for (const line of lines) {
    if (headingPattern.test(line)) {
      capturing = true;
      result.push(line);
      continue;
    }
    if (capturing && /^## /.test(line)) break;
    if (capturing) result.push(line);
  }
  return result.length > 0 ? result.join('\n').trim() : null;
}

// ─── CLAUDE.md Section Generators ─────────────────────────────────────────────

function generateProjectSection(cwd) {
  const projectPath = path.join(cwd, '.planning', 'PROJECT.md');
  const content = safeReadFile(projectPath);
  if (!content) {
    return { content: CLAUDE_MD_FALLBACKS.project, source: 'PROJECT.md', hasFallback: true };
  }
  const parts = [];
  const h1Match = content.match(/^# (.+)$/m);
  if (h1Match) parts.push(`**${h1Match[1]}**`);
  const whatThisIs = extractMarkdownSection(content, 'What This Is');
  if (whatThisIs) {
    const body = whatThisIs.replace(/^## What This Is\s*/i, '').trim();
    if (body) parts.push(body);
  }
  const coreValue = extractMarkdownSection(content, 'Core Value');
  if (coreValue) {
    const body = coreValue.replace(/^## Core Value\s*/i, '').trim();
    if (body) parts.push(`**Core Value:** ${body}`);
  }
  const constraints = extractMarkdownSection(content, 'Constraints');
  if (constraints) {
    const body = constraints.replace(/^## Constraints\s*/i, '').trim();
    if (body) parts.push(`### Constraints\n\n${body}`);
  }
  if (parts.length === 0) {
    return { content: CLAUDE_MD_FALLBACKS.project, source: 'PROJECT.md', hasFallback: true };
  }
  return { content: parts.join('\n\n'), source: 'PROJECT.md', hasFallback: false };
}

function generateStackSection(cwd) {
  const codebasePath = path.join(cwd, '.planning', 'codebase', 'STACK.md');
  const researchPath = path.join(cwd, '.planning', 'research', 'STACK.md');
  let content = safeReadFile(codebasePath);
  let source = 'codebase/STACK.md';
  if (!content) {
    content = safeReadFile(researchPath);
    source = 'research/STACK.md';
  }
  if (!content) {
    return { content: CLAUDE_MD_FALLBACKS.stack, source: 'STACK.md', hasFallback: true };
  }
  const lines = content.split('\n');
  const summaryLines = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('#')) {
      if (!line.startsWith('# ') || summaryLines.length > 0) summaryLines.push(line);
      continue;
    }
    if (line.startsWith('|')) { inTable = true; summaryLines.push(line); continue; }
    if (inTable && line.trim() === '') inTable = false;
    if (line.startsWith('- ') || line.startsWith('* ')) summaryLines.push(line);
  }
  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : content.trim();
  return { content: summary, source, hasFallback: false };
}

function generateConventionsSection(cwd) {
  const conventionsPath = path.join(cwd, '.planning', 'codebase', 'CONVENTIONS.md');
  const content = safeReadFile(conventionsPath);
  if (!content) {
    return { content: CLAUDE_MD_FALLBACKS.conventions, source: 'CONVENTIONS.md', hasFallback: true };
  }
  const lines = content.split('\n');
  const summaryLines = [];
  for (const line of lines) {
    if (line.startsWith('#')) { if (!line.startsWith('# ')) summaryLines.push(line); continue; }
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('|')) summaryLines.push(line);
  }
  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : content.trim();
  return { content: summary, source: 'CONVENTIONS.md', hasFallback: false };
}

function generateArchitectureSection(cwd) {
  const architecturePath = path.join(cwd, '.planning', 'codebase', 'ARCHITECTURE.md');
  const content = safeReadFile(architecturePath);
  if (!content) {
    return { content: CLAUDE_MD_FALLBACKS.architecture, source: 'ARCHITECTURE.md', hasFallback: true };
  }
  const lines = content.split('\n');
  const summaryLines = [];
  for (const line of lines) {
    if (line.startsWith('#')) { if (!line.startsWith('# ')) summaryLines.push(line); continue; }
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('|') || line.startsWith('```')) summaryLines.push(line);
  }
  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : content.trim();
  return { content: summary, source: 'ARCHITECTURE.md', hasFallback: false };
}

function generateWorkflowSection() {
  return {
    content: CLAUDE_MD_WORKFLOW_ENFORCEMENT,
    source: 'GSD defaults',
    hasFallback: false,
  };
}

/**
 * Discover project skills from standard directories and extract frontmatter
 * (name + description) for each. Returns a table summary for CLAUDE.md so
 * agents know which skills are available at session startup (Layer 1 discovery).
 */
function generateSkillsSection(cwd) {
  const discovered = [];

  for (const dir of SKILL_SEARCH_DIRS) {
    const absDir = path.join(cwd, dir);
    if (!fs.existsSync(absDir)) continue;

    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip GSD's own installed skills — only surface project-specific skills
      if (entry.name.startsWith('gsd-')) continue;

      const skillMdPath = path.join(absDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      const content = safeReadFile(skillMdPath);
      if (!content) continue;

      const frontmatter = extractSkillFrontmatter(content);
      const name = frontmatter.name || entry.name;
      const description = frontmatter.description || '';

      // Avoid duplicates when same skill dir is symlinked from multiple locations
      if (discovered.some(s => s.name === name)) continue;

      discovered.push({ name, description, path: `${dir}/${entry.name}` });
    }
  }

  if (discovered.length === 0) {
    return { content: CLAUDE_MD_FALLBACKS.skills, source: 'skills/', hasFallback: true };
  }

  const lines = ['| Skill | Description | Path |', '|-------|-------------|------|'];
  for (const skill of discovered) {
    // Sanitize table cell content (escape pipes)
    const desc = skill.description.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    const safeName = skill.name.replace(/\|/g, '\\|');
    lines.push(`| ${safeName} | ${desc} | \`${skill.path}/SKILL.md\` |`);
  }

  return { content: lines.join('\n'), source: 'skills/', hasFallback: false };
}

/**
 * Extract name and description from YAML-like frontmatter in a SKILL.md file.
 * Handles multi-line description values (continuation lines indented with spaces).
 */
function extractSkillFrontmatter(content) {
  const result = { name: '', description: '' };
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return result;

  const fmBlock = fmMatch[1];
  const lines = fmBlock.split('\n');

  let currentKey = '';
  for (const line of lines) {
    // Top-level key: value
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      if (currentKey === 'name') result.name = value;
      if (currentKey === 'description') result.description = value;
      continue;
    }
    // Continuation line (indented) for multi-line values
    if (currentKey === 'description' && /^\s+/.test(line)) {
      result.description += ' ' + line.trim();
    } else {
      currentKey = '';
    }
  }

  return result;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdWriteProfile(cwd, options, raw) {
  if (!options.input) {
    error('--input <analysis-json-path> is required');
  }

  let analysisPath = options.input;
  if (!path.isAbsolute(analysisPath)) analysisPath = path.join(cwd, analysisPath);
  if (!fs.existsSync(analysisPath)) error(`Analysis file not found: ${analysisPath}`);

  let analysis;
  try {
    analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
  } catch (err) {
    error(`Failed to parse analysis JSON: ${err.message}`);
  }

  if (!analysis.dimensions || typeof analysis.dimensions !== 'object') {
    error('Analysis JSON must contain a "dimensions" object');
  }
  if (!analysis.profile_version) {
    error('Analysis JSON must contain "profile_version"');
  }

  const SENSITIVE_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/g,
    /Bearer\s+[a-zA-Z0-9._-]+/gi,
    /password\s*[:=]\s*\S+/gi,
    /secret\s*[:=]\s*\S+/gi,
    /token\s*[:=]\s*\S+/gi,
    /api[_-]?key\s*[:=]\s*\S+/gi,
    /\/Users\/[a-zA-Z0-9._-]+\//g,
    /\/home\/[a-zA-Z0-9._-]+\//g,
    /ghp_[a-zA-Z0-9]{36}/g,
    /gho_[a-zA-Z0-9]{36}/g,
    /xoxb-[a-zA-Z0-9-]+/g,
  ];

  let redactedCount = 0;

  function redactSensitive(text) {
    if (typeof text !== 'string') return text;
    let result = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = result.match(pattern);
      if (matches) {
        redactedCount += matches.length;
        result = result.replace(pattern, '[REDACTED]');
      }
    }
    return result;
  }

  for (const dimKey of Object.keys(analysis.dimensions)) {
    const dim = analysis.dimensions[dimKey];
    if (dim.evidence && Array.isArray(dim.evidence)) {
      for (let i = 0; i < dim.evidence.length; i++) {
        const ev = dim.evidence[i];
        if (ev.quote) ev.quote = redactSensitive(ev.quote);
        if (ev.example) ev.example = redactSensitive(ev.example);
        if (ev.signal) ev.signal = redactSensitive(ev.signal);
      }
    }
  }

  if (redactedCount > 0) {
    process.stderr.write(`Sensitive content redacted: ${redactedCount} pattern(s) removed from evidence quotes\n`);
  }

  const templatePath = path.join(__dirname, '..', '..', 'templates', 'user-profile.md');
  if (!fs.existsSync(templatePath)) error(`Template not found: ${templatePath}`);
  let template = fs.readFileSync(templatePath, 'utf-8');

  const dimensionLabels = {
    communication_style: 'Communication',
    decision_speed: 'Decisions',
    explanation_depth: 'Explanations',
    debugging_approach: 'Debugging',
    ux_philosophy: 'UX Philosophy',
    vendor_philosophy: 'Vendor Philosophy',
    frustration_triggers: 'Frustration Triggers',
    learning_style: 'Learning Style',
  };

  const summaryLines = [];
  let highCount = 0, mediumCount = 0, lowCount = 0, dimensionsScored = 0;

  for (const dimKey of DIMENSION_KEYS) {
    const dim = analysis.dimensions[dimKey];
    if (!dim) continue;
    const conf = (dim.confidence || '').toUpperCase();
    if (conf === 'HIGH' || conf === 'MEDIUM' || conf === 'LOW') dimensionsScored++;
    if (conf === 'HIGH') {
      highCount++;
      if (dim.claude_instruction) summaryLines.push(`- **${dimensionLabels[dimKey] || dimKey}:** ${dim.claude_instruction} (HIGH)`);
    } else if (conf === 'MEDIUM') {
      mediumCount++;
      if (dim.claude_instruction) summaryLines.push(`- **${dimensionLabels[dimKey] || dimKey}:** ${dim.claude_instruction} (MEDIUM)`);
    } else if (conf === 'LOW') {
      lowCount++;
    }
  }

  const summaryInstructions = summaryLines.length > 0
    ? summaryLines.join('\n')
    : '- No high or medium confidence dimensions scored yet.';

  template = template.replace(/\{\{generated_at\}\}/g, new Date().toISOString());
  template = template.replace(/\{\{data_source\}\}/g, analysis.data_source || 'session_analysis');
  template = template.replace(/\{\{projects_list\}\}/g, (analysis.projects_list || analysis.projects_analyzed || []).join(', '));
  template = template.replace(/\{\{message_count\}\}/g, String(analysis.message_count || analysis.messages_analyzed || 0));
  template = template.replace(/\{\{summary_instructions\}\}/g, summaryInstructions);
  template = template.replace(/\{\{profile_version\}\}/g, analysis.profile_version);
  template = template.replace(/\{\{projects_count\}\}/g, String((analysis.projects_list || analysis.projects_analyzed || []).length));
  template = template.replace(/\{\{dimensions_scored\}\}/g, String(dimensionsScored));
  template = template.replace(/\{\{high_confidence_count\}\}/g, String(highCount));
  template = template.replace(/\{\{medium_confidence_count\}\}/g, String(mediumCount));
  template = template.replace(/\{\{low_confidence_count\}\}/g, String(lowCount));
  template = template.replace(/\{\{sensitive_excluded_summary\}\}/g,
    redactedCount > 0 ? `${redactedCount} pattern(s) redacted` : 'None detected');

  for (const dimKey of DIMENSION_KEYS) {
    const dim = analysis.dimensions[dimKey] || {};
    const rating = dim.rating || 'UNSCORED';
    const confidence = dim.confidence || 'UNSCORED';
    const instruction = dim.claude_instruction || 'No strong preference detected. Ask the developer when this dimension is relevant.';
    const summary = dim.summary || '';

    let evidenceBlock = '';
    const evidenceArr = dim.evidence_quotes || dim.evidence;
    if (evidenceArr && Array.isArray(evidenceArr) && evidenceArr.length > 0) {
      const evidenceLines = evidenceArr.map(ev => {
        const signal = ev.signal || ev.pattern || '';
        const quote = ev.quote || ev.example || '';
        const project = ev.project || 'unknown';
        return `- **Signal:** ${signal} / **Example:** "${quote}" -- project: ${project}`;
      });
      evidenceBlock = evidenceLines.join('\n');
    } else {
      evidenceBlock = '- No evidence collected for this dimension.';
    }

    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.rating\\}\\}`, 'g'), rating);
    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.confidence\\}\\}`, 'g'), confidence);
    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.claude_instruction\\}\\}`, 'g'), instruction);
    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.summary\\}\\}`, 'g'), summary);
    template = template.replace(new RegExp(`\\{\\{${dimKey}\\.evidence\\}\\}`, 'g'), evidenceBlock);
  }

  let outputPath = options.output;
  if (!outputPath) {
    outputPath = path.join(os.homedir(), '.claude', 'get-shit-done', 'USER-PROFILE.md');
  } else if (!path.isAbsolute(outputPath)) {
    outputPath = path.join(cwd, outputPath);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, template, 'utf-8');

  const result = {
    profile_path: outputPath,
    dimensions_scored: dimensionsScored,
    high_confidence: highCount,
    medium_confidence: mediumCount,
    low_confidence: lowCount,
    sensitive_redacted: redactedCount,
    source: analysis.data_source || 'session_analysis',
  };

  output(result, raw);
}

function cmdProfileQuestionnaire(options, raw) {
  if (!options.answers) {
    const questionsOutput = {
      mode: 'interactive',
      questions: PROFILING_QUESTIONS.map(q => ({
        dimension: q.dimension,
        header: q.header,
        context: q.context,
        question: q.question,
        options: q.options.map(o => ({ label: o.label, value: o.value })),
      })),
    };
    output(questionsOutput, raw);
    return;
  }

  const answerValues = options.answers.split(',').map(a => a.trim());
  if (answerValues.length !== PROFILING_QUESTIONS.length) {
    error(`Expected ${PROFILING_QUESTIONS.length} answers (comma-separated), got ${answerValues.length}`);
  }

  const analysis = {
    profile_version: '1.0',
    analyzed_at: new Date().toISOString(),
    data_source: 'questionnaire',
    projects_analyzed: [],
    messages_analyzed: 0,
    message_threshold: 'questionnaire',
    sensitive_excluded: [],
    dimensions: {},
  };

  for (let i = 0; i < PROFILING_QUESTIONS.length; i++) {
    const question = PROFILING_QUESTIONS[i];
    const answerValue = answerValues[i];
    const selectedOption = question.options.find(o => o.value === answerValue);

    if (!selectedOption) {
      error(`Invalid answer "${answerValue}" for ${question.dimension}. Valid values: ${question.options.map(o => o.value).join(', ')}`);
    }

    const ambiguous = isAmbiguousAnswer(question.dimension, answerValue);

    analysis.dimensions[question.dimension] = {
      rating: selectedOption.rating,
      confidence: ambiguous ? 'LOW' : 'MEDIUM',
      evidence_count: 1,
      cross_project_consistent: null,
      evidence: [{
        signal: 'Self-reported via questionnaire',
        quote: selectedOption.label,
        project: 'N/A (questionnaire)',
      }],
      summary: `Developer self-reported as ${selectedOption.rating} for ${question.header.toLowerCase()}.`,
      claude_instruction: generateClaudeInstruction(question.dimension, selectedOption.rating),
    };
  }

  output(analysis, raw);
}

function cmdGenerateDevPreferences(cwd, options, raw) {
  if (!options.analysis) error('--analysis <path> is required');

  let analysisPath = options.analysis;
  if (!path.isAbsolute(analysisPath)) analysisPath = path.join(cwd, analysisPath);
  if (!fs.existsSync(analysisPath)) error(`Analysis file not found: ${analysisPath}`);

  let analysis;
  try {
    analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
  } catch (err) {
    error(`Failed to parse analysis JSON: ${err.message}`);
  }

  if (!analysis.dimensions || typeof analysis.dimensions !== 'object') {
    error('Analysis JSON must contain a "dimensions" object');
  }

  const devPrefLabels = {
    communication_style: 'Communication',
    decision_speed: 'Decision Support',
    explanation_depth: 'Explanations',
    debugging_approach: 'Debugging',
    ux_philosophy: 'UX Approach',
    vendor_philosophy: 'Library & Tool Choices',
    frustration_triggers: 'Boundaries',
    learning_style: 'Learning Support',
  };

  const templatePath = path.join(__dirname, '..', '..', 'templates', 'dev-preferences.md');
  if (!fs.existsSync(templatePath)) error(`Template not found: ${templatePath}`);
  let template = fs.readFileSync(templatePath, 'utf-8');

  const directiveLines = [];
  const dimensionsIncluded = [];

  for (const dimKey of DIMENSION_KEYS) {
    const dim = analysis.dimensions[dimKey];
    if (!dim) continue;
    const label = devPrefLabels[dimKey] || dimKey;
    const confidence = dim.confidence || 'UNSCORED';
    let instruction = dim.claude_instruction;
    if (!instruction) {
      const lookup = CLAUDE_INSTRUCTIONS[dimKey];
      if (lookup && dim.rating && lookup[dim.rating]) {
        instruction = lookup[dim.rating];
      } else {
        instruction = `Adapt to this developer's ${dimKey.replace(/_/g, ' ')} preference.`;
      }
    }
    directiveLines.push(`### ${label}\n${instruction} (${confidence} confidence)\n`);
    dimensionsIncluded.push(dimKey);
  }

  const directivesBlock = directiveLines.join('\n').trim();
  template = template.replace(/\{\{behavioral_directives\}\}/g, directivesBlock);
  template = template.replace(/\{\{generated_at\}\}/g, new Date().toISOString());
  template = template.replace(/\{\{data_source\}\}/g, analysis.data_source || 'session_analysis');

  let stackBlock;
  if (analysis.data_source === 'questionnaire') {
    stackBlock = 'Stack preferences not available (questionnaire-only profile). Run `/gsd-profile-user --refresh` with session data to populate.';
  } else if (options.stack) {
    stackBlock = options.stack;
  } else {
    stackBlock = 'Stack preferences will be populated from session analysis.';
  }
  template = template.replace(/\{\{stack_preferences\}\}/g, stackBlock);

  let outputPath = options.output;
  if (!outputPath) {
    outputPath = path.join(os.homedir(), '.claude', 'commands', 'gsd', 'dev-preferences.md');
  } else if (!path.isAbsolute(outputPath)) {
    outputPath = path.join(cwd, outputPath);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, template, 'utf-8');

  const result = {
    command_path: outputPath,
    command_name: '/gsd-dev-preferences',
    dimensions_included: dimensionsIncluded,
    source: analysis.data_source || 'session_analysis',
  };

  output(result, raw);
}

function cmdGenerateClaudeProfile(cwd, options, raw) {
  if (!options.analysis) error('--analysis <path> is required');

  let analysisPath = options.analysis;
  if (!path.isAbsolute(analysisPath)) analysisPath = path.join(cwd, analysisPath);
  if (!fs.existsSync(analysisPath)) error(`Analysis file not found: ${analysisPath}`);

  let analysis;
  try {
    analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
  } catch (err) {
    error(`Failed to parse analysis JSON: ${err.message}`);
  }

  if (!analysis.dimensions || typeof analysis.dimensions !== 'object') {
    error('Analysis JSON must contain a "dimensions" object');
  }

  const profileLabels = {
    communication_style: 'Communication',
    decision_speed: 'Decisions',
    explanation_depth: 'Explanations',
    debugging_approach: 'Debugging',
    ux_philosophy: 'UX Philosophy',
    vendor_philosophy: 'Vendor Choices',
    frustration_triggers: 'Frustrations',
    learning_style: 'Learning',
  };

  const dataSource = analysis.data_source || 'session_analysis';
  const tableRows = [];
  const directiveLines = [];
  const dimensionsIncluded = [];

  for (const dimKey of DIMENSION_KEYS) {
    const dim = analysis.dimensions[dimKey];
    if (!dim) continue;
    const label = profileLabels[dimKey] || dimKey;
    const rating = dim.rating || 'UNSCORED';
    const confidence = dim.confidence || 'UNSCORED';
    tableRows.push(`| ${label} | ${rating} | ${confidence} |`);
    let instruction = dim.claude_instruction;
    if (!instruction) {
      const lookup = CLAUDE_INSTRUCTIONS[dimKey];
      if (lookup && dim.rating && lookup[dim.rating]) {
        instruction = lookup[dim.rating];
      } else {
        instruction = `Adapt to this developer's ${dimKey.replace(/_/g, ' ')} preference.`;
      }
    }
    directiveLines.push(`- **${label}:** ${instruction}`);
    dimensionsIncluded.push(dimKey);
  }

  const sectionLines = [
    '<!-- GSD:profile-start -->',
    '## Developer Profile',
    '',
    `> Generated by GSD from ${dataSource}. Run \`/gsd-profile-user --refresh\` to update.`,
    '',
    '| Dimension | Rating | Confidence |',
    '|-----------|--------|------------|',
    ...tableRows,
    '',
    '**Directives:**',
    ...directiveLines,
    '<!-- GSD:profile-end -->',
  ];

  const sectionContent = sectionLines.join('\n');

  let targetPath;
  if (options.global) {
    targetPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  } else if (options.output) {
    targetPath = path.isAbsolute(options.output) ? options.output : path.join(cwd, options.output);
  } else {
    // Read claude_md_path from config, default to ./CLAUDE.md
    let configClaudeMdPath = './CLAUDE.md';
    try {
      const config = loadConfig(cwd);
      if (config.claude_md_path) configClaudeMdPath = config.claude_md_path;
    } catch { /* use default */ }
    targetPath = path.isAbsolute(configClaudeMdPath) ? configClaudeMdPath : path.join(cwd, configClaudeMdPath);
  }

  let action;

  if (fs.existsSync(targetPath)) {
    let existingContent = fs.readFileSync(targetPath, 'utf-8');
    const startMarker = '<!-- GSD:profile-start -->';
    const endMarker = '<!-- GSD:profile-end -->';
    const startIdx = existingContent.indexOf(startMarker);
    const endIdx = existingContent.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
      const before = existingContent.substring(0, startIdx);
      const after = existingContent.substring(endIdx + endMarker.length);
      existingContent = before + sectionContent + after;
      action = 'updated';
    } else {
      existingContent = existingContent.trimEnd() + '\n\n' + sectionContent + '\n';
      action = 'appended';
    }
    fs.writeFileSync(targetPath, existingContent, 'utf-8');
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, sectionContent + '\n', 'utf-8');
    action = 'created';
  }

  const result = {
    claude_md_path: targetPath,
    action,
    dimensions_included: dimensionsIncluded,
    is_global: !!options.global,
  };

  output(result, raw);
}

function cmdGenerateClaudeMd(cwd, options, raw) {
  const MANAGED_SECTIONS = ['project', 'stack', 'conventions', 'architecture', 'skills', 'workflow'];
  const generators = {
    project: generateProjectSection,
    stack: generateStackSection,
    conventions: generateConventionsSection,
    architecture: generateArchitectureSection,
    skills: generateSkillsSection,
    workflow: generateWorkflowSection,
  };
  const sectionHeadings = {
    project: '## Project',
    stack: '## Technology Stack',
    conventions: '## Conventions',
    architecture: '## Architecture',
    skills: '## Project Skills',
    workflow: '## GSD Workflow Enforcement',
  };

  const generated = {};
  const sectionsGenerated = [];
  const sectionsFallback = [];
  const sectionsSkipped = [];

  for (const name of MANAGED_SECTIONS) {
    const gen = generators[name](cwd);
    generated[name] = gen;
    if (gen.hasFallback) {
      sectionsFallback.push(name);
    } else {
      sectionsGenerated.push(name);
    }
  }

  let outputPath = options.output;
  if (!outputPath) {
    // Read claude_md_path from config, default to ./CLAUDE.md
    let configClaudeMdPath = './CLAUDE.md';
    try {
      const config = loadConfig(cwd);
      if (config.claude_md_path) configClaudeMdPath = config.claude_md_path;
    } catch { /* use default */ }
    outputPath = path.isAbsolute(configClaudeMdPath) ? configClaudeMdPath : path.join(cwd, configClaudeMdPath);
  } else if (!path.isAbsolute(outputPath)) {
    outputPath = path.join(cwd, outputPath);
  }

  let existingContent = safeReadFile(outputPath);
  let action;

  if (existingContent === null) {
    const sections = [];
    for (const name of MANAGED_SECTIONS) {
      const gen = generated[name];
      const heading = sectionHeadings[name];
      const body = `${heading}\n\n${gen.content}`;
      sections.push(buildSection(name, gen.source, body));
    }
    sections.push('');
    sections.push(CLAUDE_MD_PROFILE_PLACEHOLDER);
    existingContent = sections.join('\n\n') + '\n';
    action = 'created';
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, existingContent, 'utf-8');
  } else {
    action = 'updated';
    let fileContent = existingContent;

    for (const name of MANAGED_SECTIONS) {
      const gen = generated[name];
      const heading = sectionHeadings[name];
      const body = `${heading}\n\n${gen.content}`;
      const fullSection = buildSection(name, gen.source, body);
      const hasMarkers = fileContent.indexOf(`<!-- GSD:${name}-start`) !== -1;

      if (hasMarkers) {
        if (options.auto) {
          const expectedBody = `${heading}\n\n${gen.content}`;
          if (detectManualEdit(fileContent, name, expectedBody)) {
            sectionsSkipped.push(name);
            const genIdx = sectionsGenerated.indexOf(name);
            if (genIdx !== -1) sectionsGenerated.splice(genIdx, 1);
            const fbIdx = sectionsFallback.indexOf(name);
            if (fbIdx !== -1) sectionsFallback.splice(fbIdx, 1);
            continue;
          }
        }
        const result = updateSection(fileContent, name, fullSection);
        fileContent = result.content;
      } else {
        const result = updateSection(fileContent, name, fullSection);
        fileContent = result.content;
      }
    }

    if (!options.auto && fileContent.indexOf('<!-- GSD:profile-start') === -1) {
      fileContent = fileContent.trimEnd() + '\n\n' + CLAUDE_MD_PROFILE_PLACEHOLDER + '\n';
    }

    fs.writeFileSync(outputPath, fileContent, 'utf-8');
  }

  const finalContent = safeReadFile(outputPath);
  let profileStatus;
  if (finalContent && finalContent.indexOf('<!-- GSD:profile-start') !== -1) {
    if (action === 'created' || existingContent.indexOf('<!-- GSD:profile-start') === -1) {
      profileStatus = 'placeholder_added';
    } else {
      profileStatus = 'exists';
    }
  } else {
    profileStatus = 'already_present';
  }

  const genCount = sectionsGenerated.length;
  const totalManaged = MANAGED_SECTIONS.length;
  let message = `Generated ${genCount}/${totalManaged} sections.`;
  if (sectionsFallback.length > 0) message += ` Fallback: ${sectionsFallback.join(', ')}.`;
  if (sectionsSkipped.length > 0) message += ` Skipped (manually edited): ${sectionsSkipped.join(', ')}.`;
  if (profileStatus === 'placeholder_added') message += ' Run /gsd-profile-user to unlock Developer Profile.';

  const result = {
    claude_md_path: outputPath,
    action,
    sections_generated: sectionsGenerated,
    sections_fallback: sectionsFallback,
    sections_skipped: sectionsSkipped,
    sections_total: totalManaged,
    profile_status: profileStatus,
    message,
  };

  output(result, raw);
}

module.exports = {
  cmdWriteProfile,
  cmdProfileQuestionnaire,
  cmdGenerateDevPreferences,
  cmdGenerateClaudeProfile,
  cmdGenerateClaudeMd,
  PROFILING_QUESTIONS,
  CLAUDE_INSTRUCTIONS,
};
