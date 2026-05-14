/**
 * Init — Compound init commands for workflow bootstrapping
 */

const fs = require('fs');
const path = require('path');
const { execGit, platformWriteSync, platformReadSync } = require('./shell-command-projection.cjs');
const { loadConfig, resolveModelInternal, findPhaseInternal, getRoadmapPhaseInternal, pathExistsInternal, generateSlugInternal, getMilestoneInfo, getMilestonePhaseFilter, stripShippedMilestones, extractCurrentMilestone, normalizePhaseName, toPosixPath, output, error, checkAgentsInstalled, phaseTokenMatches } = require('./core.cjs');
const { planningPaths, planningDir, planningRoot } = require('./planning-workspace.cjs');
const { maskIfSecret } = require('./secrets.cjs');
const scanPhasePlans = require('./plan-scan.cjs');
const { stateExtractField } = require('./state-document.cjs');

// Accept all bold/colon variants of the Requirements header (#2769):
// **Requirements:** / **Requirements**: / **Requirements** : render the
// same in markdown but differ textually.
const REQUIREMENTS_HEADER_RE = /^\*\*Requirements:?\*\*[^\S\n]*:?[^\S\n]*([^\n]*)$/m;

function listPhaseSummaryFiles(phaseDir) {
  return scanPhasePlans(phaseDir).summaryFiles;
}

function listPhasePlanFiles(phaseDir) {
  return scanPhasePlans(phaseDir).planFiles;
}

function getLatestCompletedMilestone(cwd) {
  const milestonesPath = path.join(planningRoot(cwd), 'MILESTONES.md');
  const content = platformReadSync(milestonesPath);
  if (content === null) return null;

  const match = content.match(/^##\s+(v[\d.]+)\s+(.+?)\s+\(Shipped:/m);
  if (!match) return null;
  return {
    version: match[1],
    name: match[2].trim(),
  };
}

/**
 * Inject `project_root` into an init result object.
 * Workflows use this to prefix `.planning/` paths correctly when Claude's CWD
 * differs from the project root (e.g., inside a sub-repo).
 */
function withProjectRoot(cwd, result) {
  result.project_root = cwd;
  // Inject agent installation status into all init outputs (#1371).
  // Workflows that spawn named subagents use this to detect when agents
  // are missing and would silently fall back to general-purpose.
  const agentStatus = checkAgentsInstalled();
  result.agents_installed = agentStatus.agents_installed;
  result.missing_agents = agentStatus.missing_agents;
  // Inject response_language into all init outputs (#1399).
  // Workflows propagate this to subagent prompts so user-facing questions
  // stay in the configured language across phase boundaries.
  const config = loadConfig(cwd);
  if (config.response_language) {
    result.response_language = config.response_language;
  }
  // Inject project identity into all init outputs so handoff blocks
  // can include project context for cross-session continuity.
  if (config.project_code) {
    result.project_code = config.project_code;
  }
  // Extract project title from PROJECT.md first H1 heading.
  const projectMdPath = path.join(planningDir(cwd), 'PROJECT.md');
  const content = platformReadSync(projectMdPath);
  if (content) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      result.project_title = h1Match[1].trim();
    }
  }
  return result;
}

