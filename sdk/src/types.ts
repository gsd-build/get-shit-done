/**
 * Core type definitions for GSD-1 PLAN.md structures.
 *
 * These types model the YAML frontmatter + XML task bodies
 * that make up a GSD plan file.
 */

// ─── Frontmatter types ───────────────────────────────────────────────────────

export interface MustHaveArtifact {
  path: string;
  provides: string;
  min_lines?: number;
  exports?: string[];
  contains?: string;
}

export interface MustHaveKeyLink {
  from: string;
  to: string;
  via: string;
  pattern?: string;
}

export interface MustHaves {
  truths: string[];
  artifacts: MustHaveArtifact[];
  key_links: MustHaveKeyLink[];
}

export interface UserSetupEnvVar {
  name: string;
  source: string;
}

export interface UserSetupDashboardConfig {
  task: string;
  location: string;
  details: string;
}

export interface UserSetupItem {
  service: string;
  why: string;
  env_vars?: UserSetupEnvVar[];
  dashboard_config?: UserSetupDashboardConfig[];
  local_dev?: string[];
}

export interface PlanFrontmatter {
  phase: string;
  plan: string;
  type: string;
  wave: number;
  depends_on: string[];
  files_modified: string[];
  autonomous: boolean;
  requirements: string[];
  user_setup?: UserSetupItem[];
  must_haves: MustHaves;
  [key: string]: unknown; // Allow additional fields
}

// ─── Task types ──────────────────────────────────────────────────────────────

export interface PlanTask {
  type: string;
  name: string;
  files: string[];
  read_first: string[];
  action: string;
  verify: string;
  acceptance_criteria: string[];
  done: string;
}

// ─── Parsed plan ─────────────────────────────────────────────────────────────

export interface ParsedPlan {
  frontmatter: PlanFrontmatter;
  objective: string;
  execution_context: string[];
  context_refs: string[];
  tasks: PlanTask[];
  raw: string;
}

// ─── Init command types ──────────────────────────────────────────────────────

/**
 * JSON output from `gsd-tools.cjs init new-project`.
 * Describes project state and model configuration for the init workflow.
 */
export interface InitNewProjectInfo {
  /** Model resolved for the gsd-project-researcher agent. */
  researcher_model: string;
  /** Model resolved for the gsd-research-synthesizer agent. */
  synthesizer_model: string;
  /** Model resolved for the gsd-roadmapper agent. */
  roadmapper_model: string;

  /** Whether docs should be committed after generation. */
  commit_docs: boolean;

  /** Whether .planning/PROJECT.md already exists. */
  project_exists: boolean;
  /** Whether a .planning/codebase directory exists. */
  has_codebase_map: boolean;
  /** Whether .planning/ directory exists at all. */
  planning_exists: boolean;

  /** Whether source code files were detected in the project. */
  has_existing_code: boolean;
  /** Whether a package manifest (package.json, Cargo.toml, etc.) was found. */
  has_package_file: boolean;
  /** True when existing code or a package manifest is present. */
  is_brownfield: boolean;
  /** True when brownfield but no codebase map exists yet. */
  needs_codebase_map: boolean;

  /** Whether a .git directory exists. */
  has_git: boolean;

  /** Whether Brave Search API key is available. */
  brave_search_available: boolean;
  /** Whether Firecrawl API key is available. */
  firecrawl_available: boolean;
  /** Whether Exa Search API key is available. */
  exa_search_available: boolean;

  /** Relative path to PROJECT.md (always '.planning/PROJECT.md'). */
  project_path: string;

  /** Absolute project root path (injected by withProjectRoot). */
  project_root?: string;

  /** Allow additional fields from gsd-tools evolution. */
  [key: string]: unknown;
}

// ─── Session & execution types ───────────────────────────────────────────────

/**
 * Options for configuring a single plan execution session.
 */
export interface SessionOptions {
  /** Maximum agentic turns before stopping. Default: 50. */
  maxTurns?: number;
  /** Maximum budget in USD. Default: 5.0. */
  maxBudgetUsd?: number;
  /** Model ID to use (e.g., 'claude-sonnet-4-6'). Falls back to config model_profile. */
  model?: string;
  /** Working directory for the session. */
  cwd?: string;
  /** Allowed tool names. Default: ['Read','Write','Edit','Bash','Grep','Glob']. */
  allowedTools?: string[];
}

