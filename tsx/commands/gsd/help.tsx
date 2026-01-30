/**
 * help.tsx - GSD Command Reference
 *
 * Displays the complete GSD command reference documentation.
 */

import { Command, XmlBlock } from 'react-agentic';

// ============================================================================
// Objective
// ============================================================================

const Objective = () => (
  <XmlBlock name="objective">
    <p>Display the complete GSD command reference.</p>
    <p>Output ONLY the reference content below. Do NOT add:</p>
    <ul>
      <li>Project-specific analysis</li>
      <li>Git status or file context</li>
      <li>Next-step suggestions</li>
      <li>Any commentary beyond the reference</li>
    </ul>
  </XmlBlock>
);

// ============================================================================
// Quick Start
// ============================================================================

const QuickStart = () => (
  <>
    <h2>Quick Start</h2>
    <ol>
      <li><code>/gsd:new-project</code> - Initialize project (includes research, requirements, roadmap)</li>
      <li><code>/gsd:plan-phase 1</code> - Create detailed plan for first phase</li>
      <li><code>/gsd:execute-phase 1</code> - Execute the phase</li>
    </ol>
  </>
);

// ============================================================================
// Staying Updated
// ============================================================================

const StayingUpdated = () => (
  <>
    <h2>Staying Updated</h2>
    <p>GSD evolves fast. Update periodically:</p>
    <pre><code className="language-bash">npx get-shit-done-cc@latest</code></pre>
  </>
);

// ============================================================================
// Core Workflow
// ============================================================================

const CoreWorkflowIntro = () => (
  <>
    <h2>Core Workflow</h2>
    <pre><code>/gsd:new-project → /gsd:plan-phase → /gsd:execute-phase → repeat</code></pre>
  </>
);

const ProjectInitialization = () => (
  <>
    <h3>Project Initialization</h3>

    <p><b><code>/gsd:new-project</code></b><br />Initialize new project through unified flow.</p>

    <p>One command takes you from idea to ready-for-planning:</p>
    <ul>
      <li>Deep questioning to understand what you're building</li>
      <li>Optional domain research (spawns 4 parallel researcher agents)</li>
      <li>Requirements definition with v1/v2/out-of-scope scoping</li>
      <li>Roadmap creation with phase breakdown and success criteria</li>
    </ul>

    <p>Creates all <code>.planning/</code> artifacts:</p>
    <ul>
      <li><code>PROJECT.md</code> — vision and requirements</li>
      <li><code>config.json</code> — workflow mode (interactive/yolo)</li>
      <li><code>research/</code> — domain research (if selected)</li>
      <li><code>REQUIREMENTS.md</code> — scoped requirements with REQ-IDs</li>
      <li><code>ROADMAP.md</code> — phases mapped to requirements</li>
      <li><code>STATE.md</code> — project memory</li>
    </ul>

    <p>Usage: <code>/gsd:new-project</code></p>

    <p><b><code>/gsd:map-codebase</code></b><br />Map an existing codebase for brownfield projects.</p>

    <ul>
      <li>Analyzes codebase with parallel Explore agents</li>
      <li>Creates <code>.planning/codebase/</code> with 7 focused documents</li>
      <li>Covers stack, architecture, structure, conventions, testing, integrations, concerns</li>
      <li>Use before <code>/gsd:new-project</code> on existing codebases</li>
    </ul>

    <p>Usage: <code>/gsd:map-codebase</code></p>
  </>
);