function cmdInitExecutePhase(cwd, phase, raw, options = {}) {
  if (!phase) {
    error('phase required for init execute-phase');
  }

  const config = loadConfig(cwd);
  let phaseInfo = findPhaseInternal(cwd, phase);
  const milestone = getMilestoneInfo(cwd);

  const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);

  // If findPhaseInternal matched an archived phase from a prior milestone, but
  // the phase exists in the current milestone's ROADMAP.md, ignore the archive
  // match — we are initializing a new phase in the current milestone that
  // happens to share a number with an archived one. Without this, phase_dir,
  // phase_slug and related fields would point at artifacts from a previous
  // milestone.
  if (phaseInfo?.archived && roadmapPhase?.found) {
    phaseInfo = null;
  }

  // Fallback to ROADMAP.md if no phase directory exists yet
  if (!phaseInfo && roadmapPhase?.found) {
    const phaseName = roadmapPhase.phase_name;
    phaseInfo = {
      found: true,
      directory: null,
      phase_number: roadmapPhase.phase_number,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans: [],
      summaries: [],
      incomplete_plans: [],
      has_research: false,
      has_context: false,
      has_verification: false,
      has_reviews: false,
    };
  }
  const reqMatch = roadmapPhase?.section?.match(REQUIREMENTS_HEADER_RE);
  const reqExtracted = reqMatch
    ? reqMatch[1].replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean).join(', ')
    : null;
  const phase_req_ids = (reqExtracted && reqExtracted !== 'TBD') ? reqExtracted : null;

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config flags
    tdd_mode: options.tdd || config.tdd_mode || false,
    commit_docs: config.commit_docs,
    sub_repos: config.sub_repos,
    parallelization: config.parallelization,
    context_window: config.context_window,
    branching_strategy: config.branching_strategy,
    phase_branch_template: config.phase_branch_template,
    milestone_branch_template: config.milestone_branch_template,
    verifier_enabled: config.verifier,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    phase_req_ids,

    // Plan inventory
    plans: phaseInfo?.plans || [],
    summaries: phaseInfo?.summaries || [],
    incomplete_plans: phaseInfo?.incomplete_plans || [],
    plan_count: phaseInfo?.plans?.length || 0,
    incomplete_count: phaseInfo?.incomplete_plans?.length || 0,

    // Branch name (pre-computed)
    branch_name: config.branching_strategy === 'phase' && phaseInfo
      ? config.phase_branch_template
          .replace('{project}', config.project_code || '')
          .replace('{phase}', phaseInfo.phase_number)
          .replace('{slug}', phaseInfo.phase_slug || 'phase')
      : config.branching_strategy === 'milestone'
        ? config.milestone_branch_template
            .replace('{milestone}', milestone.version)
            .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone')
        : null,

    // Milestone info
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // File existence
    state_exists: fs.existsSync(path.join(planningDir(cwd), 'STATE.md')),
    roadmap_exists: fs.existsSync(path.join(planningDir(cwd), 'ROADMAP.md')),
    config_exists: fs.existsSync(path.join(planningDir(cwd), 'config.json')),
    // File paths
    state_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'STATE.md'))),
    roadmap_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'ROADMAP.md'))),
    config_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'config.json'))),
  };

  // Optional --validate: run state validation and include warnings (#1627)
  if (options.validate) {
    try {
      const statePath = path.join(planningDir(cwd), 'STATE.md');
      const stateContent = platformReadSync(statePath);
      if (stateContent !== null) {
        const status = stateExtractField(stateContent, 'Status') || '';
        result.state_validation_ran = true;
        // Simple inline validation — check for obvious drift
        const warnings = [];
        const phasesPath = planningPaths(cwd).phases;
        if (phaseInfo && phaseInfo.directory && fs.existsSync(path.join(cwd, phaseInfo.directory))) {
          const diskPlans = listPhasePlanFiles(path.join(cwd, phaseInfo.directory)).length;
          const totalPlansRaw = stateExtractField(stateContent, 'Total Plans in Phase');
          const totalPlansInPhase = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
          if (totalPlansInPhase !== null && diskPlans !== totalPlansInPhase) {
            warnings.push(`Plan count mismatch: STATE.md says ${totalPlansInPhase}, disk has ${diskPlans}`);
          }
        }
        result.state_warnings = warnings;
      }
    } catch { /* intentionally empty */ }
  }

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitPlanPhase(cwd, phase, raw, options = {}) {
  if (!phase) {
    error('phase required for init plan-phase');
  }

  const config = loadConfig(cwd);
  let phaseInfo = findPhaseInternal(cwd, phase);

  const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);

  // If findPhaseInternal matched an archived phase from a prior milestone, but
  // the phase exists in the current milestone's ROADMAP.md, ignore the archive
  // match — we are planning a new phase in the current milestone that happens
  // to share a number with an archived one. Without this, phase_dir,
  // phase_slug, has_context and has_research would point at artifacts from a
  // previous milestone.
  if (phaseInfo?.archived && roadmapPhase?.found) {
    phaseInfo = null;
  }

  // Fallback to ROADMAP.md if no phase directory exists yet
  if (!phaseInfo && roadmapPhase?.found) {
    const phaseName = roadmapPhase.phase_name;
    phaseInfo = {
      found: true,
      directory: null,
      phase_number: roadmapPhase.phase_number,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans: [],
      summaries: [],
      incomplete_plans: [],
      has_research: false,
      has_context: false,
      has_verification: false,
      has_reviews: false,
    };
  }
  const reqMatch = roadmapPhase?.section?.match(REQUIREMENTS_HEADER_RE);
  const reqExtracted = reqMatch
    ? reqMatch[1].replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean).join(', ')
    : null;
  const phase_req_ids = (reqExtracted && reqExtracted !== 'TBD') ? reqExtracted : null;

  // #3287: compute the canonical directory name with project_code prefix so
  // the first-touch mkdir in /gsd:plan-phase stays consistent with phase.add.
  const phaseDirPlan = phaseInfo?.directory || null;
  const phaseNumberPlan = phaseInfo?.phase_number || null;
  const phaseNamePlan = phaseInfo?.phase_name || null;
  const rawProjectCodePlan = config.project_code || '';
  let expectedPhaseDirPlan = null;
  if (!phaseDirPlan && phaseNumberPlan && phaseNamePlan) {
    const paddedNum = normalizePhaseName(phaseNumberPlan);
    const slug = generateSlugInternal(phaseNamePlan).substring(0, 60);
    if (slug) {
      const prefix = rawProjectCodePlan ? `${rawProjectCodePlan}-` : '';
      const dirName = `${prefix}${paddedNum}-${slug}`;
      expectedPhaseDirPlan = toPosixPath(path.relative(cwd, path.join(planningPaths(cwd).phases, dirName)));
    }
  }

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-phase-researcher'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Workflow flags
    tdd_mode: options.tdd || config.tdd_mode || false,
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    nyquist_validation_enabled: config.nyquist_validation,
    commit_docs: config.commit_docs,
    text_mode: config.text_mode,
    // Auto-advance config — included so workflows don't need separate config-get
    // calls for these values, which causes infinite config-read loops on some models
    // (e.g. Kimi K2.5). See #2192.
    auto_advance: !!(config.auto_advance),
    auto_chain_active: !!(config._auto_chain_active),
    mode: config.mode || 'interactive',

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseDirPlan,
    expected_phase_dir: expectedPhaseDirPlan,
    phase_number: phaseNumberPlan,
    phase_name: phaseNamePlan,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseNumberPlan ? normalizePhaseName(phaseNumberPlan) : null,
    phase_req_ids,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_reviews: phaseInfo?.has_reviews || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    plan_count: phaseInfo?.plans?.length || 0,

    // Environment
    planning_exists: fs.existsSync(planningDir(cwd)),
    roadmap_exists: fs.existsSync(path.join(planningDir(cwd), 'ROADMAP.md')),

    // File paths
    state_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'STATE.md'))),
    roadmap_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'ROADMAP.md'))),
    requirements_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'REQUIREMENTS.md'))),

    // Pattern mapper output (null until PATTERNS.md exists in phase dir)
    patterns_path: null,
  };

  if (phaseInfo?.directory) {
    // Find *-CONTEXT.md in phase directory
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) {
        result.context_path = toPosixPath(path.join(phaseInfo.directory, contextFile));
      }
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) {
        result.research_path = toPosixPath(path.join(phaseInfo.directory, researchFile));
      }
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) {
        result.verification_path = toPosixPath(path.join(phaseInfo.directory, verificationFile));
      }
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) {
        result.uat_path = toPosixPath(path.join(phaseInfo.directory, uatFile));
      }
      const reviewsFile = files.find(f => f.endsWith('-REVIEWS.md') || f === 'REVIEWS.md');
      if (reviewsFile) {
        result.reviews_path = toPosixPath(path.join(phaseInfo.directory, reviewsFile));
      }
      const patternsFile = files.find(f => f.endsWith('-PATTERNS.md') || f === 'PATTERNS.md');
      if (patternsFile) {
        result.patterns_path = toPosixPath(path.join(phaseInfo.directory, patternsFile));
      }
    } catch { /* intentionally empty */ }
  }

  // Optional --validate: run state validation and include warnings (#1627)
  if (options.validate) {
    try {
      const statePath = path.join(planningDir(cwd), 'STATE.md');
      const stateContent = platformReadSync(statePath);
      if (stateContent !== null) {
        const warnings = [];
        result.state_validation_ran = true;
        const totalPlansRaw = stateExtractField(stateContent, 'Total Plans in Phase');
        const totalPlansInPhase = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
        if (totalPlansInPhase !== null && phaseInfo && totalPlansInPhase !== (phaseInfo.plans?.length || 0)) {
          warnings.push(`Plan count mismatch: STATE.md says ${totalPlansInPhase}, disk has ${phaseInfo.plans?.length || 0}`);
        }
        result.state_warnings = warnings;
      }
    } catch { /* intentionally empty */ }
  }

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitNewProject(cwd, raw) {
  const config = loadConfig(cwd);

  // Detect Brave Search API key availability
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Detect Firecrawl API key availability
  const firecrawlKeyFile = path.join(homedir, '.gsd', 'firecrawl_api_key');
  const hasFirecrawl = !!(process.env.FIRECRAWL_API_KEY || fs.existsSync(firecrawlKeyFile));

  // Detect Exa API key availability
  const exaKeyFile = path.join(homedir, '.gsd', 'exa_api_key');
  const hasExaSearch = !!(process.env.EXA_API_KEY || fs.existsSync(exaKeyFile));

  // Detect existing code (cross-platform — no Unix `find` dependency)
  let hasCode = false;
  let hasPackageFile = false;
  try {
    const codeExtensions = new Set([
      '.ts', '.js', '.py', '.go', '.rs', '.swift', '.java',
      '.kt', '.kts',           // Kotlin (Android, server-side)
      '.c', '.cpp', '.h',      // C/C++
      '.cs',                   // C#
      '.rb',                   // Ruby
      '.php',                  // PHP
      '.dart',                 // Dart (Flutter)
      '.m', '.mm',             // Objective-C / Objective-C++
      '.scala',                // Scala
      '.groovy',               // Groovy (Gradle build scripts)
      '.lua',                  // Lua
      '.r', '.R',              // R
      '.zig',                  // Zig
      '.ex', '.exs',           // Elixir
      '.clj',                  // Clojure
    ]);
    const skipDirs = new Set(['node_modules', '.git', '.planning', '.claude', '.codex', '__pycache__', 'target', 'dist', 'build']);
    function findCodeFiles(dir, depth) {
      if (depth > 3) return false;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
      for (const entry of entries) {
        if (entry.isFile() && codeExtensions.has(path.extname(entry.name))) return true;
        if (entry.isDirectory() && !skipDirs.has(entry.name)) {
          if (findCodeFiles(path.join(dir, entry.name), depth + 1)) return true;
        }
      }
      return false;
    }
    hasCode = findCodeFiles(cwd, 0);
  } catch { /* intentionally empty — best-effort detection */ }

  hasPackageFile = pathExistsInternal(cwd, 'package.json') ||
                   pathExistsInternal(cwd, 'requirements.txt') ||
                   pathExistsInternal(cwd, 'Cargo.toml') ||
                   pathExistsInternal(cwd, 'go.mod') ||
                   pathExistsInternal(cwd, 'Package.swift') ||
                   pathExistsInternal(cwd, 'build.gradle') ||
                   pathExistsInternal(cwd, 'build.gradle.kts') ||
                   pathExistsInternal(cwd, 'pom.xml') ||
                   pathExistsInternal(cwd, 'Gemfile') ||
                   pathExistsInternal(cwd, 'composer.json') ||
                   pathExistsInternal(cwd, 'pubspec.yaml') ||
                   pathExistsInternal(cwd, 'CMakeLists.txt') ||
                   pathExistsInternal(cwd, 'Makefile') ||
                   pathExistsInternal(cwd, 'build.zig') ||
                   pathExistsInternal(cwd, 'mix.exs') ||
                   pathExistsInternal(cwd, 'project.clj');

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),

    // Config
    commit_docs: config.commit_docs,

    // Existing state
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    has_codebase_map: pathExistsInternal(cwd, '.planning/codebase'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // Brownfield detection
    has_existing_code: hasCode,
    has_package_file: hasPackageFile,
    is_brownfield: hasCode || hasPackageFile,
    needs_codebase_map: (hasCode || hasPackageFile) && !pathExistsInternal(cwd, '.planning/codebase'),

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),

    // Enhanced search
    brave_search_available: hasBraveSearch,
    firecrawl_available: hasFirecrawl,
    exa_search_available: hasExaSearch,

    // File paths
    project_path: '.planning/PROJECT.md',
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitNewMilestone(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);
  const latestCompleted = getLatestCompletedMilestone(cwd);
  const phasesDir = path.join(planningDir(cwd), 'phases');
  let phaseDirCount = 0;

  try {
    if (fs.existsSync(phasesDir)) {
      // Bug #2445: filter phase dirs to current milestone only so stale dirs
      // from a prior milestone that were not archived don't inflate the count.
      const isDirInMilestone = getMilestonePhaseFilter(cwd);
      phaseDirCount = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && isDirInMilestone(entry.name))
        .length;
    }
  } catch {}

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),

    // Config
    commit_docs: config.commit_docs,
    research_enabled: config.research,

    // Current milestone
    current_milestone: milestone.version,
    current_milestone_name: milestone.name,
    latest_completed_milestone: latestCompleted?.version || null,
    latest_completed_milestone_name: latestCompleted?.name || null,
    phase_dir_count: phaseDirCount,
    phase_archive_path: latestCompleted ? toPosixPath(path.relative(cwd, path.join(planningRoot(cwd), 'milestones', `${latestCompleted.version}-phases`))) : null,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: fs.existsSync(path.join(planningDir(cwd), 'ROADMAP.md')),
    state_exists: fs.existsSync(path.join(planningDir(cwd), 'STATE.md')),

    // File paths
    project_path: '.planning/PROJECT.md',
    roadmap_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'ROADMAP.md'))),
    state_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'STATE.md'))),
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitQuick(cwd, description, raw) {
  const config = loadConfig(cwd);
  const now = new Date();
  const slug = description ? generateSlugInternal(description)?.substring(0, 40) : null;

  // Generate collision-resistant quick task ID: YYMMDD-xxx
  // xxx = 2-second precision blocks since midnight, encoded as 3-char Base36 (lowercase)
  // Range: 000 (00:00:00) to xbz (23:59:58), guaranteed 3 chars for any time of day.
  // Provides ~2s uniqueness window per user — practically collision-free across a team.
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = yy + mm + dd;
  const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const timeBlocks = Math.floor(secondsSinceMidnight / 2);
  const timeEncoded = timeBlocks.toString(36).padStart(3, '0');
  const quickId = dateStr + '-' + timeEncoded;
  const branchSlug = slug || 'quick';
  const quickBranchName = config.quick_branch_template
    ? config.quick_branch_template
        .replace('{num}', quickId)
        .replace('{quick}', quickId)
        .replace('{slug}', branchSlug)
    : null;

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config
    commit_docs: config.commit_docs,
    branch_name: quickBranchName,

    // Quick task info
    quick_id: quickId,
    slug: slug,
    description: description || null,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Paths
    quick_dir: '.planning/quick',
    task_dir: slug ? `.planning/quick/${quickId}-${slug}` : null,

    // File existence
    roadmap_exists: fs.existsSync(path.join(planningDir(cwd), 'ROADMAP.md')),
    planning_exists: fs.existsSync(planningRoot(cwd)),

  };

  output(withProjectRoot(cwd, result), raw);
}

