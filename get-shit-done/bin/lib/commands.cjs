/**
 * Commands — Standalone utility commands
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { safeReadFile, loadConfig, isGitIgnored, execGit, normalizePhaseName, comparePhaseNum, getArchivedPhaseDirs, generateSlugInternal, getMilestoneInfo, getMilestonePhaseFilter, resolveModelInternal, stripShippedMilestones, extractCurrentMilestone, toPosixPath, output, error, findPhaseInternal, extractOneLinerFromBody, getRoadmapPhaseInternal } = require('./core.cjs');
const { planningDir, planningPaths } = require('./planning-workspace.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const { MODEL_PROFILES } = require('./model-profiles.cjs');

/**
 * Determine phase status by checking plan/summary counts AND verification state.
 * Introduces "Executed" for phases with all summaries but no passing verification.
 */
function determinePhaseStatus(plans, summaries, phaseDir, defaultPending) {
  if (plans === 0) return defaultPending;
  if (summaries < plans && summaries > 0) return 'In Progress';
  if (summaries < plans) return 'Planned';

  // summaries >= plans — check verification
  try {
    const files = fs.readdirSync(phaseDir);
    const verificationFile = files.find(f => f === 'VERIFICATION.md' || f.endsWith('-VERIFICATION.md'));
    if (verificationFile) {
      const content = fs.readFileSync(path.join(phaseDir, verificationFile), 'utf-8');
      if (/status:\s*passed/i.test(content)) return 'Complete';
      if (/status:\s*human_needed/i.test(content)) return 'Needs Review';
      if (/status:\s*gaps_found/i.test(content)) return 'Executed';
      // Verification exists but unrecognized status — treat as executed
      return 'Executed';
    }
  } catch { /* directory read failed — fall through */ }

  // No verification file — executed but not verified
  return 'Executed';
}

function cmdGenerateSlug(text, raw) {
  if (!text) {
    error('text required for slug generation');
  }

  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);

  const result = { slug };
  output(result, raw, slug);
}

function cmdCurrentTimestamp(format, raw) {
  const now = new Date();
  let result;

  switch (format) {
    case 'date':
      result = now.toISOString().split('T')[0];
      break;
    case 'filename':
      result = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      break;
    case 'full':
    default:
      result = now.toISOString();
      break;
  }

  output({ timestamp: result }, raw, result);
}

function cmdListTodos(cwd, area, raw) {
  const pendingDir = path.join(planningDir(cwd), 'todos', 'pending');

  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);

        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        // Apply area filter if specified
        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: toPosixPath(path.relative(cwd, path.join(pendingDir, file))),
        });
      } catch { /* intentionally empty */ }
    }
  } catch { /* intentionally empty */ }

  const result = { count, todos };
  output(result, raw, count.toString());
}

function cmdVerifyPathExists(cwd, targetPath, raw) {
  if (!targetPath) {
    error('path required for verification');
  }

  // Reject null bytes and validate path does not contain traversal attempts
  if (targetPath.includes('\0')) {
    error('path contains null bytes');
  }

  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);

  try {
    const stats = fs.statSync(fullPath);
    const type = stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other';
    const result = { exists: true, type };
    output(result, raw, 'true');
  } catch {
    const result = { exists: false, type: null };
    output(result, raw, 'false');
  }
}