const PhasePlanning = () => (
  <>
    <h3>Phase Planning</h3>

    <p><b><code>/gsd:discuss-phase {'<'}number{'>'}</code></b><br />Help articulate your vision for a phase before planning.</p>

    <ul>
      <li>Captures how you imagine this phase working</li>
      <li>Creates CONTEXT.md with your vision, essentials, and boundaries</li>
      <li>Use when you have ideas about how something should look/feel</li>
    </ul>

    <p>Usage: <code>/gsd:discuss-phase 2</code></p>

    <p><b><code>/gsd:research-phase {'<'}number{'>'}</code></b><br />Comprehensive ecosystem research for niche/complex domains.</p>

    <ul>
      <li>Discovers standard stack, architecture patterns, pitfalls</li>
      <li>Creates RESEARCH.md with "how experts build this" knowledge</li>
      <li>Use for 3D, games, audio, shaders, ML, and other specialized domains</li>
      <li>Goes beyond "which library" to ecosystem knowledge</li>
    </ul>

    <p>Usage: <code>/gsd:research-phase 3</code></p>

    <p><b><code>/gsd:list-phase-assumptions {'<'}number{'>'}</code></b><br />See what Claude is planning to do before it starts.</p>

    <ul>
      <li>Shows Claude's intended approach for a phase</li>
      <li>Lets you course-correct if Claude misunderstood your vision</li>
      <li>No files created - conversational output only</li>
    </ul>

    <p>Usage: <code>/gsd:list-phase-assumptions 3</code></p>

    <p><b><code>/gsd:plan-phase {'<'}number{'>'}</code></b><br />Create detailed execution plan for a specific phase.</p>

    <ul>
      <li>Generates <code>.planning/phases/XX-phase-name/XX-YY-PLAN.md</code></li>
      <li>Breaks phase into concrete, actionable tasks</li>
      <li>Includes verification criteria and success measures</li>
      <li>Multiple plans per phase supported (XX-01, XX-02, etc.)</li>
    </ul>

    <p>Usage: <code>/gsd:plan-phase 1</code><br />Result: Creates <code>.planning/phases/01-foundation/01-01-PLAN.md</code></p>
  </>
);

const Execution = () => (
  <>
    <h3>Execution</h3>

    <p><b><code>/gsd:execute-phase {'<'}phase-number{'>'}</code></b><br />Execute all plans in a phase.</p>

    <ul>
      <li>Groups plans by wave (from frontmatter), executes waves sequentially</li>
      <li>Plans within each wave run in parallel via Task tool</li>
      <li>Verifies phase goal after all plans complete</li>
      <li>Updates REQUIREMENTS.md, ROADMAP.md, STATE.md</li>
    </ul>

    <p>Usage: <code>/gsd:execute-phase 5</code></p>
  </>
);

const QuickMode = () => (
  <>
    <h3>Quick Mode</h3>

    <p><b><code>/gsd:quick</code></b><br />Execute small, ad-hoc tasks with GSD guarantees but skip optional agents.</p>

    <p>Quick mode uses the same system with a shorter path:</p>
    <ul>
      <li>Spawns planner + executor (skips researcher, checker, verifier)</li>
      <li>Quick tasks live in <code>.planning/quick/</code> separate from planned phases</li>
      <li>Updates STATE.md tracking (not ROADMAP.md)</li>
    </ul>

    <p>Use when you know exactly what to do and the task is small enough to not need research or verification.</p>

    <p>Usage: <code>/gsd:quick</code><br />Result: Creates <code>.planning/quick/NNN-slug/PLAN.md</code>, <code>.planning/quick/NNN-slug/SUMMARY.md</code></p>
  </>
);