/**
 * Init handler for ingest-docs workflow (#2801).
 *
 * Returns the minimal set of fields that ingest-docs.md needs to detect
 * whether a project/planning dir exists and choose new vs merge mode.
 * Mirrors the initIngestDocs SDK handler in sdk/src/query/init.ts.
 */
function cmdInitIngestDocs(cwd, raw) {
  const config = loadConfig(cwd);
  const result = {
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    planning_exists: fs.existsSync(planningRoot(cwd)),
    has_git: fs.existsSync(path.join(cwd, '.git')),
    project_path: '.planning/PROJECT.md',
    commit_docs: config.commit_docs,
  };
  output(withProjectRoot(cwd, result), raw);
}

function cmdInitResume(cwd, raw) {
  const config = loadConfig(cwd);

  // Check for interrupted agent
  let interruptedAgentId = null;
  const agentIdRaw = platformReadSync(path.join(planningRoot(cwd), 'current-agent-id.txt'));
  if (agentIdRaw !== null) interruptedAgentId = agentIdRaw.trim();

  const result = {
    // File existence
    state_exists: fs.existsSync(path.join(planningDir(cwd), 'STATE.md')),
    roadmap_exists: fs.existsSync(path.join(planningDir(cwd), 'ROADMAP.md')),
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    planning_exists: fs.existsSync(planningRoot(cwd)),

    // File paths
    state_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'STATE.md'))),
    roadmap_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'ROADMAP.md'))),
    project_path: '.planning/PROJECT.md',

    // Agent state
    has_interrupted_agent: !!interruptedAgentId,
    interrupted_agent_id: interruptedAgentId,

    // Config
    commit_docs: config.commit_docs,
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitVerifyWork(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init verify-work');
  }

  const config = loadConfig(cwd);
  let phaseInfo = findPhaseInternal(cwd, phase);

  // If findPhaseInternal matched an archived phase from a prior milestone, but
  // the phase exists in the current milestone's ROADMAP.md, ignore the archive
  // match — same pattern as cmdInitPhaseOp.
  if (phaseInfo?.archived) {
    const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
    if (roadmapPhase?.found) {
      phaseInfo = null;
    }
  }

  // Fallback to ROADMAP.md if no phase directory exists yet
  if (!phaseInfo) {
    const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
    if (roadmapPhase?.found) {
      const phaseName = roadmapPhase.phase_name;
      phaseInfo = {
        found: true,
        directory: null,
        phase_number: roadmapPhase.phase_number,
        phase_name: phaseName,
        phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
        plans: [],
        summaries: [],
        incomplete_plans: [],
        has_research: false,
        has_context: false,
        has_verification: false,
      };
    }
  }

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Config
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,

    // Existing artifacts
    has_verification: phaseInfo?.has_verification || false,
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitPhaseOp(cwd, phase, raw) {
  const config = loadConfig(cwd);
  let phaseInfo = findPhaseInternal(cwd, phase);

  // If the only disk match comes from an archived milestone, prefer the
  // current milestone's ROADMAP entry so discuss-phase and similar flows
  // don't attach to shipped work that reused the same phase number.
  if (phaseInfo?.archived) {
    const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
    if (roadmapPhase?.found) {
      const phaseName = roadmapPhase.phase_name;
      phaseInfo = {
        found: true,
        directory: null,
        phase_number: roadmapPhase.phase_number,
        phase_name: phaseName,
        phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
        plans: [],
        summaries: [],
        incomplete_plans: [],
        has_research: false,
        has_context: false,
        has_verification: false,
      };
    }
  }

  // Fallback to ROADMAP.md if no directory exists (e.g., Plans: TBD)
  if (!phaseInfo) {
    const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
    if (roadmapPhase?.found) {
      const phaseName = roadmapPhase.phase_name;
      phaseInfo = {
        found: true,
        directory: null,
        phase_number: roadmapPhase.phase_number,
        phase_name: phaseName,
        phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
        plans: [],
        summaries: [],
        incomplete_plans: [],
        has_research: false,
        has_context: false,
        has_verification: false,
      };
    }
  }

  // #3287: compute the canonical directory name with project_code prefix so
  // the first-touch mkdir in /gsd:discuss-phase stays consistent with phase.add.
  const phaseDir = phaseInfo?.directory || null;
  const phaseNumber = phaseInfo?.phase_number || null;
  const phaseName = phaseInfo?.phase_name || null;
  const rawProjectCode = config.project_code || '';
  let expectedPhaseDir = null;
  if (!phaseDir && phaseNumber && phaseName) {
    const paddedNum = normalizePhaseName(phaseNumber);
    const slug = generateSlugInternal(phaseName).substring(0, 60);
    if (slug) {
      const prefix = rawProjectCode ? `${rawProjectCode}-` : '';
      const dirName = `${prefix}${paddedNum}-${slug}`;
      expectedPhaseDir = toPosixPath(path.relative(cwd, path.join(planningPaths(cwd).phases, dirName)));
    }
  }

  const result = {
    // Config
    commit_docs: config.commit_docs,
    // #2997: secret config keys may be either booleans (availability flags) or
    // string API keys (when user did `gsd-tools config-set brave_search XXX`).
    // Pass booleans through; mask string values so the init bundle never echoes
    // plaintext credentials. SDK init.ts mirrors this masking.
    brave_search: typeof config.brave_search === 'string' ? maskIfSecret('brave_search', config.brave_search) : config.brave_search,
    firecrawl: typeof config.firecrawl === 'string' ? maskIfSecret('firecrawl', config.firecrawl) : config.firecrawl,
    exa_search: typeof config.exa_search === 'string' ? maskIfSecret('exa_search', config.exa_search) : config.exa_search,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseDir,
    expected_phase_dir: expectedPhaseDir,
    phase_number: phaseNumber,
    phase_name: phaseName,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseNumber ? normalizePhaseName(phaseNumber) : null,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    has_verification: phaseInfo?.has_verification || false,
    has_reviews: phaseInfo?.has_reviews || false,
    plan_count: phaseInfo?.plans?.length || 0,

    // File existence
    roadmap_exists: fs.existsSync(path.join(planningDir(cwd), 'ROADMAP.md')),
    planning_exists: fs.existsSync(planningDir(cwd)),

    // File paths
    state_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'STATE.md'))),
    roadmap_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'ROADMAP.md'))),
    requirements_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'REQUIREMENTS.md'))),
  };

  if (phaseInfo?.directory) {
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) {
        result.context_path = toPosixPath(path.join(phaseInfo.directory, contextFile));
      }
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) {
        result.research_path = toPosixPath(path.join(phaseInfo.directory, researchFile));
      }
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) {
        result.verification_path = toPosixPath(path.join(phaseInfo.directory, verificationFile));
      }
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) {
        result.uat_path = toPosixPath(path.join(phaseInfo.directory, uatFile));
      }
      const reviewsFile = files.find(f => f.endsWith('-REVIEWS.md') || f === 'REVIEWS.md');
      if (reviewsFile) {
        result.reviews_path = toPosixPath(path.join(phaseInfo.directory, reviewsFile));
      }
    } catch { /* intentionally empty */ }
  }

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitTodos(cwd, area, raw) {
  const config = loadConfig(cwd);
  const now = new Date();

  // List todos (reuse existing logic)
  const pendingDir = path.join(planningDir(cwd), 'todos', 'pending');
  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = platformReadSync(path.join(pendingDir, file));
      if (content === null) continue;
      try {
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'todos', 'pending', file))),
        });
      } catch { /* intentionally empty */ }
    }
  } catch { /* intentionally empty */ }

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Todo inventory
    todo_count: count,
    todos,
    area_filter: area || null,

    // Paths
    pending_dir: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'todos', 'pending'))),
    completed_dir: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'todos', 'completed'))),

    // File existence
    planning_exists: fs.existsSync(planningDir(cwd)),
    todos_dir_exists: fs.existsSync(path.join(planningDir(cwd), 'todos')),
    pending_dir_exists: fs.existsSync(path.join(planningDir(cwd), 'todos', 'pending')),
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitMilestoneOp(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Count phases
  let phaseCount = 0;
  let completedPhases = 0;
  const phasesDir = path.join(planningDir(cwd), 'phases');

  // Bug #2633 — ROADMAP.md (current milestone section) is the authority for
  // phase counts, NOT the on-disk `.planning/phases/` directory. After
  // `phases clear` between milestones, on-disk dirs will be a subset of the
  // roadmap until each phase is materialized; reading from disk causes
  // `all_phases_complete: true` to fire prematurely.
  let roadmapPhaseNumbers = [];
  try {
    const roadmapPath = path.join(planningDir(cwd), 'ROADMAP.md');
    const roadmapRaw = fs.readFileSync(roadmapPath, 'utf-8');
    const currentSection = extractCurrentMilestone(roadmapRaw, cwd);
    const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
    let m;
    while ((m = phasePattern.exec(currentSection)) !== null) {
      roadmapPhaseNumbers.push(m[1]);
    }
  } catch { /* intentionally empty */ }

  // Canonicalize a phase token by stripping leading zeros from the integer
  // head while preserving any [A-Z]? suffix and dotted segments. So "03" →
  // "3", "03A" → "3A", "03.1" → "3.1", "3A" → "3A". Disk dirs that pad
  // ("03-alpha") then match roadmap tokens ("Phase 3") without ever
  // collapsing distinct tokens like "3" / "3A" / "3.1" into the same bucket.
  const canonicalizePhase = (tok) => {
    const m = tok.match(/^(\d+)([A-Z]?(?:\.\d+)*)$/);
    return m ? String(parseInt(m[1], 10)) + m[2] : tok;
  };
  const diskPhaseDirs = new Map();
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const m = e.name.match(/^(\d+[A-Z]?(?:\.\d+)*)/);
      if (!m) continue;
      diskPhaseDirs.set(canonicalizePhase(m[1]), e.name);
    }
  } catch { /* intentionally empty */ }

  if (roadmapPhaseNumbers.length > 0) {
    phaseCount = roadmapPhaseNumbers.length;
    for (const num of roadmapPhaseNumbers) {
      const dirName = diskPhaseDirs.get(canonicalizePhase(num));
      if (!dirName) continue;
      try {
        const hasSummary = listPhaseSummaryFiles(path.join(phasesDir, dirName)).length > 0;
        if (hasSummary) completedPhases++;
      } catch { /* intentionally empty */ }
    }
  } else {
    // Fallback: no parseable ROADMAP — preserve legacy on-disk behavior.
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      phaseCount = dirs.length;
      for (const dir of dirs) {
        try {
          const hasSummary = listPhaseSummaryFiles(path.join(phasesDir, dir)).length > 0;
          if (hasSummary) completedPhases++;
        } catch { /* intentionally empty */ }
      }
    } catch { /* intentionally empty */ }
  }

  // Check archive
  const archiveDir = path.join(planningRoot(cwd), 'archive');
  let archivedMilestones = [];
  try {
    archivedMilestones = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch { /* intentionally empty */ }

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Current milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // Phase counts
    phase_count: phaseCount,
    completed_phases: completedPhases,
    all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,

    // Archive
    archived_milestones: archivedMilestones,
    archive_count: archivedMilestones.length,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: fs.existsSync(path.join(planningDir(cwd), 'ROADMAP.md')),
    state_exists: fs.existsSync(path.join(planningDir(cwd), 'STATE.md')),
    archive_exists: fs.existsSync(path.join(planningRoot(cwd), 'archive')),
    phases_dir_exists: fs.existsSync(path.join(planningDir(cwd), 'phases')),
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitMapCodebase(cwd, raw) {
  const config = loadConfig(cwd);
  const now = new Date();

  // Check for existing codebase maps
  const codebaseDir = path.join(planningRoot(cwd), 'codebase');
  let existingMaps = [];
  try {
    existingMaps = fs.readdirSync(codebaseDir).filter(f => f.endsWith('.md'));
  } catch { /* intentionally empty */ }

  const result = {
    // Models
    mapper_model: resolveModelInternal(cwd, 'gsd-codebase-mapper'),

    // Config
    commit_docs: config.commit_docs,
    search_gitignored: config.search_gitignored,
    parallelization: config.parallelization,
    subagent_timeout: config.subagent_timeout,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Paths
    codebase_dir: '.planning/codebase',

    // Existing maps
    existing_maps: existingMaps,
    has_maps: existingMaps.length > 0,

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    codebase_dir_exists: pathExistsInternal(cwd, '.planning/codebase'),
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitManager(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Use planningPaths for forward-compatibility with workstream scoping (#1268)
  const paths = planningPaths(cwd);

  // Validate prerequisites
  if (!fs.existsSync(paths.roadmap)) {
    error('No ROADMAP.md found. Run /gsd:new-milestone first.');
  }
  if (!fs.existsSync(paths.state)) {
    error('No STATE.md found. Run /gsd:new-milestone first.');
  }
  const rawContent = fs.readFileSync(paths.roadmap, 'utf-8');
  const content = extractCurrentMilestone(rawContent, cwd);
  const phasesDir = paths.phases;
  const isDirInMilestone = getMilestonePhaseFilter(cwd);

  // Pre-compute directory listing once (avoids O(N) readdirSync per phase)
  const _phaseDirEntries = (() => {
    try {
      return fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch { return []; }
  })();

  // Pre-extract all checkbox states in a single pass (avoids O(N) regex per phase)
  const _checkboxStates = new Map();
  const _cbPattern = /-\s*\[(x| )\]\s*.*Phase\s+(\d+[A-Z]?(?:\.\d+)*)[:\s]/gi;
  let _cbMatch;
  while ((_cbMatch = _cbPattern.exec(content)) !== null) {
    _checkboxStates.set(_cbMatch[2], _cbMatch[1].toLowerCase() === 'x');
  }

  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
  const phases = [];
  let match;

  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].replace(/\(INSERTED\)/i, '').trim();

    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
    const section = content.slice(sectionStart, sectionEnd);

    const goalMatch = section.match(/\*\*Goal(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const depends_on = dependsMatch ? dependsMatch[1].trim() : null;

    const normalized = normalizePhaseName(phaseNum);
    let diskStatus = 'no_directory';
    let planCount = 0;
    let summaryCount = 0;
    let hasContext = false;
    let hasResearch = false;
    let lastActivity = null;
    let isActive = false;

    try {
      const dirs = _phaseDirEntries.filter(isDirInMilestone);
      const dirMatch = dirs.find(d => phaseTokenMatches(d, normalized));

      if (dirMatch) {
        const fullDir = path.join(phasesDir, dirMatch);
        const phaseFiles = fs.readdirSync(fullDir);
        planCount = listPhasePlanFiles(fullDir).length;
        summaryCount = listPhaseSummaryFiles(fullDir).length;
        hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
        hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

        if (summaryCount >= planCount && planCount > 0) diskStatus = 'complete';
        else if (summaryCount > 0) diskStatus = 'partial';
        else if (planCount > 0) diskStatus = 'planned';
        else if (hasResearch) diskStatus = 'researched';
        else if (hasContext) diskStatus = 'discussed';
        else diskStatus = 'empty';

        // Activity detection: check most recent file mtime
        const now = Date.now();
        let newestMtime = 0;
        for (const f of phaseFiles) {
          try {
            const stat = fs.statSync(path.join(fullDir, f));
            if (stat.mtimeMs > newestMtime) newestMtime = stat.mtimeMs;
          } catch { /* intentionally empty */ }
        }
        if (newestMtime > 0) {
          lastActivity = new Date(newestMtime).toISOString();
          isActive = (now - newestMtime) < 300000; // 5 minutes
        }
      }
    } catch { /* intentionally empty */ }

    // Check ROADMAP checkbox status (pre-extracted above the loop)
    const roadmapComplete = _checkboxStates.get(phaseNum) || false;
    if (roadmapComplete && diskStatus !== 'complete') {
      diskStatus = 'complete';
    }

    phases.push({
      number: phaseNum,
      name: phaseName,
      goal,
      depends_on,
      disk_status: diskStatus,
      has_context: hasContext,
      has_research: hasResearch,
      plan_count: planCount,
      summary_count: summaryCount,
      roadmap_complete: roadmapComplete,
      last_activity: lastActivity,
      is_active: isActive,
    });
  }

  // Compute display names: truncate to keep table aligned
  const MAX_NAME_WIDTH = 20;
  for (const phase of phases) {
    if (phase.name.length > MAX_NAME_WIDTH) {
      phase.display_name = phase.name.slice(0, MAX_NAME_WIDTH - 1) + '…';
    } else {
      phase.display_name = phase.name;
    }
  }

  // Dependency satisfaction: check if all depends_on phases are complete
  const completedNums = new Set(phases.filter(p => p.disk_status === 'complete').map(p => p.number));

  // Also include phases from previously shipped milestones — they are all
  // complete by definition (a milestone only ships when all phases are done).
  // rawContent is the full ROADMAP.md (including <details>-wrapped shipped
  // milestone sections that extractCurrentMilestone strips out).
  const _allCompletedPattern = /-\s*\[x\]\s*.*Phase\s+(\d+[A-Z]?(?:\.\d+)*)[:\s]/gi;
  let _allMatch;
  while ((_allMatch = _allCompletedPattern.exec(rawContent)) !== null) {
    completedNums.add(_allMatch[1]);
  }

  for (const phase of phases) {
    if (!phase.depends_on || /^none$/i.test(phase.depends_on.trim())) {
      phase.deps_satisfied = true;
    } else {
      // Parse "Phase 1, Phase 3" or "1, 3" formats
      const depNums = phase.depends_on.match(/\d+(?:\.\d+)*/g) || [];
      phase.deps_satisfied = depNums.every(n => completedNums.has(n));
      phase.dep_phases = depNums;
    }
  }

  // Compact dependency display for dashboard
  for (const phase of phases) {
    phase.deps_display = (phase.dep_phases && phase.dep_phases.length > 0)
      ? phase.dep_phases.join(',')
      : '—';
  }

  for (const phase of phases) {
    phase.is_next_to_discuss =
      (phase.disk_status === 'empty' || phase.disk_status === 'no_directory') &&
      phase.deps_satisfied;
  }

  // Check for WAITING.json signal
  let waitingSignal = null;
  try {
    const waitingPath = path.join(cwd, '.planning', 'WAITING.json');
    const waitingRaw = platformReadSync(waitingPath);
    if (waitingRaw !== null) {
      waitingSignal = JSON.parse(waitingRaw);
    }
  } catch { /* intentionally empty */ }

  // Compute recommended actions (execute > plan > discuss)
  // Skip BACKLOG phases (999.x numbering) — they are parked ideas, not active work
  const recommendedActions = [];
  for (const phase of phases) {
    if (phase.disk_status === 'complete') continue;
    if (/^999(?:\.|$)/.test(phase.number)) continue;

    if (phase.disk_status === 'planned' && phase.deps_satisfied) {
      recommendedActions.push({
        phase: phase.number,
        phase_name: phase.name,
        action: 'execute',
        reason: `${phase.plan_count} plans ready, dependencies met`,
        command: `/gsd:execute-phase ${phase.number}`,
      });
    } else if (phase.disk_status === 'discussed' || phase.disk_status === 'researched') {
      recommendedActions.push({
        phase: phase.number,
        phase_name: phase.name,
        action: 'plan',
        reason: 'Context gathered, ready for planning',
        command: `/gsd:plan-phase ${phase.number}`,
      });
    } else if ((phase.disk_status === 'empty' || phase.disk_status === 'no_directory') && phase.is_next_to_discuss) {
      recommendedActions.push({
        phase: phase.number,
        phase_name: phase.name,
        action: 'discuss',
        reason: 'Unblocked, ready to gather context',
        command: `/gsd:discuss-phase ${phase.number}`,
      });
    }
  }

  // Filter recommendations: no parallel execute/plan unless phases are independent
  // Two phases are "independent" if neither depends on the other (directly or transitively)
  const phaseMap = new Map(phases.map(p => [p.number, p]));

  function reaches(from, to, visited = new Set()) {
    if (visited.has(from)) return false;
    visited.add(from);
    const p = phaseMap.get(from);
    if (!p || !p.dep_phases || p.dep_phases.length === 0) return false;
    if (p.dep_phases.includes(to)) return true;
    return p.dep_phases.some(dep => reaches(dep, to, visited));
  }

  function hasDepRelationship(numA, numB) {
    return reaches(numA, numB) || reaches(numB, numA);
  }

  // Detect phases with active work (file modified in last 5 min)
  const activeExecuting = phases.filter(p =>
    p.disk_status === 'partial' ||
    (p.disk_status === 'planned' && p.is_active)
  );
  const activePlanning = phases.filter(p =>
    p.is_active && (p.disk_status === 'discussed' || p.disk_status === 'researched')
  );

  const filteredActions = recommendedActions.filter(action => {
    if (action.action === 'execute' && activeExecuting.length > 0) {
      // Only allow if independent of ALL actively-executing phases
      return activeExecuting.every(active => !hasDepRelationship(action.phase, active.number));
    }
    if (action.action === 'plan' && activePlanning.length > 0) {
      // Only allow if independent of ALL actively-planning phases
      return activePlanning.every(active => !hasDepRelationship(action.phase, active.number));
    }
    return true;
  });

  // Exclude backlog phases (999.x) from completion accounting (#2129)
  const nonBacklogPhases = phases.filter(p => !/^999(?:\.|$)/.test(p.number));
  const completedCount = nonBacklogPhases.filter(p => p.disk_status === 'complete').length;

  // Read manager flags from config (passthrough flags for each step)
  // Validate: flags must be CLI-safe (only --flags, alphanumeric, hyphens, spaces)
  const sanitizeFlags = (raw) => {
    const val = typeof raw === 'string' ? raw : '';
    if (!val) return '';
    // Allow only --flag patterns with alphanumeric/hyphen values separated by spaces
    const tokens = val.split(/\s+/).filter(Boolean);
    const safe = tokens.every(t => /^--[a-zA-Z0-9][-a-zA-Z0-9]*$/.test(t) || /^[a-zA-Z0-9][-a-zA-Z0-9_.]*$/.test(t));
    if (!safe) {
      process.stderr.write(`gsd-tools: warning: manager.flags contains invalid tokens, ignoring: ${val}\n`);
      return '';
    }
    return val;
  };
  const managerFlags = {
    discuss: sanitizeFlags(config.manager && config.manager.flags && config.manager.flags.discuss),
    plan: sanitizeFlags(config.manager && config.manager.flags && config.manager.flags.plan),
    execute: sanitizeFlags(config.manager && config.manager.flags && config.manager.flags.execute),
  };

  const result = {
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    phases,
    phase_count: phases.length,
    completed_count: completedCount,
    in_progress_count: phases.filter(p => ['partial', 'planned', 'discussed', 'researched'].includes(p.disk_status)).length,
    recommended_actions: filteredActions,
    waiting_signal: waitingSignal,
    all_complete: completedCount === nonBacklogPhases.length && nonBacklogPhases.length > 0,
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: true,
    state_exists: true,
    manager_flags: managerFlags,
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitProgress(cwd, raw) {
  try {
    const { pruneOrphanedWorktrees } = require('./core.cjs');
    pruneOrphanedWorktrees(cwd);
  } catch (_) {}
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Analyze phases — filter to current milestone and include ROADMAP-only phases
  const phasesDir = path.join(planningDir(cwd), 'phases');
  const phases = [];
  let currentPhase = null;
  let nextPhase = null;

  // Build set of phases defined in ROADMAP for the current milestone
  const roadmapPhaseNums = new Set();
  const roadmapPhaseNames = new Map();
  const roadmapCheckboxStates = new Map();
  try {
    const roadmapContent = extractCurrentMilestone(
      fs.readFileSync(path.join(planningDir(cwd), 'ROADMAP.md'), 'utf-8'), cwd
    );
    const headingPattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
    let hm;
    while ((hm = headingPattern.exec(roadmapContent)) !== null) {
      roadmapPhaseNums.add(hm[1]);
      roadmapPhaseNames.set(hm[1], hm[2].replace(/\(INSERTED\)/i, '').trim());
    }
    // #2646: parse `- [x] Phase N` checkbox states so ROADMAP-only phases
    // inherit completion from the ROADMAP when no phase directory exists.
    const cbPattern = /-\s*\[(x| )\]\s*.*Phase\s+(\d+[A-Z]?(?:\.\d+)*)[:\s]/gi;
    let cbm;
    while ((cbm = cbPattern.exec(roadmapContent)) !== null) {
      roadmapCheckboxStates.set(cbm[2], cbm[1].toLowerCase() === 'x');
    }
  } catch { /* intentionally empty */ }

  const isDirInMilestone = getMilestonePhaseFilter(cwd);
  const seenPhaseNums = new Set();

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
      .filter(isDirInMilestone)
      .sort((a, b) => {
        const pa = a.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
        const pb = b.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
        if (!pa || !pb) return a.localeCompare(b);
        return parseInt(pa[1], 10) - parseInt(pb[1], 10);
      });

    for (const dir of dirs) {
      const match = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
      const phaseNumber = match ? match[1] : dir;
      const phaseName = match && match[2] ? match[2] : null;
      seenPhaseNums.add(phaseNumber.replace(/^0+/, '') || '0');

      const phasePath = path.join(phasesDir, dir);
      const phaseFiles = fs.readdirSync(phasePath);

      const plans = listPhasePlanFiles(phasePath);
      const summaries = listPhaseSummaryFiles(phasePath);
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

      const status = summaries.length >= plans.length && plans.length > 0 ? 'complete' :
                     plans.length > 0 ? 'in_progress' :
                     hasResearch ? 'researched' : 'pending';

      const phaseInfo = {
        number: phaseNumber,
        name: phaseName,
        directory: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'phases', dir))),
        status,
        plan_count: plans.length,
        summary_count: summaries.length,
        has_research: hasResearch,
      };

      phases.push(phaseInfo);

      // Find current (first incomplete with plans) and next (first pending)
      if (!currentPhase && (status === 'in_progress' || status === 'researched')) {
        currentPhase = phaseInfo;
      }
      if (!nextPhase && status === 'pending') {
        nextPhase = phaseInfo;
      }
    }
  } catch { /* intentionally empty */ }

  // Add phases defined in ROADMAP but not yet scaffolded to disk. When the
  // ROADMAP has a `- [x] Phase N` checkbox, honor it as 'complete' so
  // completed_count and status reflect the ROADMAP source of truth (#2646).
  for (const [num, name] of roadmapPhaseNames) {
    const stripped = num.replace(/^0+/, '') || '0';
    if (!seenPhaseNums.has(stripped)) {
      const checkboxComplete =
        roadmapCheckboxStates.get(num) === true ||
        roadmapCheckboxStates.get(stripped) === true;
      const status = checkboxComplete ? 'complete' : 'not_started';
      const phaseInfo = {
        number: num,
        name: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        directory: null,
        status,
        plan_count: 0,
        summary_count: 0,
        has_research: false,
      };
      phases.push(phaseInfo);
      if (!nextPhase && !currentPhase && status !== 'complete') {
        nextPhase = phaseInfo;
      }
    }
  }

  // Re-sort phases by number after adding ROADMAP-only phases
  phases.sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));

  // Check for paused work
  let pausedAt = null;
  const state = platformReadSync(path.join(planningDir(cwd), 'STATE.md'));
  if (state !== null) {
    const pauseMatch = state.match(/\*\*Paused At:\*\*\s*(.+)/);
    if (pauseMatch) pausedAt = pauseMatch[1].trim();
  }

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),

    // Config
    commit_docs: config.commit_docs,

    // Milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,

    // Phase overview
    phases,
    phase_count: phases.length,
    completed_count: phases.filter(p => p.status === 'complete').length,
    in_progress_count: phases.filter(p => p.status === 'in_progress').length,

    // Current state
    current_phase: currentPhase,
    next_phase: nextPhase,
    paused_at: pausedAt,
    has_work_in_progress: !!currentPhase,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: fs.existsSync(path.join(planningDir(cwd), 'ROADMAP.md')),
    state_exists: fs.existsSync(path.join(planningDir(cwd), 'STATE.md')),
    // File paths
    state_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'STATE.md'))),
    roadmap_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'ROADMAP.md'))),
    project_path: '.planning/PROJECT.md',
    config_path: toPosixPath(path.relative(cwd, path.join(planningDir(cwd), 'config.json'))),
  };

  output(withProjectRoot(cwd, result), raw);
}

