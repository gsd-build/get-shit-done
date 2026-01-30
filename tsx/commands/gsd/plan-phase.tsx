/**
 * plan-phase.tsx - GSD Plan Phase Command
 *
 * Creates detailed execution plan for a phase (PLAN.md) with verification loop.
 * Uses react-agentic patterns with TypeScript runtime functions.
 *
 * Flow: Research (if needed) → Plan → Verify → Done
 */

import {
  Command,
  useRuntimeVar,
  runtimeFn,
  If,
  Else,
  Loop,
  Break,
  Return,
  AskUser,
  SpawnAgent,
  XmlBlock,
  ExecutionContext,
  Table,
} from 'react-agentic';

// Import runtime functions
import {
  init,
  checkExistingPlans,
  buildResearcherPrompt,
  buildPlannerPrompt,
  buildCheckerPrompt,
  parseAgentStatus,
  generateSummary,
  formatSummaryMarkdown,
  archiveExistingPlans,
  readAndDisplayPlans,
} from './plan-phase.runtime.js';

// Import types
import type {
  PlanPhaseContext,
  PlanSummary,
  PromptResult,
  AgentStatus,
  ExistingPlansResult,
} from './plan-phase.runtime.js';
import BannerUi from '../../components/ui/banner-ui';
import SpawningAgentUi from '../../components/ui/spawning-agent-ui.js';

// ============================================================================
// Create typed runtime function components
// ============================================================================

const Init = runtimeFn(init);
const CheckExistingPlans = runtimeFn(checkExistingPlans);
const BuildResearcherPrompt = runtimeFn(buildResearcherPrompt);
const BuildPlannerPrompt = runtimeFn(buildPlannerPrompt);
const BuildCheckerPrompt = runtimeFn(buildCheckerPrompt);
const ParseAgentStatus = runtimeFn(parseAgentStatus);
const GenerateSummary = runtimeFn(generateSummary);
const FormatSummary = runtimeFn(formatSummaryMarkdown);
const ArchiveExistingPlans = runtimeFn(archiveExistingPlans);
const ReadAndDisplayPlans = runtimeFn(readAndDisplayPlans);

// ============================================================================
// Objective Component
// ============================================================================

const Objective = () => (
  <XmlBlock name="objective">
    <p>Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.</p>
    <p><b>Default flow:</b> Research (if needed) → Plan → Verify → Done</p>
    <p><b>Orchestrator role:</b> Parse arguments, validate phase, research domain (unless skipped or exists), spawn gsd-planner agent, verify plans with gsd-plan-checker, iterate until plans pass or max iterations reached, present results.</p>
    <p><b>Why subagents:</b> Research and planning burn context fast. Verification uses fresh context. User sees the flow between agents in main context.</p>
  </XmlBlock>
);

// ============================================================================
// Context Component
// ============================================================================

const Context = () => (
  <XmlBlock name="context">
    <p>Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)</p>
    <div>
      <b>Flags:</b>
      <ul>
        <li><code>--research</code> — Force re-research even if RESEARCH.md exists</li>
        <li><code>--skip-research</code> — Skip research entirely, go straight to planning</li>
        <li><code>--gaps</code> — Gap closure mode (reads VERIFICATION.md, skips research)</li>
        <li><code>--skip-verify</code> — Skip planner → checker verification loop</li>
      </ul>
    </div>
    <p>Normalize phase input in step 2 before any directory lookups.</p>
  </XmlBlock>
);

// ============================================================================
// Model Profile Table
// ============================================================================

const ModelProfileTable = () => (
  <>
    <h3>Model Profile Lookup</h3>
    <Table
      headers={["Agent", "quality", "balanced", "budget"]}
      rows={[
        ["gsd-phase-researcher", "opus", "sonnet", "haiku"],
        ["gsd-planner", "opus", "opus", "sonnet"],
        ["gsd-plan-checker", "sonnet", "sonnet", "haiku"],
      ]}
    />
    <p>Store resolved models for use in Task calls below.</p>
  </>
);