const RoadmapManagement = () => (
  <>
    <h3>Roadmap Management</h3>

    <p><b><code>/gsd:add-phase {'<'}description{'>'}</code></b><br />Add new phase to end of current milestone.</p>

    <ul>
      <li>Appends to ROADMAP.md</li>
      <li>Uses next sequential number</li>
      <li>Updates phase directory structure</li>
    </ul>

    <p>Usage: <code>/gsd:add-phase "Add admin dashboard"</code></p>

    <p><b><code>/gsd:insert-phase {'<'}after{'>'}{' '}{'<'}description{'>'}</code></b><br />Insert urgent work as decimal phase between existing phases.</p>

    <ul>
      <li>Creates intermediate phase (e.g., 7.1 between 7 and 8)</li>
      <li>Useful for discovered work that must happen mid-milestone</li>
      <li>Maintains phase ordering</li>
    </ul>

    <p>Usage: <code>/gsd:insert-phase 7 "Fix critical auth bug"</code><br />Result: Creates Phase 7.1</p>

    <p><b><code>/gsd:remove-phase {'<'}number{'>'}</code></b><br />Remove a future phase and renumber subsequent phases.</p>

    <ul>
      <li>Deletes phase directory and all references</li>
      <li>Renumbers all subsequent phases to close the gap</li>
      <li>Only works on future (unstarted) phases</li>
      <li>Git commit preserves historical record</li>
    </ul>

    <p>Usage: <code>/gsd:remove-phase 17</code><br />Result: Phase 17 deleted, phases 18-20 become 17-19</p>
  </>
);

const MilestoneManagement = () => (
  <>
    <h3>Milestone Management</h3>

    <p><b><code>/gsd:new-milestone {'<'}name{'>'}</code></b><br />Start a new milestone through unified flow.</p>

    <ul>
      <li>Deep questioning to understand what you're building next</li>
      <li>Optional domain research (spawns 4 parallel researcher agents)</li>
      <li>Requirements definition with scoping</li>
      <li>Roadmap creation with phase breakdown</li>
    </ul>

    <p>Mirrors <code>/gsd:new-project</code> flow for brownfield projects (existing PROJECT.md).</p>

    <p>Usage: <code>/gsd:new-milestone "v2.0 Features"</code></p>

    <p><b><code>/gsd:complete-milestone {'<'}version{'>'}</code></b><br />Archive completed milestone and prepare for next version.</p>

    <ul>
      <li>Creates MILESTONES.md entry with stats</li>
      <li>Archives full details to milestones/ directory</li>
      <li>Creates git tag for the release</li>
      <li>Prepares workspace for next version</li>
    </ul>

    <p>Usage: <code>/gsd:complete-milestone 1.0.0</code></p>
  </>
);

const ProgressTracking = () => (
  <>
    <h3>Progress Tracking</h3>

    <p><b><code>/gsd:progress</code></b><br />Check project status and intelligently route to next action.</p>

    <ul>
      <li>Shows visual progress bar and completion percentage</li>
      <li>Summarizes recent work from SUMMARY files</li>
      <li>Displays current position and what's next</li>
      <li>Lists key decisions and open issues</li>
      <li>Offers to execute next plan or create it if missing</li>
      <li>Detects 100% milestone completion</li>
    </ul>

    <p>Usage: <code>/gsd:progress</code></p>
  </>
);

const SessionManagement = () => (
  <>
    <h3>Session Management</h3>

    <p><b><code>/gsd:resume-work</code></b><br />Resume work from previous session with full context restoration.</p>

    <ul>
      <li>Reads STATE.md for project context</li>
      <li>Shows current position and recent progress</li>
      <li>Offers next actions based on project state</li>
    </ul>

    <p>Usage: <code>/gsd:resume-work</code></p>

    <p><b><code>/gsd:pause-work</code></b><br />Create context handoff when pausing work mid-phase.</p>

    <ul>
      <li>Creates .continue-here file with current state</li>
      <li>Updates STATE.md session continuity section</li>
      <li>Captures in-progress work context</li>
    </ul>

    <p>Usage: <code>/gsd:pause-work</code></p>
  </>
);

const Debugging = () => (
  <>
    <h3>Debugging</h3>

    <p><b><code>/gsd:debug [issue description]</code></b><br />Systematic debugging with persistent state across context resets.</p>

    <ul>
      <li>Gathers symptoms through adaptive questioning</li>
      <li>Creates <code>.planning/debug/[slug].md</code> to track investigation</li>
      <li>Investigates using scientific method (evidence → hypothesis → test)</li>
      <li>Survives <code>/clear</code> — run <code>/gsd:debug</code> with no args to resume</li>
      <li>Archives resolved issues to <code>.planning/debug/resolved/</code></li>
    </ul>

    <p>Usage: <code>/gsd:debug "login button doesn't work"</code><br />Usage: <code>/gsd:debug</code> (resume active session)</p>
  </>
);