/**
 * Detect child git repos in a directory (one level deep).
 * Returns array of { name, path, has_uncommitted } objects.
 */
function detectChildRepos(dir) {
  const repos = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return repos; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    const gitDir = path.join(fullPath, '.git');
    if (fs.existsSync(gitDir)) {
      const statusResult = execGit(['status', '--porcelain'], { cwd: fullPath, timeout: 5000 });
      const hasUncommitted = statusResult.exitCode === 0 && statusResult.stdout.length > 0;
      repos.push({ name: entry.name, path: fullPath, has_uncommitted: hasUncommitted });
    }
  }
  return repos;
}

function cmdInitNewWorkspace(cwd, raw) {
  const homedir = process.env.HOME || require('os').homedir();
  const defaultBase = path.join(homedir, 'gsd-workspaces');

  // Detect child git repos for interactive selection
  const childRepos = detectChildRepos(cwd);

  // Check if git worktree is available
  const gitVersion = execGit(['--version'], { timeout: 5000 });
  const worktreeAvailable = gitVersion.exitCode === 0;

  const result = {
    default_workspace_base: defaultBase,
    child_repos: childRepos,
    child_repo_count: childRepos.length,
    worktree_available: worktreeAvailable,
    is_git_repo: pathExistsInternal(cwd, '.git'),
    cwd_repo_name: path.basename(cwd),
  };

  output(withProjectRoot(cwd, result), raw);
}