/**
 * Usage statistics from a completed session.
 */
export interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

/**
 * Result of a plan execution session.
 */
export interface PlanResult {
  /** Whether the plan completed successfully. */
  success: boolean;
  /** Session UUID for audit trail. */
  sessionId: string;
  /** Total cost in USD. */
  totalCostUsd: number;
  /** Total wall-clock duration in milliseconds. */
  durationMs: number;
  /** Token usage breakdown. */
  usage: SessionUsage;
  /** Number of agentic turns used. */
  numTurns: number;
  /** Error details when success is false. */
  error?: {
    /** Error subtype from SDK result (e.g., 'error_max_turns', 'error_during_execution'). */
    subtype: string;
    /** Error messages. */
    messages: string[];
  };
}

/**
 * Options for creating a GSD instance.
 */
export interface GSDOptions {
  /** Root directory of the project. */
  projectDir: string;
  /** Path to gsd-tools.cjs. Falls back to <projectDir>/.claude/, then the bundled repo path, then ~/.claude/. */
  gsdToolsPath?: string;
  /**
   * Optional session correlation id for query mutation events when using {@link GSD.createTools}.
   */
  sessionId?: string;
  /** Model to use for execution sessions. */
  model?: string;
  /** Maximum budget per plan execution in USD. Default: 5.0. */
  maxBudgetUsd?: number;
  /** Maximum turns per plan execution. Default: 50. */
  maxTurns?: number;
  /** Enable auto mode: sets auto_advance=true, skip_discuss=false in workflow config. */
  autoMode?: boolean;
  /** Workstream name. Routes all .planning/ paths to .planning/workstreams/<name>/. */
  workstream?: string;
}

// ─── S02: Event stream types ─────────────────────────────────────────────────

/**
 * Phase types for GSD execution workflow.
 */
export enum PhaseType {
  Discuss = 'discuss',
  Research = 'research',
  Plan = 'plan',
  Execute = 'execute',
  Verify = 'verify',
  Repair = 'repair',
}

/**
 * Event types emitted by the GSD event stream.
 * Maps from SDKMessage variants to domain-meaningful events.
 */
export enum GSDEventType {
  SessionInit = 'session_init',
  SessionComplete = 'session_complete',
  SessionError = 'session_error',
  AssistantText = 'assistant_text',
  ToolCall = 'tool_call',
  ToolProgress = 'tool_progress',
  ToolUseSummary = 'tool_use_summary',
  TaskStarted = 'task_started',
  TaskProgress = 'task_progress',
  TaskNotification = 'task_notification',
  CostUpdate = 'cost_update',
  APIRetry = 'api_retry',
  RateLimit = 'rate_limit',
  StatusChange = 'status_change',
  CompactBoundary = 'compact_boundary',
  StreamEvent = 'stream_event',
  PhaseStart = 'phase_start',
  PhaseStepStart = 'phase_step_start',
  PhaseStepComplete = 'phase_step_complete',
  PhaseComplete = 'phase_complete',
  WaveStart = 'wave_start',
  WaveComplete = 'wave_complete',
  MilestoneStart = 'milestone_start',
  MilestoneComplete = 'milestone_complete',
  InitStart = 'init_start',
  InitStepStart = 'init_step_start',
  InitStepComplete = 'init_step_complete',
  InitComplete = 'init_complete',
  InitResearchSpawn = 'init_research_spawn',
  StateMutation = 'state_mutation',
  ConfigMutation = 'config_mutation',
  FrontmatterMutation = 'frontmatter_mutation',
  GitCommit = 'git_commit',
  TemplateFill = 'template_fill',
}

/**
 * Base fields present on every GSD event.
 */
export interface GSDEventBase {
  type: GSDEventType;
  timestamp: string;
  sessionId: string;
  phase?: PhaseType;
  planName?: string;
}

/**
 * Session initialized — emitted on SDKSystemMessage subtype 'init'.
 */