const TodoManagement = () => (
  <>
    <h3>Todo Management</h3>

    <p><b><code>/gsd:add-todo [description]</code></b><br />Capture idea or task as todo from current conversation.</p>

    <ul>
      <li>Extracts context from conversation (or uses provided description)</li>
      <li>Creates structured todo file in <code>.planning/todos/pending/</code></li>
      <li>Infers area from file paths for grouping</li>
      <li>Checks for duplicates before creating</li>
      <li>Updates STATE.md todo count</li>
    </ul>

    <p>Usage: <code>/gsd:add-todo</code> (infers from conversation)<br />Usage: <code>/gsd:add-todo Add auth token refresh</code></p>

    <p><b><code>/gsd:check-todos [area]</code></b><br />List pending todos and select one to work on.</p>

    <ul>
      <li>Lists all pending todos with title, area, age</li>
      <li>Optional area filter (e.g., <code>/gsd:check-todos api</code>)</li>
      <li>Loads full context for selected todo</li>
      <li>Routes to appropriate action (work now, add to phase, brainstorm)</li>
      <li>Moves todo to done/ when work begins</li>
    </ul>

    <p>Usage: <code>/gsd:check-todos</code><br />Usage: <code>/gsd:check-todos api</code></p>
  </>
);

const UserAcceptanceTesting = () => (
  <>
    <h3>User Acceptance Testing</h3>

    <p><b><code>/gsd:verify-work [phase]</code></b><br />Validate built features through conversational UAT.</p>

    <ul>
      <li>Extracts testable deliverables from SUMMARY.md files</li>
      <li>Presents tests one at a time (yes/no responses)</li>
      <li>Automatically diagnoses failures and creates fix plans</li>
      <li>Ready for re-execution if issues found</li>
    </ul>

    <p>Usage: <code>/gsd:verify-work 3</code></p>
  </>
);

const MilestoneAuditing = () => (
  <>
    <h3>Milestone Auditing</h3>

    <p><b><code>/gsd:audit-milestone [version]</code></b><br />Audit milestone completion against original intent.</p>

    <ul>
      <li>Reads all phase VERIFICATION.md files</li>
      <li>Checks requirements coverage</li>
      <li>Spawns integration checker for cross-phase wiring</li>
      <li>Creates MILESTONE-AUDIT.md with gaps and tech debt</li>
    </ul>

    <p>Usage: <code>/gsd:audit-milestone</code></p>

    <p><b><code>/gsd:plan-milestone-gaps</code></b><br />Create phases to close gaps identified by audit.</p>

    <ul>
      <li>Reads MILESTONE-AUDIT.md and groups gaps into phases</li>
      <li>Prioritizes by requirement priority (must/should/nice)</li>
      <li>Adds gap closure phases to ROADMAP.md</li>
      <li>Ready for <code>/gsd:plan-phase</code> on new phases</li>
    </ul>

    <p>Usage: <code>/gsd:plan-milestone-gaps</code></p>
  </>
);

const Configuration = () => (
  <>
    <h3>Configuration</h3>

    <p><b><code>/gsd:settings</code></b><br />Configure workflow toggles and model profile interactively.</p>

    <ul>
      <li>Toggle researcher, plan checker, verifier agents</li>
      <li>Select model profile (quality/balanced/budget)</li>
      <li>Updates <code>.planning/config.json</code></li>
    </ul>

    <p>Usage: <code>/gsd:settings</code></p>

    <p><b><code>/gsd:set-profile {'<'}profile{'>'}</code></b><br />Quick switch model profile for GSD agents.</p>

    <ul>
      <li><code>quality</code> — Opus everywhere except verification</li>
      <li><code>balanced</code> — Opus for planning, Sonnet for execution (default)</li>
      <li><code>budget</code> — Sonnet for writing, Haiku for research/verification</li>
    </ul>

    <p>Usage: <code>/gsd:set-profile budget</code></p>
  </>
);