function cmdInitListWorkspaces(cwd, raw) {
  const homedir = process.env.HOME || require('os').homedir();
  const defaultBase = path.join(homedir, 'gsd-workspaces');

  const workspaces = [];
  if (fs.existsSync(defaultBase)) {
    let entries;
    try { entries = fs.readdirSync(defaultBase, { withFileTypes: true }); } catch { entries = []; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const wsPath = path.join(defaultBase, entry.name);
      const manifestPath = path.join(wsPath, 'WORKSPACE.md');
      if (!fs.existsSync(manifestPath)) continue;

      let repoCount = 0;
      let hasProject = false;
      let strategy = 'unknown';
      const manifest = platformReadSync(manifestPath);
      if (manifest !== null) {
        const strategyMatch = manifest.match(/^Strategy:\s*(.+)$/m);
        if (strategyMatch) strategy = strategyMatch[1].trim();
        // Count table rows (lines starting with |, excluding header and separator)
        const tableRows = manifest.split('\n').filter(l => l.match(/^\|\s*\w/) && !l.includes('Repo') && !l.includes('---'));
        repoCount = tableRows.length;
      }
      hasProject = fs.existsSync(path.join(wsPath, '.planning', 'PROJECT.md'));

      workspaces.push({
        name: entry.name,
        path: wsPath,
        repo_count: repoCount,
        strategy,
        has_project: hasProject,
      });
    }
  }

  const result = {
    workspace_base: defaultBase,
    workspaces,
    workspace_count: workspaces.length,
  };

  output(result, raw);
}