function cmdHistoryDigest(cwd, raw) {
  const phasesDir = planningPaths(cwd).phases;
  const digest = { phases: {}, decisions: [], tech_stack: new Set() };

  // Collect all phase directories: archived + current
  const allPhaseDirs = [];

  // Add archived phases first (oldest milestones first)
  const archived = getArchivedPhaseDirs(cwd);
  for (const a of archived) {
    allPhaseDirs.push({ name: a.name, fullPath: a.fullPath, milestone: a.milestone });
  }

  // Add current phases
  if (fs.existsSync(phasesDir)) {
    try {
      const currentDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
      for (const dir of currentDirs) {
        allPhaseDirs.push({ name: dir, fullPath: path.join(phasesDir, dir), milestone: null });
      }
    } catch { /* intentionally empty */ }
  }

  if (allPhaseDirs.length === 0) {
    digest.tech_stack = [];
    output(digest, raw);
    return;
  }

  try {
    for (const { name: dir, fullPath: dirPath } of allPhaseDirs) {
      const summaries = fs.readdirSync(dirPath).filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

      for (const summary of summaries) {
        try {
          const content = fs.readFileSync(path.join(dirPath, summary), 'utf-8');
          const fm = extractFrontmatter(content);

          const phaseNum = fm.phase || dir.split('-')[0];

          if (!digest.phases[phaseNum]) {
            digest.phases[phaseNum] = {
              name: fm.name || dir.split('-').slice(1).join(' ') || 'Unknown',
              provides: new Set(),
              affects: new Set(),
              patterns: new Set(),
            };
          }

          // Merge provides
          if (fm['dependency-graph'] && fm['dependency-graph'].provides) {
            fm['dependency-graph'].provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          } else if (fm.provides) {
            fm.provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          }

          // Merge affects
          if (fm['dependency-graph'] && fm['dependency-graph'].affects) {
            fm['dependency-graph'].affects.forEach(a => digest.phases[phaseNum].affects.add(a));
          }

          // Merge patterns
          if (fm['patterns-established']) {
            fm['patterns-established'].forEach(p => digest.phases[phaseNum].patterns.add(p));
          }

          // Merge decisions
          if (fm['key-decisions']) {
            fm['key-decisions'].forEach(d => {
              digest.decisions.push({ phase: phaseNum, decision: d });
            });
          }

          // Merge tech stack
          if (fm['tech-stack'] && fm['tech-stack'].added) {
            fm['tech-stack'].added.forEach(t => digest.tech_stack.add(typeof t === 'string' ? t : t.name));
          }

        } catch (e) {
          // Skip malformed summaries
        }
      }
    }

    // Convert Sets to Arrays for JSON output
    Object.keys(digest.phases).forEach(p => {
      digest.phases[p].provides = [...digest.phases[p].provides];
      digest.phases[p].affects = [...digest.phases[p].affects];
      digest.phases[p].patterns = [...digest.phases[p].patterns];
    });
    digest.tech_stack = [...digest.tech_stack];

    output(digest, raw);
  } catch (e) {
    error('Failed to generate history digest: ' + e.message);
  }
}

function cmdResolveModel(cwd, agentType, raw) {
  if (!agentType) {
    error('agent-type required');
  }

  const config = loadConfig(cwd);
  const profile = config.model_profile || 'balanced';
  const model = resolveModelInternal(cwd, agentType);

  const agentModels = MODEL_PROFILES[agentType];
  const result = agentModels
    ? { model, profile }
    : { model, profile, unknown_agent: true };
  output(result, raw, model);
}