const UtilityCommands = () => (
  <>
    <h3>Utility Commands</h3>

    <p><b><code>/gsd:help</code></b><br />Show this command reference.</p>

    <p><b><code>/gsd:update</code></b><br />Update GSD to latest version with changelog preview.</p>

    <ul>
      <li>Shows installed vs latest version comparison</li>
      <li>Displays changelog entries for versions you've missed</li>
      <li>Highlights breaking changes</li>
      <li>Confirms before running install</li>
      <li>Better than raw <code>npx get-shit-done-cc</code></li>
    </ul>

    <p>Usage: <code>/gsd:update</code></p>

    <p><b><code>/gsd:join-discord</code></b><br />Join the GSD Discord community.</p>

    <ul>
      <li>Get help, share what you're building, stay updated</li>
      <li>Connect with other GSD users</li>
    </ul>

    <p>Usage: <code>/gsd:join-discord</code></p>
  </>
);

const CoreWorkflow = () => (
  <>
    <CoreWorkflowIntro />
    <ProjectInitialization />
    <PhasePlanning />
    <Execution />
    <QuickMode />
    <RoadmapManagement />
    <MilestoneManagement />
    <ProgressTracking />
    <SessionManagement />
    <Debugging />
    <TodoManagement />
    <UserAcceptanceTesting />
    <MilestoneAuditing />
    <Configuration />
    <UtilityCommands />
  </>
);

// ============================================================================
// Files & Structure
// ============================================================================

const FilesAndStructure = () => (
  <>
    <h2>Files {'&'} Structure</h2>

    <pre><code>{`.planning/
├── PROJECT.md            # Project vision
├── ROADMAP.md            # Current phase breakdown
├── STATE.md              # Project memory & context
├── config.json           # Workflow mode & gates
├── todos/                # Captured ideas and tasks
│   ├── pending/          # Todos waiting to be worked on
│   └── done/             # Completed todos
├── debug/                # Active debug sessions
│   └── resolved/         # Archived resolved issues
├── codebase/             # Codebase map (brownfield projects)
│   ├── STACK.md          # Languages, frameworks, dependencies
│   ├── ARCHITECTURE.md   # Patterns, layers, data flow
│   ├── STRUCTURE.md      # Directory layout, key files
│   ├── CONVENTIONS.md    # Coding standards, naming
│   ├── TESTING.md        # Test setup, patterns
│   ├── INTEGRATIONS.md   # External services, APIs
│   └── CONCERNS.md       # Tech debt, known issues
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md`}</code></pre>
  </>
);

// ============================================================================
// Workflow Modes
// ============================================================================

const WorkflowModes = () => (
  <>
    <h2>Workflow Modes</h2>

    <p>Set during <code>/gsd:new-project</code>:</p>

    <p><b>Interactive Mode</b></p>
    <ul>
      <li>Confirms each major decision</li>
      <li>Pauses at checkpoints for approval</li>
      <li>More guidance throughout</li>
    </ul>

    <p><b>YOLO Mode</b></p>
    <ul>
      <li>Auto-approves most decisions</li>
      <li>Executes plans without confirmation</li>
      <li>Only stops for critical checkpoints</li>
    </ul>

    <p>Change anytime by editing <code>.planning/config.json</code></p>
  </>
);

// ============================================================================
// Planning Configuration
// ============================================================================