function cmdInitRemoveWorkspace(cwd, name, raw) {
  const homedir = process.env.HOME || require('os').homedir();
  const defaultBase = path.join(homedir, 'gsd-workspaces');

  if (!name) {
    error('workspace name required for init remove-workspace');
  }

  const wsPath = path.join(defaultBase, name);
  const manifestPath = path.join(wsPath, 'WORKSPACE.md');

  if (!fs.existsSync(wsPath)) {
    error(`Workspace not found: ${wsPath}`);
  }

  // Parse manifest for repo info
  const repos = [];
  let strategy = 'unknown';
  const manifestContent = platformReadSync(manifestPath);
  if (manifestContent !== null) {
    try {
      const manifest = manifestContent;
      const strategyMatch = manifest.match(/^Strategy:\s*(.+)$/m);
      if (strategyMatch) strategy = strategyMatch[1].trim();

      // Parse table rows for repo names and source paths
      const lines = manifest.split('\n');
      for (const line of lines) {
        const match = line.match(/^\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|$/);
        if (match && match[1] !== 'Repo' && !match[1].includes('---')) {
          repos.push({ name: match[1], source: match[2], branch: match[3], strategy: match[4] });
        }
      }
    } catch { /* best-effort */ }
  }

  // Check for uncommitted changes in workspace repos
  const dirtyRepos = [];
  for (const repo of repos) {
    const repoPath = path.join(wsPath, repo.name);
    if (!fs.existsSync(repoPath)) continue;
    const statusResult = execGit(['status', '--porcelain'], { cwd: repoPath, timeout: 5000 });
    if (statusResult.exitCode === 0 && statusResult.stdout.length > 0) {
      dirtyRepos.push(repo.name);
    }
  }

  const result = {
    workspace_name: name,
    workspace_path: wsPath,
    has_manifest: fs.existsSync(manifestPath),
    strategy,
    repos,
    repo_count: repos.length,
    dirty_repos: dirtyRepos,
    has_dirty_repos: dirtyRepos.length > 0,
  };

  output(result, raw);
}

