/**
 * plan-phase.tsx - GSD Plan Phase Command (Meta-Prompting)
 *
 * Pattern: Claude reads files directly and constructs prompts based on understanding.
 * Runtime handles only mechanical operations (validation, parsing, file moves, stats).
 *
 * Flow: Init → Read Files → Triage → Research (if needed) → Plan → Verify → Done
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
  XmlBlock,
  ExecutionContext,
  Table,
} from 'react-agentic';

// Import runtime functions
import {
  init,
  parseAgentStatus,
  archiveExistingPlans,
} from './plan-phase.runtime.js';

import type {
  PlanPhaseContext as Context,
  AgentStatus,
} from './plan-phase.runtime.js';

// Register runtime functions for CLI access
const Init = runtimeFn(init);
const ParseAgentStatus = runtimeFn(parseAgentStatus);
const ArchiveExistingPlans = runtimeFn(archiveExistingPlans);

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
      // Runtime variables
      const ctx = useRuntimeVar<Context>('CTX');
      const agentStatus = useRuntimeVar<AgentStatus>('AGENT_STATUS');

      // Flow control
      const userChoice = useRuntimeVar<string>('USER_CHOICE');
      const iteration = useRuntimeVar<number>('ITERATION');
      const archiveResult = useRuntimeVar<string>('ARCHIVE_RESULT');

      return (
        <>
          <ExecutionContext paths={["~/.claude/get-shit-done/references/ui-brand.md"]} />

          <XmlBlock name="objective">
            <p>Create executable phase plans (PLAN.md files) for a roadmap phase with integrated research and verification.</p>
            <p><b>Default flow:</b> Research (if needed) → Plan → Verify → Done</p>
            <p><b>Orchestrator role:</b> Parse arguments, validate phase, read context files, construct prompts with understanding, spawn subagents, iterate until plans pass, present results.</p>
            <p><b>Why subagents:</b> Research and planning burn context fast. Verification uses fresh context. User sees the flow between agents in main context.</p>
          </XmlBlock>

          <XmlBlock name="context">
            <p>Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)</p>
            <ul>
              <li><code>--research</code> — Force re-research even if RESEARCH.md exists</li>
              <li><code>--skip-research</code> — Skip research entirely</li>
              <li><code>--gaps</code> — Gap closure mode (uses VERIFICATION.md, skips research)</li>
              <li><code>--skip-verify</code> — Skip verification loop</li>
            </ul>
          </XmlBlock>

          <XmlBlock name="process">

            {/* ============================================================ */}
            {/* STEP 1: Initialize Environment */}
            {/* ============================================================ */}

            <h2>Step 1: Validate Environment and Initialize</h2>

            <Init.Call
              args={{ arguments: "$ARGUMENTS" }}
              output={ctx}
            />

            <If condition={ctx.error}>
              <p><b>Error:</b> {ctx.error}</p>
              <p>Run <code>/gsd:new-project</code> first if .planning/ directory is missing.</p>
              <Return status="ERROR" message="Initialization failed" />
            </If>

            <p>Phase directory: {ctx.phaseDir}</p>
            <p>Model profile: {ctx.modelProfile}</p>

            <h3>Model Profile Lookup</h3>
            <Table
              headers={["Agent", "quality", "balanced", "budget"]}
              rows={[
                ["gsd-phase-researcher", "opus", "sonnet", "haiku"],
                ["gsd-planner", "opus", "opus", "sonnet"],
                ["gsd-plan-checker", "sonnet", "sonnet", "haiku"],
              ]}
            />

            {/* ============================================================ */}
            {/* STEP 2: Read Context Files */}
            {/* ============================================================ */}

            <h2>Step 2: Read Context Files</h2>

            <p>Read and store context file contents for prompt construction. The <code>@</code> syntax does not work across Task() boundaries — content must be inlined.</p>

            <pre><code className="bash">
{`# Read required files
STATE_CONTENT=$(cat .planning/STATE.md)
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)

# Read optional files (empty string if missing)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null)
CONTEXT_CONTENT=$(cat ${ctx.phaseDir}/*-CONTEXT.md 2>/dev/null)
RESEARCH_CONTENT=$(cat ${ctx.phaseDir}/*-RESEARCH.md 2>/dev/null)

# Gap closure files (only if --gaps mode)
VERIFICATION_CONTENT=$(cat ${ctx.phaseDir}/*-VERIFICATION.md 2>/dev/null)
UAT_CONTENT=$(cat ${ctx.phaseDir}/*-UAT.md 2>/dev/null)`}</code></pre>

            {/* ============================================================ */}
            {/* STEP 3: Handle Research */}
            {/* ============================================================ */}

            <h2>Step 3: Handle Research</h2>

            <If condition={ctx.flags.gaps}>
              <p>Gap closure mode — skipping research (using VERIFICATION.md instead).</p>
            </If>
            <Else>
              <If condition={ctx.flags.skipResearch}>
                <p>Research skipped (--skip-research flag).</p>
              </If>
              <Else>
                <If condition={ctx.needsResearch}>
                  <pre>{`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING PHASE ${ctx.phaseId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`}</pre>

                  <p>Gather context for research prompt:</p>

                  <pre><code className="bash">
{`# Get phase description from roadmap
PHASE_DESC=$(grep -A3 "Phase ${ctx.phaseId}:" .planning/ROADMAP.md)

# Get requirements if they exist
REQUIREMENTS=$(cat .planning/REQUIREMENTS.md 2>/dev/null | grep -A100 "## Requirements" | head -50)

# Get prior decisions from STATE.md
DECISIONS=$(grep -A20 "### Decisions Made" .planning/STATE.md 2>/dev/null)

# Get phase context if exists
PHASE_CONTEXT=$(cat ${ctx.phaseDir}/*-CONTEXT.md 2>/dev/null)`}</code></pre>

                  <p>Fill research prompt with context and spawn:</p>

                  <pre>{`<objective>
Research how to implement Phase ${ctx.phaseId}: ${ctx.phaseName}

Answer: "What do I need to know to PLAN this phase well?"
</objective>

<context>
**Phase description:**
{phase_description}

**Requirements (if any):**
{requirements_content}

**Prior decisions:**
{decisions_content}

**Phase context (if any):**
{context_content}
</context>

<output>
Write research findings to: ${ctx.phaseDir}/${ctx.phaseId}-RESEARCH.md
</output>`}</pre>

                  <p>◆ Spawning researcher...</p>

                  <pre>{`Task(
  prompt="First, read ${ctx.agentPaths.researcher} for your role and instructions.\\n\\n" + research_prompt,
  subagent_type="gsd-phase-researcher",
  model="${ctx.models.researcher}",
  description="Research Phase ${ctx.phaseId}"
)`}</pre>

                  <ParseAgentStatus.Call
                    args={{ output: "$AGENT_OUTPUT" }}
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
            {/* STEP 4: Check Existing Plans */}
            {/* ============================================================ */}

            <h2>Step 4: Check Existing Plans</h2>

            <pre><code className="bash">
              {`ls ${ctx.phaseDir}/*-PLAN.md 2>/dev/null`}
            </code></pre>

            <If condition={ctx.hasPlans}>
              <p>Found existing plan(s) in {ctx.phaseDir}/</p>

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
                <pre><code className="bash">
{`cat ${ctx.phaseDir}/*-PLAN.md`}
                </code></pre>

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
                  output={archiveResult}
                />
                <p>{archiveResult}</p>
              </If>
            </If>

            {/* ============================================================ */}
            {/* STEP 5: Spawn gsd-planner Agent */}
            {/* ============================================================ */}

            <h2>Step 5: Spawn gsd-planner Agent</h2>

            <pre>{`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE ${ctx.phaseId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`}</pre>

            <p>Fill prompt with inlined content and spawn:</p>

            <pre>{`<planning_context>

**Phase:** ${ctx.phaseId}
**Mode:** {mode}

**Project State:**
{state_content}

**Roadmap:**
{roadmap_content}

**Requirements (if exists):**
{requirements_content}

**Phase Context (if exists):**
{context_content}

**Research (if exists):**
{research_content}

**Gap Closure (if --gaps mode):**
{verification_content}
{uat_content}

</planning_context>

<downstream_consumer>
Output consumed by /gsd:execute-phase
Plans must be executable prompts with:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:
- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>`}</pre>

            <p>◆ Spawning planner...</p>

            <pre>{`Task(
  prompt="First, read ${ctx.agentPaths.planner} for your role and instructions.\\n\\n" + filled_prompt,
  subagent_type="gsd-planner",
  model="${ctx.models.planner}",
  description="Plan Phase ${ctx.phaseId}"
)`}</pre>

            <ParseAgentStatus.Call
              args={{ output: "$AGENT_OUTPUT" }}
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
            {/* STEP 6: Verification Loop */}
            {/* ============================================================ */}

            <h2>Step 6: Verification Loop</h2>

            <If condition={ctx.flags.skipVerify}>
              <p>Verification skipped (--skip-verify flag).</p>
            </If>
            <Else>
              <If condition={!ctx.config.workflowPlanCheck}>
                <p>Verification disabled in config (workflow.plan_check: false).</p>
              </If>
              <Else>
                <pre>{`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`}</pre>

                <p>Read plans and requirements for the checker:</p>
                <pre><code className="bash">
{`PLANS_CONTENT=$(cat ${ctx.phaseDir}/*-PLAN.md 2>/dev/null)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null)`}
                </code></pre>

                <Loop max={4} counter={iteration}>
                  <p>◆ Iteration {iteration}/3: Spawning plan checker...</p>

                  <p>Fill checker prompt with inlined content:</p>
                  <pre>{`<verification_context>

**Phase:** ${ctx.phaseId}
**Phase Goal:** {phase_goal}

**Plans to verify:**
{plans_content}

**Requirements (if exists):**
{requirements_content}

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>`}</pre>

                  <pre>{`Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  model="${ctx.models.checker}",
  description="Verify Phase ${ctx.phaseId} plans"
)`}</pre>

                  <ParseAgentStatus.Call
                    args={{ output: "$AGENT_OUTPUT" }}
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

                      <p>Fill revision prompt:</p>
                      <pre>{`<revision_context>

**Phase:** ${ctx.phaseId}
**Mode:** revision

**Existing plans:**
{plans_content}

**Checker issues:**
{checker_issues}

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>`}</pre>

                      <pre>{`Task(
  prompt="First, read ${ctx.agentPaths.planner} for your role and instructions.\\n\\n" + revision_prompt,
  subagent_type="gsd-planner",
  model="${ctx.models.planner}",
  description="Revise Phase ${ctx.phaseId} plans"
)`}</pre>

                      <p>After planner returns, re-read plans:</p>
                      <pre><code className="bash">
{`PLANS_CONTENT=$(cat ${ctx.phaseDir}/*-PLAN.md 2>/dev/null)`}
                      </code></pre>
                      <p>Plans revised. Re-checking...</p>
                    </Else>
                  </If>
                </Loop>
              </Else>
            </Else>

            {/* ============================================================ */}
            {/* STEP 7: Present Final Status */}
            {/* ============================================================ */}

            <h2>Step 7: Present Final Status</h2>

            <p>Gather plan statistics from phase directory:</p>
            <pre><code className="bash">
{`# Count plans and extract wave info
PLAN_COUNT=$(ls ${ctx.phaseDir}/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
WAVE_COUNT=$(grep -h "^wave:" ${ctx.phaseDir}/*-PLAN.md 2>/dev/null | sort -u | wc -l | tr -d ' ')
PLAN_NAMES=$(ls ${ctx.phaseDir}/*-PLAN.md 2>/dev/null | xargs -I{} basename {} -PLAN.md | tr '\\n' ', ')`}
            </code></pre>

            <p>Route to offer_next with filled values.</p>

          </XmlBlock>

          <XmlBlock name="offer_next">
            <p>Output this summary directly (not as a code block), filling in values based on what happened:</p>

            <pre>{`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE ${ctx.phaseId} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase ${ctx.phaseId}: ${ctx.phaseName}** — {plan_count} plan(s) in {wave_count} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives from plans] |
| 2    | 03     | [objective from plan]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase ${ctx.phaseId}** — run all {plan_count} plans

/gsd:execute-phase ${ctx.phaseId}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat ${ctx.phaseDir}/*-PLAN.md — review plans
- /gsd:plan-phase ${ctx.phaseId} --research — re-research first

───────────────────────────────────────────────────────────────`}</pre>

            <p>Fill the placeholders:</p>
            <ul>
              <li><code>{`{plan_count}`}</code> — number of PLAN.md files created</li>
              <li><code>{`{wave_count}`}</code> — number of unique waves across plans</li>
              <li><code>Wave table</code> — actual plans grouped by wave with their objectives</li>
              <li><code>Research</code> — based on what happened: Completed (spawned researcher), Used existing (had RESEARCH.md), Skipped (--skip-research or --gaps)</li>
              <li><code>Verification</code> — based on what happened: Passed (checker approved), Passed with override (user forced), Skipped (--skip-verify or config disabled)</li>
            </ul>
          </XmlBlock>

          <XmlBlock name="success_criteria">
            <ul>
              <li>[] .planning/ directory validated</li>
              <li>[] Phase validated against roadmap</li>
              <li>[] Phase directory created if needed</li>
              <li>[] Research completed (unless --skip-research or --gaps or exists)</li>
              <li>[] gsd-phase-researcher spawned if research needed</li>
              <li>[] Existing plans checked</li>
              <li>[] gsd-planner spawned with context (including RESEARCH.md if available)</li>
              <li>[] Plans created (PLANNING COMPLETE or CHECKPOINT handled)</li>
              <li>[] gsd-plan-checker spawned (unless --skip-verify)</li>
              <li>[] Verification passed OR user override OR max iterations with user decision</li>
              <li>[] User sees status between agent spawns</li>
              <li>[] User knows next steps (execute or review)</li>
            </ul>
          </XmlBlock>
        </>
      );
    }}
  </Command>
);