function cmdCommit(cwd, message, files, raw, amend, noVerify) {
  if (!message && !amend) {
    error('commit message required');
  }

  // Sanitize commit message: strip invisible chars and injection markers
  // that could hijack agent context when commit messages are read back
  if (message) {
    const { sanitizeForPrompt } = require('./security.cjs');
    message = sanitizeForPrompt(message);
  }

  const config = loadConfig(cwd);

  // Check commit_docs config
  if (!config.commit_docs) {
    const result = { committed: false, hash: null, reason: 'skipped_commit_docs_false' };
    output(result, raw, 'skipped');
    return;
  }

  // Check if .planning is gitignored
  if (isGitIgnored(cwd, '.planning')) {
    const result = { committed: false, hash: null, reason: 'skipped_gitignored' };
    output(result, raw, 'skipped');
    return;
  }

  // Ensure branching strategy branch exists before first commit (#1278).
  // Pre-execution workflows (discuss, plan, research) commit artifacts but the branch
  // was previously only created during execute-phase — too late.
  if (config.branching_strategy && config.branching_strategy !== 'none') {
    let branchName = null;
    if (config.branching_strategy === 'phase') {
      // Determine which phase we're committing for from the file paths
      const phaseMatch = (files || []).join(' ').match(/(\d+(?:\.\d+)*)-/);
      if (phaseMatch) {
        const phaseNum = phaseMatch[1];
        const phaseInfo = findPhaseInternal(cwd, phaseNum);
        if (phaseInfo) {
          branchName = config.phase_branch_template
            .replace('{phase}', phaseInfo.phase_number)
            .replace('{slug}', phaseInfo.phase_slug || 'phase');
        }
      }
    } else if (config.branching_strategy === 'milestone') {
      const milestone = getMilestoneInfo(cwd);
      if (milestone && milestone.version) {
        branchName = config.milestone_branch_template
          .replace('{milestone}', milestone.version)
          .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone');
      }
    }
    if (branchName) {
      const currentBranch = execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
      if (currentBranch.exitCode === 0 && currentBranch.stdout.trim() !== branchName) {
        // Create branch if it doesn't exist, or switch to it if it does
        const create = execGit(cwd, ['checkout', '-b', branchName]);
        if (create.exitCode !== 0) {
          execGit(cwd, ['checkout', branchName]);
        }
      }
    }
  }

  // Stage files
  const explicitFiles = files && files.length > 0;
  const filesToStage = explicitFiles ? files : ['.planning/'];
  for (const file of filesToStage) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) {
      if (explicitFiles) {
        // Caller passed an explicit --files list: missing files are skipped.
        // Staging a deletion here would silently remove tracked planning files
        // (e.g. STATE.md, ROADMAP.md) when they are temporarily absent (#2014).
        continue;
      }
      // Default mode (staging all of .planning/): stage the deletion so
      // removed planning files are not left dangling in the index.
      execGit(cwd, ['rm', '--cached', '--ignore-unmatch', file]);
    } else {
      execGit(cwd, ['add', file]);
    }
  }

  // Commit (--no-verify skips pre-commit hooks, used by parallel executor agents)
  const commitArgs = amend ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', message];
  if (noVerify) commitArgs.push('--no-verify');
  const commitResult = execGit(cwd, commitArgs);
  if (commitResult.exitCode !== 0) {
    if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
      const result = { committed: false, hash: null, reason: 'nothing_to_commit' };
      output(result, raw, 'nothing');
      return;
    }
    const result = { committed: false, hash: null, reason: 'nothing_to_commit', error: commitResult.stderr };
    output(result, raw, 'nothing');
    return;
  }

  // Get short hash
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
  const result = { committed: true, hash, reason: 'committed' };
  output(result, raw, hash || 'committed');
}

function cmdCommitToSubrepo(cwd, message, files, raw) {
  if (!message) {
    error('commit message required');
  }

  const config = loadConfig(cwd);
  const subRepos = config.sub_repos;

  if (!subRepos || subRepos.length === 0) {
    error('no sub_repos configured in .planning/config.json');
  }

  if (!files || files.length === 0) {
    error('--files required for commit-to-subrepo');
  }

  // Group files by sub-repo prefix
  const grouped = {};
  const unmatched = [];
  for (const file of files) {
    const match = subRepos.find(repo => file.startsWith(repo + '/'));
    if (match) {
      if (!grouped[match]) grouped[match] = [];
      grouped[match].push(file);
    } else {
      unmatched.push(file);
    }
  }

  if (unmatched.length > 0) {
    process.stderr.write(`Warning: ${unmatched.length} file(s) did not match any sub-repo prefix: ${unmatched.join(', ')}\n`);
  }

  const repos = {};
  for (const [repo, repoFiles] of Object.entries(grouped)) {
    const repoCwd = path.join(cwd, repo);

    // Stage files (strip sub-repo prefix for paths relative to that repo)
    for (const file of repoFiles) {
      const relativePath = file.slice(repo.length + 1);
      execGit(repoCwd, ['add', relativePath]);
    }

    // Commit
    const commitResult = execGit(repoCwd, ['commit', '-m', message]);
    if (commitResult.exitCode !== 0) {
      if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
        repos[repo] = { committed: false, hash: null, files: repoFiles, reason: 'nothing_to_commit' };
        continue;
      }
      repos[repo] = { committed: false, hash: null, files: repoFiles, reason: 'error', error: commitResult.stderr };
      continue;
    }

    // Get hash
    const hashResult = execGit(repoCwd, ['rev-parse', '--short', 'HEAD']);
    const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
    repos[repo] = { committed: true, hash, files: repoFiles };
  }

  const result = {
    committed: Object.values(repos).some(r => r.committed),
    repos,
    unmatched: unmatched.length > 0 ? unmatched : undefined,
  };
  output(result, raw, Object.entries(repos).map(([r, v]) => `${r}:${v.hash || 'skip'}`).join(' '));
}