/**
 * Build a formatted agent skills block for injection into Task() prompts.
 *
 * Reads `config.agent_skills[agentType]` and validates each skill path exists
 * within the project root. Returns a formatted `<agent_skills>` block or empty
 * string if no skills are configured.
 *
 * @param {object} config - Loaded project config
 * @param {string} agentType - The agent type (e.g., 'gsd-executor', 'gsd-planner')
 * @param {string} projectRoot - Absolute path to project root (for path validation)
 * @returns {string} Formatted skills block or empty string
 */
function buildAgentSkillsBlock(config, agentType, projectRoot) {
  const { validatePath } = require('./security.cjs');
  const os = require('os');
  const { getGlobalSkillDir, getGlobalSkillDisplayPath } = require('./runtime-homes.cjs');
  const runtime = (config && config.runtime) || 'claude';
  const globalSkillsBase = require('./runtime-homes.cjs').getGlobalSkillsBase(runtime);

  if (!config || !config.agent_skills || !agentType) return '';

  let skillPaths = config.agent_skills[agentType];
  if (!skillPaths) return '';

  // Normalize single string to array
  if (typeof skillPaths === 'string') skillPaths = [skillPaths];
  if (!Array.isArray(skillPaths) || skillPaths.length === 0) return '';

  const validPaths = [];
  for (const skillPath of skillPaths) {
    if (typeof skillPath !== 'string') continue;

    // Support global: prefix for skills installed at the runtime's global skills directory (#1992, #3126)
    if (skillPath.startsWith('global:')) {
      const skillName = skillPath.slice(7);
      // Explicit empty-name guard before regex for clearer error message
      if (!skillName) {
        process.stderr.write(`[agent-skills] WARNING: "global:" prefix with empty skill name — skipping\n`);
        continue;
      }
      // Sanitize: skill name must be alphanumeric, hyphens, or underscores only
      if (!/^[a-zA-Z0-9_-]+$/.test(skillName)) {
        process.stderr.write(`[agent-skills] WARNING: Invalid global skill name "${skillName}" — skipping\n`);
        continue;
      }
      // Cline is rules-based and has no global skills directory
      if (globalSkillsBase === null) {
        process.stderr.write(`[agent-skills] WARNING: Runtime "${runtime}" does not use a skills directory — "global:${skillName}" is not supported on this runtime\n`);
        continue;
      }
      const globalSkillDir = getGlobalSkillDir(runtime, skillName);
      const globalSkillMd = path.join(globalSkillDir, 'SKILL.md');
      const displayPath = getGlobalSkillDisplayPath(runtime, skillName);
      if (!fs.existsSync(globalSkillMd)) {
        process.stderr.write(`[agent-skills] WARNING: Global skill not found at "${displayPath}/SKILL.md" — skipping\n`);
        continue;
      }
      // Symlink escape guard: validatePath resolves symlinks and enforces
      // containment within globalSkillsBase. Prevents a skill directory
      // symlinked to an arbitrary location from being injected (#1992).
      const pathCheck = validatePath(globalSkillMd, globalSkillsBase, { allowAbsolute: true });
      if (!pathCheck.safe) {
        process.stderr.write(`[agent-skills] WARNING: Global skill "${skillName}" failed path check (symlink escape?) — skipping\n`);
        continue;
      }
      validPaths.push({ ref: `${globalSkillDir}/SKILL.md`, display: displayPath });
      continue;
    }

    // Validate path safety — must resolve within project root
    const pathCheck = validatePath(skillPath, projectRoot);
    if (!pathCheck.safe) {
      process.stderr.write(`[agent-skills] WARNING: Skipping unsafe path "${skillPath}": ${pathCheck.error}\n`);
      continue;
    }

    // Check that the skill directory and SKILL.md exist
    const skillMdPath = path.join(projectRoot, skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      process.stderr.write(`[agent-skills] WARNING: Skill not found at "${skillPath}/SKILL.md" — skipping\n`);
      continue;
    }

    validPaths.push({ ref: `${skillPath}/SKILL.md`, display: skillPath });
  }

  if (validPaths.length === 0) return '';

  const lines = validPaths.map(p => `- @${p.ref}`).join('\n');
  return `<agent_skills>\nRead these user-configured skills:\n${lines}\n</agent_skills>`;
}