export interface GSDSessionInitEvent extends GSDEventBase {
  type: GSDEventType.SessionInit;
  model: string;
  tools: string[];
  cwd: string;
}

/**
 * Session completed successfully — emitted on SDKResultSuccess.
 */
export interface GSDSessionCompleteEvent extends GSDEventBase {
  type: GSDEventType.SessionComplete;
  success: true;
  totalCostUsd: number;
  durationMs: number;
  numTurns: number;
  result?: string;
}

/**
 * Session ended with an error — emitted on SDKResultError.
 */
export interface GSDSessionErrorEvent extends GSDEventBase {
  type: GSDEventType.SessionError;
  success: false;
  totalCostUsd: number;
  durationMs: number;
  numTurns: number;
  errorSubtype: string;
  errors: string[];
}

/**
 * Assistant produced text output.
 */
export interface GSDAssistantTextEvent extends GSDEventBase {
  type: GSDEventType.AssistantText;
  text: string;
}

/**
 * Tool invocation detected in assistant response.
 */
export interface GSDToolCallEvent extends GSDEventBase {
  type: GSDEventType.ToolCall;
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
}

/**
 * Tool execution progress update.
 */
export interface GSDToolProgressEvent extends GSDEventBase {
  type: GSDEventType.ToolProgress;
  toolName: string;
  toolUseId: string;
  elapsedSeconds: number;
}

/**
 * Tool use summary after completion.
 */
export interface GSDToolUseSummaryEvent extends GSDEventBase {
  type: GSDEventType.ToolUseSummary;
  summary: string;
  toolUseIds: string[];
}

/**
 * Subagent task started.
 */
export interface GSDTaskStartedEvent extends GSDEventBase {
  type: GSDEventType.TaskStarted;
  taskId: string;
  description: string;
  taskType?: string;
}

/**
 * Subagent task progress.
 */
export interface GSDTaskProgressEvent extends GSDEventBase {
  type: GSDEventType.TaskProgress;
  taskId: string;
  description: string;
  totalTokens: number;
  toolUses: number;
  durationMs: number;
  lastToolName?: string;
}

/**
 * Subagent task completed/failed/stopped.
 */
export interface GSDTaskNotificationEvent extends GSDEventBase {
  type: GSDEventType.TaskNotification;
  taskId: string;
  status: 'completed' | 'failed' | 'stopped';
  summary: string;
}

/**
 * Cost updated (emitted on session_complete and periodically).
 */
export interface GSDCostUpdateEvent extends GSDEventBase {
  type: GSDEventType.CostUpdate;
  sessionCostUsd: number;
  cumulativeCostUsd: number;
}

/**
 * API retry in progress.
 */
export interface GSDAPIRetryEvent extends GSDEventBase {
  type: GSDEventType.APIRetry;
  attempt: number;
  maxRetries: number;
  retryDelayMs: number;
  errorStatus: number | null;
}

/**
 * Rate limit information updated.
 */
export interface GSDRateLimitEvent extends GSDEventBase {
  type: GSDEventType.RateLimit;
  status: string;
  resetsAt?: number;
  utilization?: number;
}

/**
 * System status change (e.g., compacting).
 */
export interface GSDStatusChangeEvent extends GSDEventBase {
  type: GSDEventType.StatusChange;
  status: string | null;
}

/**
 * Compact boundary — context window was compacted.
 */
export interface GSDCompactBoundaryEvent extends GSDEventBase {
  type: GSDEventType.CompactBoundary;
  trigger: 'manual' | 'auto';
  preTokens: number;
}

/**
 * Raw stream event from SDK (partial assistant messages).
 */
export interface GSDStreamEvent extends GSDEventBase {
  type: GSDEventType.StreamEvent;
  event: unknown;
}

/**
 * Phase execution started.
 */
export interface GSDPhaseStartEvent extends GSDEventBase {
  type: GSDEventType.PhaseStart;
  phaseNumber: string;
  phaseName: string;
}

/**
 * A single phase step (discuss, research, etc.) started.
 */