const PlanningConfiguration = () => (
  <>
    <h2>Planning Configuration</h2>

    <p>Configure how planning artifacts are managed in <code>.planning/config.json</code>:</p>

    <p><b><code>planning.commit_docs</code></b> (default: <code>true</code>)</p>
    <ul>
      <li><code>true</code>: Planning artifacts committed to git (standard workflow)</li>
      <li><code>false</code>: Planning artifacts kept local-only, not committed</li>
    </ul>

    <p>When <code>commit_docs: false</code>:</p>
    <ul>
      <li>Add <code>.planning/</code> to your <code>.gitignore</code></li>
      <li>Useful for OSS contributions, client projects, or keeping planning private</li>
      <li>All planning files still work normally, just not tracked in git</li>
    </ul>

    <p><b><code>planning.search_gitignored</code></b> (default: <code>false</code>)</p>
    <ul>
      <li><code>true</code>: Add <code>--no-ignore</code> to broad ripgrep searches</li>
      <li>Only needed when <code>.planning/</code> is gitignored and you want project-wide searches to include it</li>
    </ul>

    <p>Example config:</p>
    <pre><code className="language-json">{`{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}`}</code></pre>
  </>
);

// ============================================================================
// Common Workflows
// ============================================================================

const CommonWorkflows = () => (
  <>
    <h2>Common Workflows</h2>

    <p><b>Starting a new project:</b></p>

    <pre><code>{`/gsd:new-project        # Unified flow: questioning → research → requirements → roadmap
/clear
/gsd:plan-phase 1       # Create plans for first phase
/clear
/gsd:execute-phase 1    # Execute all plans in phase`}</code></pre>

    <p><b>Resuming work after a break:</b></p>

    <pre><code>/gsd:progress  # See where you left off and continue</code></pre>

    <p><b>Adding urgent mid-milestone work:</b></p>

    <pre><code>{`/gsd:insert-phase 5 "Critical security fix"
/gsd:plan-phase 5.1
/gsd:execute-phase 5.1`}</code></pre>

    <p><b>Completing a milestone:</b></p>

    <pre><code>{`/gsd:complete-milestone 1.0.0
/clear
/gsd:new-milestone  # Start next milestone (questioning → research → requirements → roadmap)`}</code></pre>

    <p><b>Capturing ideas during work:</b></p>

    <pre><code>{`/gsd:add-todo                    # Capture from conversation context
/gsd:add-todo Fix modal z-index  # Capture with explicit description
/gsd:check-todos                 # Review and work on todos
/gsd:check-todos api             # Filter by area`}</code></pre>

    <p><b>Debugging an issue:</b></p>

    <pre><code>{`/gsd:debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/clear
/gsd:debug                                    # Resume from where you left off`}</code></pre>
  </>
);

// ============================================================================
// Getting Help
// ============================================================================

const GettingHelp = () => (
  <>
    <h2>Getting Help</h2>

    <ul>
      <li>Read <code>.planning/PROJECT.md</code> for project vision</li>
      <li>Read <code>.planning/STATE.md</code> for current context</li>
      <li>Check <code>.planning/ROADMAP.md</code> for phase status</li>
      <li>Run <code>/gsd:progress</code> to check where you're up to</li>
    </ul>
  </>
);

// ============================================================================
// Reference (combines all sections)
// ============================================================================

const Reference = () => (
  <XmlBlock name="reference">
    <h1>GSD Command Reference</h1>

    <p><b>GSD</b> (Get Shit Done) creates hierarchical project plans optimized for solo agentic development with Claude Code.</p>

    <QuickStart />
    <StayingUpdated />
    <CoreWorkflow />
    <FilesAndStructure />
    <WorkflowModes />
    <PlanningConfiguration />
    <CommonWorkflows />
    <GettingHelp />
  </XmlBlock>
);

// ============================================================================
// Command Export
// ============================================================================

export default (
  <Command
    name="gsd:help"
    description="Show available GSD commands and usage guide"
  >
    {() => (
      <>
        <Objective />
        <Reference />
      </>
    )}
  </Command>
);