function cmdSummaryExtract(cwd, summaryPath, fields, raw) {
  if (!summaryPath) {
    error('summary-path required for summary-extract');
  }

  const fullPath = path.join(cwd, summaryPath);

  if (!fs.existsSync(fullPath)) {
    output({ error: 'File not found', path: summaryPath }, raw);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);

  // Parse key-decisions into structured format
  const parseDecisions = (decisionsList) => {
    if (!decisionsList || !Array.isArray(decisionsList)) return [];
    return decisionsList.map(d => {
      const colonIdx = d.indexOf(':');
      if (colonIdx > 0) {
        return {
          summary: d.substring(0, colonIdx).trim(),
          rationale: d.substring(colonIdx + 1).trim(),
        };
      }
      return { summary: d, rationale: null };
    });
  };

  // Build full result
  const fullResult = {
    path: summaryPath,
    one_liner: fm['one-liner'] || extractOneLinerFromBody(content) || null,
    key_files: fm['key-files'] || [],
    tech_added: (fm['tech-stack'] && fm['tech-stack'].added) || [],
    patterns: fm['patterns-established'] || [],
    decisions: parseDecisions(fm['key-decisions']),
    requirements_completed: fm['requirements-completed'] || [],
  };

  // If fields specified, filter to only those fields
  if (fields && fields.length > 0) {
    const filtered = { path: summaryPath };
    for (const field of fields) {
      if (fullResult[field] !== undefined) {
        filtered[field] = fullResult[field];
      }
    }
    output(filtered, raw);
    return;
  }

  output(fullResult, raw);
}

async function cmdWebsearch(query, options, raw) {
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    // No key = silent skip, agent falls back to built-in WebSearch
    output({ available: false, reason: 'BRAVE_API_KEY not set' }, raw, '');
    return;
  }

  if (!query) {
    output({ available: false, error: 'Query required' }, raw, '');
    return;
  }

  const params = new URLSearchParams({
    q: query,
    count: String(options.limit || 10),
    country: 'us',
    search_lang: 'en',
    text_decorations: 'false'
  });

  if (options.freshness) {
    params.set('freshness', options.freshness);
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        }
      }
    );

    if (!response.ok) {
      output({ available: false, error: `API error: ${response.status}` }, raw, '');
      return;
    }

    const data = await response.json();

    const results = (data.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age || null
    }));

    output({
      available: true,
      query,
      count: results.length,
      results
    }, raw, results.map(r => `${r.title}\n${r.url}\n${r.description}`).join('\n\n'));
  } catch (err) {
    output({ available: false, error: err.message }, raw, '');
  }
}