/**
 * Command: output the agent skills block for a given agent type.
 * Used by workflows: SKILLS=$(node "$TOOLS" agent-skills gsd-executor 2>/dev/null)
 */
function cmdAgentSkills(cwd, agentType, raw) {
  if (!agentType) {
    // No agent type — output empty string silently
    output('', raw, '');
    return;
  }

  const config = loadConfig(cwd);
  const block = buildAgentSkillsBlock(config, agentType, cwd);
  // Output raw text (not JSON) so workflows can embed it directly
  if (block) {
    process.stdout.write(block);
  }
  process.exit(0);
}

/**
 * Generate a skill manifest from a skills directory.
 *
 * Scans the canonical skill discovery roots and returns a normalized
 * inventory object with discovered skills, root metadata, and installation
 * summary flags. A legacy `skillsDir` override is still accepted for focused
 * scans, but the default mode is multi-root discovery.
 *
 * @param {string} cwd - Project root directory
 * @param {string|null} [skillsDir] - Optional absolute path to a specific skills directory
 * @returns {{
 *   skills: Array<{name: string, description: string, triggers: string[], path: string, file_path: string, root: string, scope: string, installed: boolean, deprecated: boolean}>,
 *   roots: Array<{root: string, path: string, scope: string, present: boolean, skill_count?: number, command_count?: number, deprecated?: boolean}>,
 *   installation: { gsd_skills_installed: boolean, legacy_claude_commands_installed: boolean },
 *   counts: { skills: number, roots: number }
 * }}
 */
function buildSkillManifest(cwd, skillsDir = null) {
  const { extractFrontmatter } = require('./frontmatter.cjs');
  const { getGlobalSkillsBase } = require('./runtime-homes.cjs');
  const os = require('os');

  const canonicalRoots = skillsDir ? [{
    root: path.resolve(skillsDir),
    path: path.resolve(skillsDir),
    scope: 'custom',
    present: fs.existsSync(skillsDir),
    kind: 'skills',
  }] : [
    {
      root: '.claude/skills',
      path: path.join(cwd, '.claude', 'skills'),
      scope: 'project',
      kind: 'skills',
    },
    {
      root: '.agents/skills',
      path: path.join(cwd, '.agents', 'skills'),
      scope: 'project',
      kind: 'skills',
    },
    {
      root: '.cursor/skills',
      path: path.join(cwd, '.cursor', 'skills'),
      scope: 'project',
      kind: 'skills',
    },
    {
      root: '.github/skills',
      path: path.join(cwd, '.github', 'skills'),
      scope: 'project',
      kind: 'skills',
    },
    {
      root: '.codex/skills',
      path: path.join(cwd, '.codex', 'skills'),
      scope: 'project',
      kind: 'skills',
    },
    {
      root: '~/.claude/skills',
      path: getGlobalSkillsBase('claude'),
      scope: 'global',
      kind: 'skills',
    },
    {
      root: '~/.codex/skills',
      path: getGlobalSkillsBase('codex'),
      scope: 'global',
      kind: 'skills',
    },
    {
      root: '.claude/get-shit-done/skills',
      path: path.join(os.homedir(), '.claude', 'get-shit-done', 'skills'),
      scope: 'import-only',
      kind: 'skills',
      deprecated: true,
    },
    {
      root: '.claude/commands/gsd',
      path: path.join(os.homedir(), '.claude', 'commands', 'gsd'),
      scope: 'legacy-commands',
      kind: 'commands',
      deprecated: true,
    },
  ];

  const skills = [];
  const roots = [];
  let legacyClaudeCommandsInstalled = false;
  for (const rootInfo of canonicalRoots) {
    const rootPath = rootInfo.path;
    const rootSummary = {
      root: rootInfo.root,
      path: rootPath,
      scope: rootInfo.scope,
      present: fs.existsSync(rootPath),
      deprecated: !!rootInfo.deprecated,
    };

    if (!rootSummary.present) {
      roots.push(rootSummary);
      continue;
    }

    if (rootInfo.kind === 'commands') {
      let entries = [];
      try {
        entries = fs.readdirSync(rootPath, { withFileTypes: true });
      } catch {
        roots.push(rootSummary);
        continue;
      }

      const commandFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith('.md'));
      rootSummary.command_count = commandFiles.length;
      if (rootSummary.command_count > 0) legacyClaudeCommandsInstalled = true;
      roots.push(rootSummary);
      continue;
    }

    let entries;
    try {
      entries = fs.readdirSync(rootPath, { withFileTypes: true });
    } catch {
      roots.push(rootSummary);
      continue;
    }

    let skillCount = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillMdPath = path.join(rootPath, entry.name, 'SKILL.md');
      const content = platformReadSync(skillMdPath);
      if (content === null) continue;

      const frontmatter = extractFrontmatter(content);
      const name = frontmatter.name || entry.name;
      const description = frontmatter.description || '';

      // Extract trigger lines from body text (after frontmatter)
      const triggers = [];
      const bodyMatch = content.match(/^---[\s\S]*?---\s*\n([\s\S]*)$/);
      if (bodyMatch) {
        const body = bodyMatch[1];
        const triggerLines = body.match(/^TRIGGER\s+when:\s*(.+)$/gmi);
        if (triggerLines) {
          for (const line of triggerLines) {
            const m = line.match(/^TRIGGER\s+when:\s*(.+)$/i);
            if (m) triggers.push(m[1].trim());
          }
        }
      }

      skills.push({
        name,
        description,
        triggers,
        path: entry.name,
        file_path: `${entry.name}/SKILL.md`,
        root: rootInfo.root,
        scope: rootInfo.scope,
        installed: rootInfo.scope !== 'import-only',
        deprecated: !!rootInfo.deprecated,
      });
      skillCount++;
    }

    rootSummary.skill_count = skillCount;
    roots.push(rootSummary);
  }

  skills.sort((a, b) => {
    const rootCmp = a.root.localeCompare(b.root);
    return rootCmp !== 0 ? rootCmp : a.name.localeCompare(b.name);
  });

  const gsdSkillsInstalled = skills.some(skill => skill.name.startsWith('gsd-'));

  return {
    skills,
    roots,
    installation: {
      gsd_skills_installed: gsdSkillsInstalled,
      legacy_claude_commands_installed: legacyClaudeCommandsInstalled,
    },
    counts: {
      skills: skills.length,
      roots: roots.length,
    },
  };
}

/**
 * Command: generate skill manifest JSON.
 *
 * Options:
 *   --skills-dir <path>  Optional absolute path to a single skills directory
 *   --write              Also write to .planning/skill-manifest.json
 */
function cmdSkillManifest(cwd, args, raw) {
  const skillsDirIdx = args.indexOf('--skills-dir');
  const skillsDir = skillsDirIdx >= 0 && args[skillsDirIdx + 1]
    ? args[skillsDirIdx + 1]
    : null;

  const manifest = buildSkillManifest(cwd, skillsDir);

  // Optionally write to .planning/skill-manifest.json
  if (args.includes('--write')) {
    const planningDir = path.join(cwd, '.planning');
    if (fs.existsSync(planningDir)) {
      const manifestPath = path.join(planningDir, 'skill-manifest.json');
      platformWriteSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
  }

  output(manifest, raw);
}

module.exports = {
  cmdInitExecutePhase,
  cmdInitPlanPhase,
  cmdInitNewProject,
  cmdInitNewMilestone,
  cmdInitQuick,
  cmdInitIngestDocs,
  cmdInitResume,
  cmdInitVerifyWork,
  cmdInitPhaseOp,
  cmdInitTodos,
  cmdInitMilestoneOp,
  cmdInitMapCodebase,
  cmdInitProgress,
  cmdInitManager,
  cmdInitNewWorkspace,
  cmdInitListWorkspaces,
  cmdInitRemoveWorkspace,
  detectChildRepos,
  buildAgentSkillsBlock,
  cmdAgentSkills,
  buildSkillManifest,
  cmdSkillManifest,
};