export interface GSDPhaseStepStartEvent extends GSDEventBase {
  type: GSDEventType.PhaseStepStart;
  phaseNumber: string;
  step: PhaseStepType;
}

/**
 * A single phase step completed.
 */
export interface GSDPhaseStepCompleteEvent extends GSDEventBase {
  type: GSDEventType.PhaseStepComplete;
  phaseNumber: string;
  step: PhaseStepType;
  success: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Full phase execution completed.
 */
export interface GSDPhaseCompleteEvent extends GSDEventBase {
  type: GSDEventType.PhaseComplete;
  phaseNumber: string;
  phaseName: string;
  success: boolean;
  totalCostUsd: number;
  totalDurationMs: number;
  stepsCompleted: number;
}

// ─── S04: Plan index & wave event types ─────────────────────────────────────

/**
 * Info about a single plan within a phase, as returned by phase-plan-index.
 */
export interface PlanInfo {
  id: string;
  wave: number;
  autonomous: boolean;
  objective: string | null;
  files_modified: string[];
  task_count: number;
  has_summary: boolean;
}

/**
 * Structured plan index for a phase, grouping plans into dependency waves.
 */
export interface PhasePlanIndex {
  phase: string;
  plans: PlanInfo[];
  waves: Record<string, string[]>;
  incomplete: string[];
  has_checkpoints: boolean;
}

/**
 * Wave execution started — emitted before concurrent plans launch.
 */
export interface GSDWaveStartEvent extends GSDEventBase {
  type: GSDEventType.WaveStart;
  phaseNumber: string;
  waveNumber: number;
  planCount: number;
  planIds: string[];
}

/**
 * Wave execution completed — emitted after all plans in a wave settle.
 */
export interface GSDWaveCompleteEvent extends GSDEventBase {
  type: GSDEventType.WaveComplete;
  phaseNumber: string;
  waveNumber: number;
  successCount: number;
  failureCount: number;
  durationMs: number;
}

// ─── S05: Milestone-level types ──────────────────────────────────────────────

/**
 * Single phase entry from `gsd-tools.cjs roadmap analyze`.
 */
export interface RoadmapPhaseInfo {
  number: string;
  disk_status: string;
  roadmap_complete: boolean;
  phase_name: string;
}

/**
 * Structured output from `gsd-tools.cjs roadmap analyze`.
 */
export interface RoadmapAnalysis {
  phases: RoadmapPhaseInfo[];
  [key: string]: unknown;
}

/**
 * Options for configuring a milestone-level run (multi-phase orchestration).
 * Superset of PhaseRunnerOptions so phase-level callbacks pass through.
 */
export interface MilestoneRunnerOptions extends PhaseRunnerOptions {
  /** Called after each phase completes. Return 'stop' to halt milestone execution. */
  onPhaseComplete?: (result: PhaseRunnerResult, phaseInfo: RoadmapPhaseInfo) => Promise<void | 'stop'>;
}

/**
 * Result of a full milestone run (all phases).
 */
export interface MilestoneRunnerResult {
  success: boolean;
  phases: PhaseRunnerResult[];
  totalCostUsd: number;
  totalDurationMs: number;
}

/**
 * Milestone execution started.
 */
export interface GSDMilestoneStartEvent extends GSDEventBase {
  type: GSDEventType.MilestoneStart;
  phaseCount: number;
  prompt: string;
}

/**
 * Milestone execution completed.
 */
export interface GSDMilestoneCompleteEvent extends GSDEventBase {
  type: GSDEventType.MilestoneComplete;
  success: boolean;
  totalCostUsd: number;
  totalDurationMs: number;
  phasesCompleted: number;
}

// ─── Init workflow types ─────────────────────────────────────────────────────

/**
 * Named steps in the init workflow.
 */
export type InitStepName =
  | 'setup'
  | 'config'
  | 'project'
  | 'research-stack'
  | 'research-features'
  | 'research-architecture'
  | 'research-pitfalls'
  | 'synthesis'
  | 'requirements'
  | 'roadmap';

/**
 * Configuration overrides for InitRunner.
 */
export interface InitConfig {
  /** Model for research sessions (overrides gsd-tools detected model). */
  researchModel?: string;
  /** Model for synthesis/roadmap sessions. */
  orchestratorModel?: string;
  /** Max budget per individual session in USD. Default: 3.0. */
  maxBudgetPerSession?: number;
  /** Max turns per session. Default: 30. */
  maxTurnsPerSession?: number;
}

/**
 * Result of a single init workflow step.
 */
export interface InitStepResult {
  step: InitStepName;
  success: boolean;
  durationMs: number;
  costUsd: number;
  error?: string;
  artifacts?: string[];
}

/**
 * Result of the full init workflow run.
 */
export interface InitResult {
  success: boolean;
  steps: InitStepResult[];
  totalCostUsd: number;
  totalDurationMs: number;
  artifacts: string[];
}

/**
 * Init workflow started.
 */
export interface GSDInitStartEvent extends GSDEventBase {
  type: GSDEventType.InitStart;
  input: string;
  projectDir: string;
}

/**
 * Init workflow step started.
 */
export interface GSDInitStepStartEvent extends GSDEventBase {
  type: GSDEventType.InitStepStart;
  step: InitStepName;
}

/**
 * Init workflow step completed.
 */
export interface GSDInitStepCompleteEvent extends GSDEventBase {
  type: GSDEventType.InitStepComplete;
  step: InitStepName;
  success: boolean;
  durationMs: number;
  costUsd: number;
  error?: string;
}

/**
 * Init workflow completed.
 */
export interface GSDInitCompleteEvent extends GSDEventBase {
  type: GSDEventType.InitComplete;
  success: boolean;
  totalCostUsd: number;
  totalDurationMs: number;
  artifactCount: number;
}

/**
 * Research sessions spawned in parallel during init.
 */
export interface GSDInitResearchSpawnEvent extends GSDEventBase {
  type: GSDEventType.InitResearchSpawn;
  sessionCount: number;
  researchTypes: string[];
}

/**
 * State mutation completed — emitted after STATE.md write operations.
 */
export interface GSDStateMutationEvent extends GSDEventBase {
  type: GSDEventType.StateMutation;
  command: string;
  fields: string[];
  success: boolean;
}

/**
 * Config mutation completed — emitted after config.json write operations.
 */
export interface GSDConfigMutationEvent extends GSDEventBase {
  type: GSDEventType.ConfigMutation;
  command: string;
  key: string;
  success: boolean;
}

/**
 * Frontmatter mutation completed — emitted after frontmatter write operations.
 */
export interface GSDFrontmatterMutationEvent extends GSDEventBase {
  type: GSDEventType.FrontmatterMutation;
  command: string;
  file: string;
  fields: string[];
  success: boolean;
}

/**
 * Git commit completed — emitted after commit or check-commit operations.
 */
export interface GSDGitCommitEvent extends GSDEventBase {
  type: GSDEventType.GitCommit;
  hash: string | null;
  committed: boolean;
  reason: string;
}

/**
 * Template fill completed — emitted after template.fill or template.select operations.
 */
export interface GSDTemplateFillEvent extends GSDEventBase {
  type: GSDEventType.TemplateFill;
  templateType: string;
  path: string;
  created: boolean;
}

/**
 * Discriminated union of all GSD events.
 */
export type GSDEvent =
  | GSDSessionInitEvent
  | GSDSessionCompleteEvent
  | GSDSessionErrorEvent
  | GSDAssistantTextEvent
  | GSDToolCallEvent
  | GSDToolProgressEvent
  | GSDToolUseSummaryEvent
  | GSDTaskStartedEvent
  | GSDTaskProgressEvent
  | GSDTaskNotificationEvent
  | GSDCostUpdateEvent
  | GSDAPIRetryEvent
  | GSDRateLimitEvent
  | GSDStatusChangeEvent
  | GSDCompactBoundaryEvent
  | GSDStreamEvent
  | GSDPhaseStartEvent
  | GSDPhaseStepStartEvent
  | GSDPhaseStepCompleteEvent
  | GSDPhaseCompleteEvent
  | GSDWaveStartEvent
  | GSDWaveCompleteEvent
  | GSDMilestoneStartEvent
  | GSDMilestoneCompleteEvent
  | GSDInitStartEvent
  | GSDInitStepStartEvent
  | GSDInitStepCompleteEvent
  | GSDInitCompleteEvent
  | GSDInitResearchSpawnEvent
  | GSDStateMutationEvent
  | GSDConfigMutationEvent
  | GSDFrontmatterMutationEvent
  | GSDGitCommitEvent
  | GSDTemplateFillEvent;

/**
 * Transport handler interface for consuming GSD events.
 * Transports receive all events and can write to files, WebSockets, etc.
 */
export interface TransportHandler {
  /** Called for each event. Must not throw. */
  onEvent(event: GSDEvent): void;
  /** Called when the stream is closing. Clean up resources. */
  close(): void;
}

/**
 * Context files resolved for a phase execution.
 */
export interface ContextFiles {
  state?: string;
  roadmap?: string;
  context?: string;
  research?: string;
  requirements?: string;
  config?: string;
  plan?: string;
  summary?: string;
}

/**
 * Per-session cost bucket for tracking execution costs.
 */
export interface CostBucket {
  sessionId: string;
  costUsd: number;
}

/**
 * Cost tracker interface for per-session and cumulative cost tracking.
 * Uses per-session buckets keyed by session_id for thread-safety in parallel execution.
 */
export interface CostTracker {
  /** Per-session cost buckets. */
  sessions: Map<string, CostBucket>;
  /** Total cumulative cost across all sessions. */
  cumulativeCostUsd: number;
  /** Current active session ID. */
  activeSessionId?: string;
}

// ─── S03: Phase lifecycle types ──────────────────────────────────────────────

/**
 * Steps in the phase lifecycle state machine.
 * Extends beyond the existing PhaseType enum (which covers session types)
 * to include the full lifecycle including 'advance'.
 */
export enum PhaseStepType {
  Discuss = 'discuss',
  Research = 'research',
  Plan = 'plan',
  PlanCheck = 'plan_check',
  Execute = 'execute',
  Verify = 'verify',
  Advance = 'advance',
}

/**
 * Structured output from `gsd-tools.cjs init phase-op <N>`.
 * Describes the current state of a phase on disk.
 */
export interface PhaseOpInfo {
  phase_found: boolean;
  phase_dir: string;
  phase_number: string;
  phase_name: string;
  phase_slug: string;
  padded_phase: string;
  has_research: boolean;
  has_context: boolean;
  has_plans: boolean;
  has_verification: boolean;
  plan_count: number;
  roadmap_exists: boolean;
  planning_exists: boolean;
  commit_docs: boolean;
  context_path: string;
  research_path: string;
}

/**
 * Result of a single phase step execution.
 */
export interface PhaseStepResult {
  step: PhaseStepType;
  success: boolean;
  durationMs: number;
  error?: string;
  planResults?: PlanResult[];
}

/**
 * Result of a full phase lifecycle run.
 */
export interface PhaseRunnerResult {
  phaseNumber: string;
  phaseName: string;
  steps: PhaseStepResult[];
  success: boolean;
  totalCostUsd: number;
  totalDurationMs: number;
}

/**
 * Callback hooks for human gates in the phase lifecycle.
 * When not provided, the runner auto-approves at each gate.
 */
export interface HumanGateCallbacks {
  onDiscussApproval?: (context: { phaseNumber: string; phaseName: string }) => Promise<'approve' | 'reject' | 'modify'>;
  onVerificationReview?: (result: { phaseNumber: string; stepResult: PhaseStepResult }) => Promise<'accept' | 'reject' | 'retry'>;
  onBlockerDecision?: (blocker: { phaseNumber: string; step: PhaseStepType; error?: string }) => Promise<'retry' | 'skip' | 'stop'>;
}

/**
 * Options for configuring a PhaseRunner execution.
 */
export interface PhaseRunnerOptions {
  callbacks?: HumanGateCallbacks;
  maxBudgetPerStep?: number;
  maxTurnsPerStep?: number;
  model?: string;
  /** Maximum gap closure retries when verification finds gaps. Default: 1. */
  maxGapRetries?: number;
}