function cmdProgressRender(cwd, format, raw) {
  const phasesDir = planningPaths(cwd).phases;
  const roadmapPath = planningPaths(cwd).roadmap;
  const milestone = getMilestoneInfo(cwd);

  const phases = [];
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)*)-?(.*)/);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

      totalPlans += plans;
      totalSummaries += summaries;

      const status = determinePhaseStatus(plans, summaries, path.join(phasesDir, dir), 'Pending');

      phases.push({ number: phaseNum, name: phaseName, plans, summaries, status });
    }
  } catch { /* intentionally empty */ }

  const percent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;

  if (format === 'table') {
    // Render markdown table
    const barWidth = 10;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    let out = `# ${milestone.version} ${milestone.name}\n\n`;
    out += `**Progress:** [${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)\n\n`;
    out += `| Phase | Name | Plans | Status |\n`;
    out += `|-------|------|-------|--------|\n`;
    for (const p of phases) {
      out += `| ${p.number} | ${p.name} | ${p.summaries}/${p.plans} | ${p.status} |\n`;
    }
    output({ rendered: out }, raw, out);
  } else if (format === 'bar') {
    const barWidth = 20;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    const text = `[${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)`;
    output({ bar: text, percent, completed: totalSummaries, total: totalPlans }, raw, text);
  } else {
    // JSON format
    output({
      milestone_version: milestone.version,
      milestone_name: milestone.name,
      phases,
      total_plans: totalPlans,
      total_summaries: totalSummaries,
      percent,
    }, raw);
  }
}

/**
 * Match pending todos against a phase's goal/name/requirements.
 * Returns todos with relevance scores based on keyword, area, and file overlap.
 * Used by discuss-phase to surface relevant todos before scope-setting.
 */
