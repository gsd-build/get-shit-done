/**
 * Init — Compound init commands for workflow bootstrapping
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadConfig, resolveModelInternal, findPhaseInternal, getRoadmapPhaseInternal, pathExistsInternal, generateSlugInternal, getMilestoneInfo, normalizePhaseName, toPosixPath, output, error } = require('./core.cjs');
const { resolvePlanningPaths } = require('./paths.cjs');

function cmdInitExecutePhase(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init execute-phase');
  }

  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const phaseInfo = findPhaseInternal(cwd, phase, paths);
  const milestone = getMilestoneInfo(cwd, paths);

  const roadmapPhase = getRoadmapPhaseInternal(cwd, phase, paths);
  const reqMatch = roadmapPhase?.section?.match(/^\*\*Requirements\*\*:[^\S\n]*([^\n]*)$/m);
  const reqExtracted = reqMatch
    ? reqMatch[1].replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean).join(', ')
    : null;
  const phase_req_ids = (reqExtracted && reqExtracted !== 'TBD') ? reqExtracted : null;

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config flags
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
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
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // File existence
    state_exists: pathExistsInternal(cwd, paths.rel.state),
    roadmap_exists: pathExistsInternal(cwd, paths.rel.roadmap),
    config_exists: pathExistsInternal(cwd, paths.rel.config),
    // File paths
    state_path: paths.rel.state,
    roadmap_path: paths.rel.roadmap,
    config_path: paths.rel.config,
  };

  output(result, raw);
}

function cmdInitPlanPhase(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init plan-phase');
  }

  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const phaseInfo = findPhaseInternal(cwd, phase, paths);

  const roadmapPhase = getRoadmapPhaseInternal(cwd, phase, paths);
  const reqMatch = roadmapPhase?.section?.match(/^\*\*Requirements\*\*:[^\S\n]*([^\n]*)$/m);
  const reqExtracted = reqMatch
    ? reqMatch[1].replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean).join(', ')
    : null;
  const phase_req_ids = (reqExtracted && reqExtracted !== 'TBD') ? reqExtracted : null;

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-phase-researcher'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Workflow flags
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    nyquist_validation_enabled: config.nyquist_validation,
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,
    phase_req_ids,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    plan_count: phaseInfo?.plans?.length || 0,

    // Environment
    planning_exists: pathExistsInternal(cwd, '.planning'),
    roadmap_exists: pathExistsInternal(cwd, paths.rel.roadmap),

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // File paths
    state_path: paths.rel.state,
    roadmap_path: paths.rel.roadmap,
    requirements_path: paths.rel.requirements,
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
    } catch {}
  }

  output(result, raw);
}

function cmdInitNewProject(cwd, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);

  // Detect Brave Search API key availability
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Detect existing code
  let hasCode = false;
  let hasPackageFile = false;
  try {
    const files = execSync('find . -maxdepth 3 \\( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.swift" -o -name "*.java" \\) 2>/dev/null | grep -v node_modules | grep -v .git | head -5', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    hasCode = files.trim().length > 0;
  } catch {}

  hasPackageFile = pathExistsInternal(cwd, 'package.json') ||
                   pathExistsInternal(cwd, 'requirements.txt') ||
                   pathExistsInternal(cwd, 'Cargo.toml') ||
                   pathExistsInternal(cwd, 'go.mod') ||
                   pathExistsInternal(cwd, 'Package.swift');

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

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // File paths
    project_path: '.planning/PROJECT.md',
  };

  output(result, raw);
}

function cmdInitNewMilestone(cwd, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const milestone = getMilestoneInfo(cwd, paths);

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

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, paths.rel.roadmap),
    state_exists: pathExistsInternal(cwd, paths.rel.state),

    // File paths
    project_path: '.planning/PROJECT.md',
    roadmap_path: paths.rel.roadmap,
    state_path: paths.rel.state,
  };

  output(result, raw);
}

function cmdInitQuick(cwd, description, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const now = new Date();
  const slug = description ? generateSlugInternal(description)?.substring(0, 40) : null;

  // Find next quick task number
  const quickDir = path.join(cwd, '.planning', 'quick');
  let nextNum = 1;
  try {
    const existing = fs.readdirSync(quickDir)
      .filter(f => /^\d+-/.test(f))
      .map(f => parseInt(f.split('-')[0], 10))
      .filter(n => !isNaN(n));
    if (existing.length > 0) {
      nextNum = Math.max(...existing) + 1;
    }
  } catch {}

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config
    commit_docs: config.commit_docs,

    // Quick task info
    next_num: nextNum,
    slug: slug,
    description: description || null,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Paths
    quick_dir: '.planning/quick',
    task_dir: slug ? `.planning/quick/${nextNum}-${slug}` : null,

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, paths.rel.roadmap),
    planning_exists: pathExistsInternal(cwd, '.planning'),

  };

  output(result, raw);
}

function cmdInitResume(cwd, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);

  // Check for interrupted agent
  let interruptedAgentId = null;
  try {
    interruptedAgentId = fs.readFileSync(path.join(cwd, '.planning', 'current-agent-id.txt'), 'utf-8').trim();
  } catch {}

  const result = {
    // File existence
    state_exists: pathExistsInternal(cwd, paths.rel.state),
    roadmap_exists: pathExistsInternal(cwd, paths.rel.roadmap),
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // File paths
    state_path: paths.rel.state,
    roadmap_path: paths.rel.roadmap,
    project_path: '.planning/PROJECT.md',

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // Agent state
    has_interrupted_agent: !!interruptedAgentId,
    interrupted_agent_id: interruptedAgentId,

    // Config
    commit_docs: config.commit_docs,
  };

  output(result, raw);
}

function cmdInitVerifyWork(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init verify-work');
  }

  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const phaseInfo = findPhaseInternal(cwd, phase, paths);

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

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // Existing artifacts
    has_verification: phaseInfo?.has_verification || false,

    // Browser verification
    browser_enabled: config.browser?.enabled || false,
    browser_base_url: config.browser?.base_url || 'http://localhost:3000',
  };

  output(result, raw);
}

function cmdInitPhaseOp(cwd, phase, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  let phaseInfo = findPhaseInternal(cwd, phase, paths);

  // Fallback to ROADMAP.md if no directory exists (e.g., Plans: TBD)
  if (!phaseInfo) {
    const roadmapPhase = getRoadmapPhaseInternal(cwd, phase, paths);
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
    // Config
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    has_verification: phaseInfo?.has_verification || false,
    plan_count: phaseInfo?.plans?.length || 0,

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, paths.rel.roadmap),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // File paths
    state_path: paths.rel.state,
    roadmap_path: paths.rel.roadmap,
    requirements_path: paths.rel.requirements,
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
    } catch {}
  }

  output(result, raw);
}

function cmdInitTodos(cwd, area, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const now = new Date();

  // List todos (reuse existing logic)
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
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

        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: '.planning/todos/pending/' + file,
        });
      } catch {}
    }
  } catch {}

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
    pending_dir: '.planning/todos/pending',
    completed_dir: '.planning/todos/completed',

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    todos_dir_exists: pathExistsInternal(cwd, '.planning/todos'),
    pending_dir_exists: pathExistsInternal(cwd, '.planning/todos/pending'),
  };

  output(result, raw);
}

function cmdInitBugs(cwd, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const now = new Date();

  const bugsDir = path.join(cwd, '.planning', 'bugs');
  const resolvedDir = path.join(cwd, '.planning', 'bugs', 'resolved');

  const bugs = [];
  let maxId = 0;

  // Scan active bugs
  try {
    const files = fs.readdirSync(bugsDir).filter(f => /^BUG-\d+\.md$/.test(f));
    for (const file of files) {
      const num = parseInt(file.match(/BUG-(\d+)\.md/)[1], 10);
      if (num > maxId) maxId = num;
      try {
        const content = fs.readFileSync(path.join(bugsDir, file), 'utf-8');
        const titleMatch = content.match(/^title:\s*"?(.+?)"?\s*$/m);
        const severityMatch = content.match(/^severity:\s*(.+)$/m);
        const statusMatch = content.match(/^status:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        bugs.push({
          id: `BUG-${String(num).padStart(3, '0')}`,
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          severity: severityMatch ? severityMatch[1].trim() : 'medium',
          status: statusMatch ? statusMatch[1].trim() : 'reported',
          area: areaMatch ? areaMatch[1].trim() : 'general',
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
        });
      } catch {}
    }
  } catch {}

  // Scan resolved bugs for ID calculation
  try {
    const files = fs.readdirSync(resolvedDir).filter(f => /^BUG-\d+\.md$/.test(f));
    for (const file of files) {
      const num = parseInt(file.match(/BUG-(\d+)\.md/)[1], 10);
      if (num > maxId) maxId = num;
    }
  } catch {}

  const nextId = maxId + 1;

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Bug inventory
    bug_count: bugs.length,
    bugs,
    next_id: nextId,
    next_id_padded: String(nextId).padStart(3, '0'),

    // Paths
    bugs_dir: '.planning/bugs',
    resolved_dir: '.planning/bugs/resolved',
    planning_base: paths.rel.base,

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,

    // File existence
    bugs_dir_exists: pathExistsInternal(cwd, '.planning/bugs'),
  };

  output(result, raw);
}

function cmdInitMilestoneOp(cwd, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const milestone = getMilestoneInfo(cwd, paths);

  // Count phases
  let phaseCount = 0;
  let completedPhases = 0;
  const phasesDir = paths.abs.phases;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    phaseCount = dirs.length;

    // Count phases with summaries (completed)
    for (const dir of dirs) {
      try {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
        const hasSummary = phaseFiles.some(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        if (hasSummary) completedPhases++;
      } catch {}
    }
  } catch {}

  // Check archive
  const archiveDir = path.join(cwd, '.planning', 'archive');
  let archivedMilestones = [];
  try {
    archivedMilestones = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {}

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Current milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // Phase counts
    phase_count: phaseCount,
    completed_phases: completedPhases,
    all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,

    // Archive
    archived_milestones: archivedMilestones,
    archive_count: archivedMilestones.length,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, paths.rel.roadmap),
    state_exists: pathExistsInternal(cwd, paths.rel.state),
    archive_exists: pathExistsInternal(cwd, '.planning/archive'),
    phases_dir_exists: pathExistsInternal(cwd, paths.rel.base + '/phases'),
  };

  output(result, raw);
}

function cmdInitMapCodebase(cwd, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);

  // Check for existing codebase maps
  const codebaseDir = path.join(cwd, '.planning', 'codebase');
  let existingMaps = [];
  try {
    existingMaps = fs.readdirSync(codebaseDir).filter(f => f.endsWith('.md'));
  } catch {}

  const result = {
    // Models
    mapper_model: resolveModelInternal(cwd, 'gsd-codebase-mapper'),

    // Config
    commit_docs: config.commit_docs,
    search_gitignored: config.search_gitignored,
    parallelization: config.parallelization,

    // Paths
    codebase_dir: '.planning/codebase',

    // Existing maps
    existing_maps: existingMaps,
    has_maps: existingMaps.length > 0,

    // Milestone
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    codebase_dir_exists: pathExistsInternal(cwd, '.planning/codebase'),
  };

  output(result, raw);
}

function cmdInitProgress(cwd, raw) {
  const paths = resolvePlanningPaths(cwd);
  const config = loadConfig(cwd, paths);
  const milestone = getMilestoneInfo(cwd, paths);

  // Analyze phases
  const phasesDir = paths.abs.phases;
  const phases = [];
  let currentPhase = null;
  let nextPhase = null;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      const match = dir.match(/^(\d+(?:\.\d+)*)-?(.*)/);
      const phaseNumber = match ? match[1] : dir;
      const phaseName = match && match[2] ? match[2] : null;

      const phasePath = path.join(phasesDir, dir);
      const phaseFiles = fs.readdirSync(phasePath);

      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

      const status = summaries.length >= plans.length && plans.length > 0 ? 'complete' :
                     plans.length > 0 ? 'in_progress' :
                     hasResearch ? 'researched' : 'pending';

      const phaseInfo = {
        number: phaseNumber,
        name: phaseName,
        directory: paths.rel.phases + '/' + dir,
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
  } catch {}

  // Check for paused work
  let pausedAt = null;
  try {
    const state = fs.readFileSync(paths.abs.state, 'utf-8');
    const pauseMatch = state.match(/\*\*Paused At:\*\*\s*(.+)/);
    if (pauseMatch) pausedAt = pauseMatch[1].trim();
  } catch {}

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),

    // Config
    commit_docs: config.commit_docs,

    // Milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone: paths.milestone,
    is_multi_milestone: paths.isMultiMilestone,
    planning_base: paths.rel.base,

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
    roadmap_exists: pathExistsInternal(cwd, paths.rel.roadmap),
    state_exists: pathExistsInternal(cwd, paths.rel.state),
    // File paths
    state_path: paths.rel.state,
    roadmap_path: paths.rel.roadmap,
    project_path: '.planning/PROJECT.md',
    config_path: paths.rel.config,
  };

  output(result, raw);
}

module.exports = {
  cmdInitExecutePhase,
  cmdInitPlanPhase,
  cmdInitNewProject,
  cmdInitNewMilestone,
  cmdInitQuick,
  cmdInitResume,
  cmdInitVerifyWork,
  cmdInitPhaseOp,
  cmdInitTodos,
  cmdInitBugs,
  cmdInitMilestoneOp,
  cmdInitMapCodebase,
  cmdInitProgress,
};