// ============================================================================
// Success Criteria Component
// ============================================================================

const SuccessCriteria = () => (
  <XmlBlock name="success_criteria">
    <ul>
      <li>[] Init runtime: environment validated, arguments parsed, phase resolved, directory created</li>
      <li>[] Research: gsd-phase-researcher spawned if needed (unless --skip-research, --gaps, or exists)</li>
      <li>[] Existing plans: user consulted if plans exist (continue/view/replan)</li>
      <li>[] Planner: gsd-planner spawned with runtime-built prompt (handles COMPLETE/CHECKPOINT/INCONCLUSIVE)</li>
      <li>[] Verification: gsd-plan-checker in loop (unless --skip-verify or config disabled)</li>
      <li>[] Revision: planner re-spawned with issues if checker finds problems (max 3 iterations)</li>
      <li>[] Summary: runtime generates formatted output with next steps</li>
    </ul>
  </XmlBlock>
);

// ============================================================================
// Command Export
// ============================================================================

export default (
  <Command
    name="gsd:plan-phase"
    description="Create detailed execution plan for a phase (PLAN.md) with verification loop"
    argumentHint="[phase] [--research] [--skip-research] [--gaps] [--skip-verify]"
    agent="gsd-planner"
    allowedTools={["Read", "Write", "Bash", "Glob", "Grep", "Task", "WebFetch", "mcp__context7__*"]}
  >
    {() => {
      // Variable declarations with typed RuntimeVars
      const ctx = useRuntimeVar<PlanPhaseContext>('CTX');
      const existingPlans = useRuntimeVar<ExistingPlansResult>('EXISTING_PLANS');
      const researcherPrompt = useRuntimeVar<PromptResult>('RESEARCHER_PROMPT');
      const plannerPrompt = useRuntimeVar<PromptResult>('PLANNER_PROMPT');
      const checkerPrompt = useRuntimeVar<{ prompt: string; phaseGoal: string }>('CHECKER_PROMPT');
      const agentOutput = useRuntimeVar<string>('AGENT_OUTPUT');
      const agentStatus = useRuntimeVar<AgentStatus>('AGENT_STATUS');
      const userChoice = useRuntimeVar<string>('USER_CHOICE');
      const iteration = useRuntimeVar<number>('ITERATION');
      const summary = useRuntimeVar<PlanSummary>('SUMMARY');
      const summaryMd = useRuntimeVar<string>('SUMMARY_MD');
      const plansDisplay = useRuntimeVar<string>('PLANS_DISPLAY');
      const _void = useRuntimeVar<void>('_VOID');

      return (
        <>
          <ExecutionContext paths={["~/.claude/get-shit-done/references/ui-brand.md"]} />

          <Objective />
          <Context />

          <XmlBlock name="process">

            {/* ============================================================ */}
            {/* STEP 1: Validate Environment and Initialize */}
            {/* ============================================================ */}

            <h2>Step 1: Validate Environment</h2>

            <p>Initialize context, parse arguments, validate environment:</p>

            <Init.Call
              args={{ arguments: "$ARGUMENTS" }}
              output={ctx}
            />

            <If condition={ctx.error}>
              <p><b>Error:</b> {ctx.error}</p>
              <p>Run <code>/gsd:new-project</code> first if .planning/ directory is missing.</p>
              <Return status="ERROR" message="Initialization failed" />
            </If>

            <p>Phase {ctx.phaseId}: {ctx.phaseName}</p>
            <p>Directory: {ctx.phaseDir}</p>
            <p>Model profile: {ctx.modelProfile}</p>

            <ModelProfileTable />

            {/* ============================================================ */}
            {/* STEP 2: Handle Research */}
            {/* ============================================================ */}

            <h2>Step 2: Handle Research</h2>

            <If condition={ctx.flags.gaps}>
              <p>Gap closure mode — skipping research (using VERIFICATION.md instead)</p>
            </If>
            <Else>
              <If condition={ctx.flags.skipResearch}>
                <p>Research skipped (--skip-research flag)</p>
              </If>
              <Else>
                <If condition={ctx.needsResearch}>
                  <BannerUi prefix="RESEARCHING" title={`PHASE ${ctx.phaseId}`} />

                  <p>◆ Building researcher prompt...</p>

                  <BuildResearcherPrompt.Call
                    args={{
                      phaseId: ctx.phaseId,
                      phaseName: ctx.phaseName,
                      phaseDir: ctx.phaseDir,
                      phaseDescription: ctx.phaseDescription,
                      agentPath: ctx.agentPaths.researcher,
                    }}
                    output={researcherPrompt}
                  />

                  <p>◆ Spawning researcher agent...</p>
                  <SpawningAgentUi agent="researcher" />

                  <SpawnAgent
                    agent="gsd-phase-researcher"
                    loadFromFile={ctx.agentPaths.researcher}
                    model="sonnet"
                    description={`Research Phase ${ctx.phaseId}`}
                    input={{ prompt: researcherPrompt.prompt }}
                    output={agentOutput}
                  />

                  <ParseAgentStatus.Call
                    args={{ output: agentOutput }}
                    output={agentStatus}
                  />

                  <If condition={agentStatus.status === 'BLOCKED'}>
                    <p><b>Research blocked:</b> {agentStatus.message}</p>

                    <AskUser
                      question="Research encountered a blocker. How would you like to proceed?"
                      header="Blocker"
                      options={[
                        { value: 'context', label: 'Provide more context', description: 'Add information and retry research' },
                        { value: 'skip', label: 'Skip research', description: 'Proceed to planning without research' },
                        { value: 'abort', label: 'Abort', description: 'Exit planning entirely' },
                      ]}
                      output={userChoice}
                    />

                    <If condition={userChoice === 'abort'}>
                      <Return status="BLOCKED" message="User aborted due to research blocker" />
                    </If>
                    <If condition={userChoice === 'skip'}>
                      <p>Skipping research, proceeding to planning...</p>
                    </If>
                    <If condition={userChoice === 'context'}>
                      <p>Please provide additional context, then run /gsd:plan-phase {ctx.phaseId} again.</p>
                      <Return status="CHECKPOINT" message="Waiting for user context" />
                    </If>
                  </If>
                  <Else>
                    <p>Research complete. Proceeding to planning...</p>
                  </Else>
                </If>
                <Else>
                  <p>Using existing research: {ctx.phaseDir}/{ctx.phaseId}-RESEARCH.md</p>
                </Else>
              </Else>
            </Else>

            {/* ============================================================ */}
            {/* STEP 3: Check Existing Plans */}
            {/* ============================================================ */}

            <h2>Step 3: Check Existing Plans</h2>

            <CheckExistingPlans.Call
              args={{ phaseDir: ctx.phaseDir }}
              output={existingPlans}
            />

            <If condition={existingPlans.hasPlans}>
              <p>Found {existingPlans.planCount} existing plan(s):</p>
              <pre>{existingPlans.planSummary}</pre>

              <AskUser
                question="Plans already exist for this phase. What would you like to do?"
                header="Existing Plans"
                options={[
                  { value: 'continue', label: 'Continue planning', description: 'Add more plans to existing ones' },
                  { value: 'view', label: 'View existing plans', description: 'Display current plans before deciding' },
                  { value: 'replan', label: 'Replan from scratch', description: 'Archive existing and create new plans' },
                ]}
                output={userChoice}
              />

              <If condition={userChoice === 'view'}>
                <ReadAndDisplayPlans.Call
                  args={{ phaseDir: ctx.phaseDir }}
                  output={plansDisplay}
                />
                <pre>{plansDisplay}</pre>

                <AskUser
                  question="After reviewing the plans, how would you like to proceed?"
                  header="Decision"
                  options={[
                    { value: 'continue', label: 'Continue planning', description: 'Add more plans' },
                    { value: 'replan', label: 'Replan from scratch', description: 'Archive and recreate' },
                    { value: 'done', label: 'Done', description: 'Plans look good, exit' },
                  ]}
                  output={userChoice}
                />

                <If condition={userChoice === 'done'}>
                  <p>Keeping existing plans. Run /gsd:execute-phase {ctx.phaseId} when ready.</p>
                  <Return status="SUCCESS" message="Using existing plans" />
                </If>
              </If>

              <If condition={userChoice === 'replan'}>
                <p>Archiving existing plans...</p>
                <ArchiveExistingPlans.Call
                  args={{ phaseDir: ctx.phaseDir }}
                  output={_void}
                />
                <p>Existing plans archived. Starting fresh...</p>
              </If>
            </If>

            {/* ============================================================ */}
            {/* STEP 4: Spawn gsd-planner Agent */}
            {/* ============================================================ */}

            <h2>Step 4: Spawn Planner</h2>

            <pre>{`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE ${ctx.phaseId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`}</pre>

            <p>◆ Building planner prompt...</p>

            <BuildPlannerPrompt.Call
              args={{
                phaseId: ctx.phaseId,
                phaseName: ctx.phaseName,
                phaseDir: ctx.phaseDir,
                agentPath: ctx.agentPaths.planner,
                mode: ctx.flags.gaps ? 'gap_closure' : 'standard',
              }}
              output={plannerPrompt}
            />

            <p>◆ Spawning planner agent...</p>

            <SpawnAgent
              agent="gsd-planner"
              loadFromFile={ctx.agentPaths.planner}
              model="opus"
              description={`Plan Phase ${ctx.phaseId}`}
              input={{ prompt: plannerPrompt.prompt }}
              output={agentOutput}
            />

            <ParseAgentStatus.Call
              args={{ output: agentOutput }}
              output={agentStatus}
            />

            <If condition={agentStatus.status === 'CHECKPOINT'}>
              <p><b>Checkpoint reached:</b> {agentStatus.message}</p>
              <p>Planner needs user input to continue.</p>

              <AskUser
                question="Planner reached a checkpoint. How would you like to proceed?"
                header="Checkpoint"
                options={[
                  { value: 'continue', label: 'Continue', description: 'Provide guidance and continue' },
                  { value: 'pause', label: 'Pause', description: 'Save progress and exit' },
                ]}
                output={userChoice}
              />

              <If condition={userChoice === 'pause'}>
                <Return status="CHECKPOINT" message="Planning paused at checkpoint" />
              </If>
            </If>

            <If condition={agentStatus.status === 'INCONCLUSIVE'}>
              <p><b>Planning inconclusive:</b> {agentStatus.message}</p>

              <AskUser
                question="Planning was inconclusive. How would you like to proceed?"
                header="Inconclusive"
                options={[
                  { value: 'context', label: 'Add context', description: 'Provide more details and retry' },
                  { value: 'retry', label: 'Retry', description: 'Try planning again' },
                  { value: 'manual', label: 'Manual', description: 'Create plans manually' },
                ]}
                output={userChoice}
              />

              <If condition={userChoice === 'manual'}>
                <p>Create plans manually in {ctx.phaseDir}/, then run /gsd:execute-phase {ctx.phaseId}</p>
                <Return status="CHECKPOINT" message="Manual planning requested" />
              </If>
              <If condition={userChoice === 'context'}>
                <p>Please provide additional context, then run /gsd:plan-phase {ctx.phaseId} again.</p>
                <Return status="CHECKPOINT" message="Waiting for user context" />
              </If>
            </If>

            <Else>
              <p>Planner completed. Plans created in {ctx.phaseDir}/</p>
            </Else>

            {/* ============================================================ */}
            {/* STEP 5: Verification Loop */}
            {/* ============================================================ */}

            <h2>Step 5: Verification Loop</h2>

            <If condition={ctx.flags.skipVerify}>
              <p>Verification skipped (--skip-verify flag)</p>
            </If>
            <Else>
              <If condition={!ctx.config.workflowPlanCheck}>
                <p>Verification disabled in config (workflow.plan_check: false)</p>
              </If>
              <Else>
                <pre>{`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`}</pre>

                <Loop max={4} counter={iteration}>
                  <p>◆ Iteration {iteration}/3: Spawning plan checker...</p>

                  <BuildCheckerPrompt.Call
                    args={{
                      phaseId: ctx.phaseId,
                      phaseDir: ctx.phaseDir,
                    }}
                    output={checkerPrompt}
                  />

                  <SpawnAgent
                    agent="gsd-plan-checker"
                    model="sonnet"
                    description={`Verify Phase ${ctx.phaseId} plans`}
                    input={{ prompt: checkerPrompt.prompt }}
                    output={agentOutput}
                  />

                  <ParseAgentStatus.Call
                    args={{ output: agentOutput }}
                    output={agentStatus}
                  />

                  <If condition={agentStatus.status === 'PASSED'}>
                    <p>Plans verified. Ready for execution.</p>
                    <Break message="Verification passed" />
                  </If>

                  <If condition={agentStatus.status === 'ISSUES_FOUND'}>
                    <p>Checker found issues:</p>
                    <pre>{agentStatus.issues.join('\n')}</pre>

                    <If condition={iteration >= 3}>
                      <p><b>Max iterations reached.</b> {agentStatus.issues.length} issue(s) remain.</p>

                      <AskUser
                        question="Max verification iterations reached. How would you like to proceed?"
                        header="Max Iterations"
                        options={[
                          { value: 'force', label: 'Force proceed', description: 'Execute despite issues' },
                          { value: 'guidance', label: 'Provide guidance', description: 'Add context and retry' },
                          { value: 'abandon', label: 'Abandon', description: 'Exit planning' },
                        ]}
                        output={userChoice}
                      />

                      <If condition={userChoice === 'abandon'}>
                        <Return status="ERROR" message="Verification failed after max iterations" />
                      </If>
                      <If condition={userChoice === 'force'}>
                        <p>Proceeding with issues. Consider fixing manually.</p>
                        <Break message="User forced proceed" />
                      </If>
                    </If>
                    <Else>
                      <p>Sending back to planner for revision... (iteration {iteration}/3)</p>

                      <BuildPlannerPrompt.Call
                        args={{
                          phaseId: ctx.phaseId,
                          phaseName: ctx.phaseName,
                          phaseDir: ctx.phaseDir,
                          agentPath: ctx.agentPaths.planner,
                          mode: 'revision',
                          issues: agentStatus.issues,
                        }}
                        output={plannerPrompt}
                      />

                      <SpawnAgent
                        agent="gsd-planner"
                        loadFromFile={ctx.agentPaths.planner}
                        model="opus"
                        description={`Revise Phase ${ctx.phaseId} plans`}
                        input={{ prompt: plannerPrompt.prompt }}
                        output={agentOutput}
                      />

                      <p>Plans revised. Re-checking...</p>
                    </Else>
                  </If>
                </Loop>
              </Else>
            </Else>

            {/* ============================================================ */}
            {/* STEP 6: Generate Final Summary */}
            {/* ============================================================ */}

            <h2>Step 6: Final Summary</h2>

            <GenerateSummary.Call
              args={{
                phaseId: ctx.phaseId,
                phaseName: ctx.phaseName,
                phaseDir: ctx.phaseDir,
                checkerPassed: agentStatus.status === 'PASSED',
                skipVerify: ctx.flags.skipVerify,
                hasResearch: ctx.hasResearch,
                forcedResearch: ctx.flags.research,
                skippedResearch: ctx.flags.skipResearch || ctx.flags.gaps,
              }}
              output={summary}
            />

            <FormatSummary.Call
              args={{ summary: summary }}
              output={summaryMd}
            />

          </XmlBlock>

          <XmlBlock name="offer_next">
            <p>Output this markdown directly (not as a code block):</p>
            <p>{summaryMd}</p>
          </XmlBlock>

          <SuccessCriteria />
        </>
      );
    }}
  </Command>
);