function cmdTodoMatchPhase(cwd, phase, raw) {
  if (!phase) { error('phase required for todo match-phase'); }

  const pendingDir = path.join(planningDir(cwd), 'todos', 'pending');
  const todos = [];

  // Load pending todos
  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const filesMatch = content.match(/^files:\s*(.+)$/m);
        const body = content.replace(/^(title|area|files|created|priority):.*$/gm, '').trim();

        todos.push({
          file,
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: areaMatch ? areaMatch[1].trim() : 'general',
          files: filesMatch ? filesMatch[1].trim().split(/[,\s]+/).filter(Boolean) : [],
          body: body.slice(0, 200), // first 200 chars for context
        });
      } catch {}
    }
  } catch {}

  if (todos.length === 0) {
    output({ phase, matches: [], todo_count: 0 }, raw);
    return;
  }

  // Load phase goal/name from ROADMAP
  const phaseInfo = getRoadmapPhaseInternal(cwd, phase);
  const phaseName = phaseInfo ? (phaseInfo.phase_name || '') : '';
  const phaseGoal = phaseInfo ? (phaseInfo.goal || '') : '';
  const phaseSection = phaseInfo ? (phaseInfo.section || '') : '';

  // Build keyword set from phase name + goal + section text
  const phaseText = `${phaseName} ${phaseGoal} ${phaseSection}`.toLowerCase();
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'are', 'was', 'has', 'have', 'been', 'not', 'but', 'all', 'can', 'into', 'each', 'when', 'any', 'use', 'new']);
  const phaseKeywords = new Set(
    phaseText.split(/[\s\-_/.,;:()\[\]{}|]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 2 && !stopWords.has(w))
  );

  // Find phase directory to get expected file paths
  const phaseInfoDisk = findPhaseInternal(cwd, phase);
  const phasePlans = [];
  if (phaseInfoDisk && phaseInfoDisk.found) {
    try {
      const phaseDir = path.join(cwd, phaseInfoDisk.directory);
      const planFiles = fs.readdirSync(phaseDir).filter(f => f.endsWith('-PLAN.md'));
      for (const pf of planFiles) {
        try {
          const planContent = fs.readFileSync(path.join(phaseDir, pf), 'utf-8');
          const fmFiles = planContent.match(/files_modified:\s*\[([^\]]*)\]/);
          if (fmFiles) {
            phasePlans.push(...fmFiles[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean));
          }
        } catch {}
      }
    } catch {}
  }

  // Score each todo for relevance
  const matches = [];
  for (const todo of todos) {
    let score = 0;
    const reasons = [];

    // Keyword match: todo title/body terms in phase text
    const todoWords = `${todo.title} ${todo.body}`.toLowerCase()
      .split(/[\s\-_/.,;:()\[\]{}|]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 2 && !stopWords.has(w));

    const matchedKeywords = todoWords.filter(w => phaseKeywords.has(w));
    if (matchedKeywords.length > 0) {
      score += Math.min(matchedKeywords.length * 0.2, 0.6);
      reasons.push(`keywords: ${[...new Set(matchedKeywords)].slice(0, 5).join(', ')}`);
    }

    // Area match: todo area appears in phase text
    if (todo.area !== 'general' && phaseText.includes(todo.area.toLowerCase())) {
      score += 0.3;
      reasons.push(`area: ${todo.area}`);
    }

    // File match: todo files overlap with phase plan files
    if (todo.files.length > 0 && phasePlans.length > 0) {
      const fileOverlap = todo.files.filter(f =>
        phasePlans.some(pf => pf.includes(f) || f.includes(pf))
      );
      if (fileOverlap.length > 0) {
        score += 0.4;
        reasons.push(`files: ${fileOverlap.slice(0, 3).join(', ')}`);
      }
    }

    if (score > 0) {
      matches.push({
        file: todo.file,
        title: todo.title,
        area: todo.area,
        score: Math.round(score * 100) / 100,
        reasons,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  output({ phase, matches, todo_count: todos.length }, raw);
}

function cmdTodoComplete(cwd, filename, raw) {
  if (!filename) {
    error('filename required for todo complete');
  }

  const pendingDir = path.join(planningDir(cwd), 'todos', 'pending');
  const completedDir = path.join(planningDir(cwd), 'todos', 'completed');
  const sourcePath = path.join(pendingDir, filename);

  if (!fs.existsSync(sourcePath)) {
    error(`Todo not found: ${filename}`);
  }

  // Ensure completed directory exists
  fs.mkdirSync(completedDir, { recursive: true });

  // Read, add completion timestamp, move
  let content = fs.readFileSync(sourcePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  content = `completed: ${today}\n` + content;

  fs.writeFileSync(path.join(completedDir, filename), content, 'utf-8');
  fs.unlinkSync(sourcePath);

  output({ completed: true, file: filename, date: today }, raw, 'completed');
}

function cmdScaffold(cwd, type, options, raw) {
  const { phase, name } = options;
  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];

  // Find phase directory
  const phaseInfo = phase ? findPhaseInternal(cwd, phase) : null;
  const phaseDir = phaseInfo ? path.join(cwd, phaseInfo.directory) : null;

  if (phase && !phaseDir && type !== 'phase-dir') {
    error(`Phase ${phase} directory not found`);
  }

  let filePath, content;

  switch (type) {
    case 'context': {
      filePath = path.join(phaseDir, `${padded}-CONTEXT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Context\n\n## Decisions\n\n_Decisions will be captured during /gsd-discuss-phase ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
      break;
    }
    case 'uat': {
      filePath = path.join(phaseDir, `${padded}-UAT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
      break;
    }
    case 'verification': {
      filePath = path.join(phaseDir, `${padded}-VERIFICATION.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
      break;
    }
    case 'phase-dir': {
      if (!phase || !name) {
        error('phase and name required for phase-dir scaffold');
      }
      const slug = generateSlugInternal(name);
      const dirName = `${padded}-${slug}`;
      const phasesParent = planningPaths(cwd).phases;
      fs.mkdirSync(phasesParent, { recursive: true });
      const dirPath = path.join(phasesParent, dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      output({ created: true, directory: toPosixPath(path.relative(cwd, dirPath)), path: dirPath }, raw, dirPath);
      return;
    }
    default:
      error(`Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`);
  }

  if (fs.existsSync(filePath)) {
    output({ created: false, reason: 'already_exists', path: filePath }, raw, 'exists');
    return;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  const relPath = toPosixPath(path.relative(cwd, filePath));
  output({ created: true, path: relPath }, raw, relPath);
}

function cmdStats(cwd, format, raw) {
  const phasesDir = planningPaths(cwd).phases;
  const roadmapPath = planningPaths(cwd).roadmap;
  const reqPath = planningPaths(cwd).requirements;
  const statePath = planningPaths(cwd).state;
  const milestone = getMilestoneInfo(cwd);
  const isDirInMilestone = getMilestonePhaseFilter(cwd);

  // Phase & plan stats (reuse progress pattern)
  const phasesByNumber = new Map();
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const roadmapContent = extractCurrentMilestone(fs.readFileSync(roadmapPath, 'utf-8'), cwd);
    const headingPattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
    let match;
    while ((match = headingPattern.exec(roadmapContent)) !== null) {
      const key = normalizePhaseName(match[1]);
      phasesByNumber.set(key, {
        number: key,
        name: match[2].replace(/\(INSERTED\)/i, '').trim(),
        plans: 0,
        summaries: 0,
        status: 'Not Started',
      });
    }
  } catch { /* intentionally empty */ }

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(isDirInMilestone)
      .sort((a, b) => comparePhaseNum(a, b));

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

      totalPlans += plans;
      totalSummaries += summaries;

      const status = determinePhaseStatus(plans, summaries, path.join(phasesDir, dir), 'Not Started');

      const normalizedNum = normalizePhaseName(phaseNum);
      const existing = phasesByNumber.get(normalizedNum);
      phasesByNumber.set(normalizedNum, {
        number: normalizedNum,
        name: existing?.name || phaseName,
        plans: (existing?.plans || 0) + plans,
        summaries: (existing?.summaries || 0) + summaries,
        status,
      });
    }
  } catch { /* intentionally empty */ }

  const phases = [...phasesByNumber.values()].sort((a, b) => comparePhaseNum(a.number, b.number));
  const completedPhases = phases.filter(p => p.status === 'Complete').length;
  const planPercent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;
  const percent = phases.length > 0 ? Math.min(100, Math.round((completedPhases / phases.length) * 100)) : 0;

  // Requirements stats
  let requirementsTotal = 0;
  let requirementsComplete = 0;
  try {
    if (fs.existsSync(reqPath)) {
      const reqContent = fs.readFileSync(reqPath, 'utf-8');
      const checked = reqContent.match(/^- \[x\] \*\*/gm);
      const unchecked = reqContent.match(/^- \[ \] \*\*/gm);
      requirementsComplete = checked ? checked.length : 0;
      requirementsTotal = requirementsComplete + (unchecked ? unchecked.length : 0);
    }
  } catch { /* intentionally empty */ }

  // Last activity from STATE.md
  let lastActivity = null;
  try {
    if (fs.existsSync(statePath)) {
      const stateContent = fs.readFileSync(statePath, 'utf-8');
      const activityMatch = stateContent.match(/^last_activity:\s*(.+)$/im)
        || stateContent.match(/\*\*Last Activity:\*\*\s*(.+)/i)
        || stateContent.match(/^Last Activity:\s*(.+)$/im)
        || stateContent.match(/^Last activity:\s*(.+)$/im);
      if (activityMatch) lastActivity = activityMatch[1].trim();
    }
  } catch { /* intentionally empty */ }

  // Git stats
  let gitCommits = 0;
  let gitFirstCommitDate = null;
  const commitCount = execGit(cwd, ['rev-list', '--count', 'HEAD']);
  if (commitCount.exitCode === 0) {
    gitCommits = parseInt(commitCount.stdout, 10) || 0;
  }
  const rootHash = execGit(cwd, ['rev-list', '--max-parents=0', 'HEAD']);
  if (rootHash.exitCode === 0 && rootHash.stdout) {
    const firstCommit = rootHash.stdout.split('\n')[0].trim();
    const firstDate = execGit(cwd, ['show', '-s', '--format=%as', firstCommit]);
    if (firstDate.exitCode === 0) {
      gitFirstCommitDate = firstDate.stdout || null;
    }
  }

  const result = {
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    phases,
    phases_completed: completedPhases,
    phases_total: phases.length,
    total_plans: totalPlans,
    total_summaries: totalSummaries,
    percent,
    plan_percent: planPercent,
    requirements_total: requirementsTotal,
    requirements_complete: requirementsComplete,
    git_commits: gitCommits,
    git_first_commit_date: gitFirstCommitDate,
    last_activity: lastActivity,
  };

  if (format === 'table') {
    const barWidth = 10;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    let out = `# ${milestone.version} ${milestone.name} \u2014 Statistics\n\n`;
    out += `**Progress:** [${bar}] ${completedPhases}/${phases.length} phases (${percent}%)\n`;
    if (totalPlans > 0) {
      out += `**Plans:** ${totalSummaries}/${totalPlans} complete (${planPercent}%)\n`;
    }
    out += `**Phases:** ${completedPhases}/${phases.length} complete\n`;
    if (requirementsTotal > 0) {
      out += `**Requirements:** ${requirementsComplete}/${requirementsTotal} complete\n`;
    }
    out += '\n';
    out += `| Phase | Name | Plans | Completed | Status |\n`;
    out += `|-------|------|-------|-----------|--------|\n`;
    for (const p of phases) {
      out += `| ${p.number} | ${p.name} | ${p.plans} | ${p.summaries} | ${p.status} |\n`;
    }
    if (gitCommits > 0) {
      out += `\n**Git:** ${gitCommits} commits`;
      if (gitFirstCommitDate) out += ` (since ${gitFirstCommitDate})`;
      out += '\n';
    }
    if (lastActivity) out += `**Last activity:** ${lastActivity}\n`;
    output({ rendered: out }, raw, out);
  } else {
    output(result, raw);
  }
}

/**
 * Check whether a commit should be allowed based on commit_docs config.
 * When commit_docs is false, rejects commits that stage .planning/ files.
 * Intended for use as a pre-commit hook guard.
 */
function cmdCheckCommit(cwd, raw) {
  const config = loadConfig(cwd);

  // If commit_docs is true (or not set), allow all commits
  if (config.commit_docs !== false) {
    output({ allowed: true, reason: 'commit_docs_enabled' }, raw, 'allowed');
    return;
  }

  // commit_docs is false — check if any .planning/ files are staged
  try {
    const staged = execSync('git diff --cached --name-only', { cwd, encoding: 'utf-8' }).trim();
    const planningFiles = staged.split('\n').filter(f => f.startsWith('.planning/') || f.startsWith('.planning\\'));

    if (planningFiles.length > 0) {
      error(
        `commit_docs is false but ${planningFiles.length} .planning/ file(s) are staged:\n` +
        planningFiles.map(f => `  ${f}`).join('\n') +
        `\n\nTo unstage: git reset HEAD ${planningFiles.join(' ')}`
      );
    }
  } catch {
    // git diff --cached failed (no staged files or not a git repo) — allow
  }

  output({ allowed: true, reason: 'no_planning_files_staged' }, raw, 'allowed');
}

module.exports = {
  cmdGenerateSlug,
  cmdCurrentTimestamp,
  cmdListTodos,
  cmdVerifyPathExists,
  cmdHistoryDigest,
  cmdResolveModel,
  cmdCommit,
  cmdCommitToSubrepo,
  cmdSummaryExtract,
  cmdWebsearch,
  cmdProgressRender,
  cmdTodoComplete,
  cmdTodoMatchPhase,
  cmdScaffold,
  cmdStats,
  cmdCheckCommit,
};
