# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Turn a PRD document into a fully built project by running one command, with human decisions collected asynchronously through notifications instead of synchronous CLI prompts.
**Current focus:** Phase 11 - Use Microsoft dev-tunnels for remote dashboard access

## Current Position

Phase: 12 of 13 (Claude Code remote session integration)
Plan: 2 of 2 in current phase -- COMPLETE
Status: Phase 12 complete
Last activity: 2026-02-27 -- Completed 12-02 Remote session dashboard integration (6 files modified)

Progress: [█████████░] 62% - Phase 12 complete

## Performance Metrics

**Velocity:**
- Total plans completed: 44
- Average duration: 2.9min
- Total execution time: ~2.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-and-types | 4/4 | 17min | 4min |
| 02-claude-integration | 4/4 | 9min | 2min |
| 03-core-orchestrator | 4/4 | 12min | 3min |
| 03.1-display-claude-output | 2/2 | 9min | 4.5min |
| 03.2-add-sub-phase-support | 2/2 | 6min | 3min |
| 04-response-server-and-api | 2/2 | 9min | 4.5min |
| 05-react-dashboard | 4/4 | ~45min | ~11min |
| 06-notification-system | 3/3 | 8min | 2.7min |
| 06.1-add-browser-notifications | 4/4 | 15min | 3.75min |
| 07-cli-polish-and-distribution | 3/3 | 13min | 4.3min |
| 08-autopilot-claude-command | 2/3 | 11min | 5.5min |
| 09-fix-recent-activity-persistence | 3/3 | 9min | 3min |
| 10-add-gsd-milestone-support | 4/4 | 10min | 2.5min |
| 11-use-microsoft-dev-tunnels-to-create-public-urls-for-remote-dashboard-access | 3/3 | 10min | 3.3min |
| 12-have-gsd-autopilot-process-create-a-claude-code-remote-session | 2/2 | 4min | 2min |

**Recent Trend:**
- Last 5 plans: 11-01 (3min), 11-02 (2min), 11-03 (5min), 12-01 (3min), 12-02 (1min)
- Trend: Phase 12 complete - Claude Code remote session integration complete

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Claude Agent SDK replaces `claude -p` child process spawning (from research)
- [Roadmap]: Node.js >= 20 target (Node 18 is EOL per research)
- [Roadmap]: 7-phase structure derived from requirement categories and dependency order
- [01-01]: All type exports use export type for verbatimModuleSyntax; only Zod schema is runtime export
- [01-01]: Autopilot package lives in autopilot/ subdirectory alongside existing get-shit-done-cc root
- [01-02]: Zod schema duplicates type structure with literal enums for self-contained runtime validation
- [01-02]: getState returns shallow copy for immutability; private constructor with static factory methods
- [01-03]: safeParse used for config validation (user-facing input) with field-level error formatting
- [01-03]: Env var coercion: "true"/"false" to boolean, numeric strings to number, else string passthrough
- [01-04]: Ring buffer population in log() method, not pino stream pipeline -- synchronous and avoids multistream performance concerns
- [01-04]: SonicBoom flush uses ready-then-flushSync pattern to handle async destination readiness
- [02-01]: export type for all Claude types (consistent with verbatimModuleSyntax)
- [02-01]: ES2024 lib in tsconfig instead of global type declaration for Promise.withResolvers
- [02-01]: timer.unref() in createTimeout prevents vitest hangs and Node process exit issues
- [02-02]: SDKResultLike local interface for duck-typing instead of SDK import (avoids runtime side effects)
- [02-02]: Three-branch parsing: success, is_error override, error subtypes (explicit over DRY)
- [02-03]: Locally-defined SDK interfaces (AskUserQuestionInput, PermissionResultAllow) to keep tests SDK-free
- [02-03]: HandleQuestionOptions as separate parameter for phase/step metadata
- [02-03]: Conditional spread for optional phase/step fields to keep QuestionEvent clean
- [02-04]: Double-cast through unknown for SDK input types in canUseTool (strict mode)
- [02-04]: vi.mock with async generator factories for testing SDK query() without process spawning
- [02-04]: AbortError name-check for timeout detection (matches SDK abort behavior)
- [03-01]: Injectable exit function in ShutdownManager.install() for testability (default: process.exit)
- [03-01]: YOLO config uses spread merge ({...existing, ...yoloSettings}) preserving user keys not in override set
- [03-01]: Invalid JSON in existing config.json treated as empty object (YOLO settings take priority)
- [03-02]: Pure function separation: generateSkipDiscussContext returns string, writeSkipDiscussContext adds I/O
- [03-02]: ENOENT means passed -- missing verification/UAT files assume phase passed (no false gap detection)
- [03-02]: vi.useFakeTimers() for Date mocking in vitest (vi.spyOn(Date) breaks constructors)
- [03-03]: extractPhasesFromContent as pure function accepting content string for testability
- [03-03]: ShutdownError custom error class to distinguish shutdown aborts from real errors
- [03-03]: Phase 3 escalation defaults to abort (throw) since web UI is Phase 4
- [03-03]: Gap detection resets verify step to idle after each iteration for re-verify
- [03-04]: Commander.js v14 installed (ESM-native, async action support via parseAsync)
- [03-04]: CLI validates --prd/--resume manually in action handler (not .requiredOption) for conditional requirement
- [03-04]: ShutdownManager wiring: logger flush + state persist handlers registered before orchestrator start
- [03.1-01]: Error results (is_error: true) bypass verbosity filter -- always visible in quiet mode
- [03.1-01]: Text delta stream events skipped in StreamLogger to prevent log bloat (Pitfall 3)
- [03.1-01]: Unicode box-drawing with ASCII fallback via WT_SESSION/TERM_PROGRAM detection
- [03.1-01]: Mock WritableOutput interface for testable stream output (not coupled to process.stdout)
- [03.1-02]: ClaudeService emits 'message' before session_id/result parsing -- all consumers see every message type
- [03.1-02]: StreamLogger flush registered before AutopilotLogger flush in ShutdownManager -- SDK logs flush first
- [03.1-02]: Orchestrator event listeners wired proactively (forward-compatible with future emit() calls)
- [03.1-02]: Spinner stopped before console.error in catch block to prevent garbled terminal output
- [04-01]: createServer() instead of app.listen() for reliable EADDRINUSE error handling on Windows
- [04-01]: String() cast on Express 5 req.params values (typed as string | string[] in @types/express@5)
- [04-01]: computeProgress() as exported pure function from routes/api.ts for testability
- [04-02]: AutopilotLogger extends EventEmitter (extends + super()) for zero-overhead SSE delivery
- [04-02]: SSE client cleanup via try-catch in broadcast loop handles disconnected clients without crashing
- [04-02]: SPA fallback checks req.path.startsWith('/api/') to avoid catching API routes
- [04-02]: ResponseServer shutdown registered last in ShutdownManager for LIFO first-close ordering
- [05-01]: Zustand 5 curried create<T>()() pattern for TypeScript compatibility
- [05-01]: Dashboard types duplicated from server (no cross-project imports -- separate Vite project)
- [05-01]: useSSE rehydrates full state from REST on every connect/reconnect
- [05-01]: Log buffer capped at 500, activities at 50 to bound client memory
- [05-01]: Vite proxy /api to localhost:3847 for dev, same-origin in production
- [05-02]: Layout calls useSSE() and initial data fetch at top level so all child routes get real-time updates
- [05-02]: Individual store selectors in Overview (not entire store) to minimize re-renders
- [05-02]: Inline timeAgo helper instead of date-fns dependency for relative timestamp formatting
- [05-02]: LogStream auto-scroll uses scrollHeight-scrollTop-clientHeight threshold detection
- [05-03]: DASH-16 implemented as pre-submit editing (form freely editable before submit, disabled after)
- [05-03]: Freeform text overrides option selection when non-empty (merge priority on submit)
- [05-03]: LogStream component reused from Plan 02 for filtered phase logs
- [05-03]: PhaseCard STEP_ORDER fixed to const assertion to avoid PhaseStep union indexing error
- [05-04]: Express 5 path-to-regexp v8 requires named wildcards ({*path}) instead of bare * for SPA catchall
- [05-04]: dashboardDir resolved via fileURLToPath(import.meta.url) from dist/cli/index.js up two levels to dashboard/dist
- [05-04]: Log filtering uses useMemo with AND-composed phase/step/search filters for efficient client-side filtering
- [06-01]: Terminal bell uses \x07 (not \a which is not a JS escape sequence) for question notifications in ConsoleAdapter
- [06-01]: NotificationManager.createNotification() static helper auto-generates UUID and ISO timestamp
- [06-01]: ConsoleAdapter format() method is public for testability without I/O side effects
- [06-02]: TeamsAdapter uses Adaptive Card format in message/attachments envelope (NOT deprecated MessageCard)
- [06-02]: SlackAdapter requires top-level text fallback field alongside blocks (Slack API requirement)
- [06-02]: SystemAdapter uses createRequire(import.meta.url) for CJS node-notifier in ESM project
- [06-02]: loadCustomAdapter resolves paths relative to process.cwd() (not import.meta.url)
- [06-02]: loadCustomAdapter validates init/send/close methods before returning adapter
- [06-03]: NotificationManager constructor only takes questionReminderMs -- ConsoleAdapter receives port/stopSpinner directly
- [06-03]: Console adapter always added as fallback before channel-specific adapter switch
- [06-03]: notificationManager.close() called in success path, error path, and ShutdownManager LIFO registration
- [06-03]: build:complete has two listeners -- one for streamRenderer.stopSpinner(), one for notification dispatch (separate concerns)
- [07-01]: Preflight checks run in parallel via Promise.all, returning all failures at once (not one-at-a-time)
- [07-01]: parsePhaseRange returns sorted deduplicated number[] instead of {start, end} for non-contiguous range support
- [07-01]: Orchestrator.run() now accepts number[] and uses .includes() for phase filtering
- [07-01]: Error messages follow pattern: error statement + actionable fix + help reference
- [07-02]: Use @inquirer/prompts over inquirer.js classic for ESM-native, tree-shakeable prompts
- [07-02]: Exclude prdPath from saved config (project-specific, not a user preference)
- [07-02]: Wizard feeds options into normal CLI flow (no separate execution path)
- [08-01]: SHA-256 hash (first 8 hex chars) for deterministic branch-to-port mapping (base 3847 + hash % 1000)
- [08-01]: Linear probing for port collision resolution (increment until free port found in range [3847, 4846])
- [08-01]: Port reuse from state file if still available, falls back to hash + collision detection
- [08-01]: Node.js built-in test runner (node:test) for standalone .js modules outside TypeScript build
- [08-01]: Plain JavaScript (not TypeScript) for ~/.claude/skills/ modules that run without compilation
- [08-02]: PID files named autopilot-{sanitized-branch}.pid with / replaced by -- for cross-platform compatibility
- [08-02]: isProcessRunning uses signal 0 check, treats EPERM as running (process exists but no permission)
- [08-02]: stopProcess escalates SIGTERM -> wait up to 5s -> SIGKILL for graceful shutdown with timeout
- [08-02]: Launch checks for existing instance before spawning to prevent double-spawn
- [08-02]: Health check retries 3 times with 1-second delays using node:http (not fetch)
- [08-02]: PRD prompt uses readline (not @inquirer/prompts) to maintain zero external dependencies
- [08-02]: Status reads autopilot-state.json for phase progress and port from branches field
- [03.2-01]: extractDependsOn uses line-by-line parsing instead of complex regex for reliability
- [03.2-02]: Purple color scheme (bg-purple-100, text-purple-700) for INSERTED badge to visually distinguish from status badges
- [03.2-02]: Small font size (text-[9px]) and uppercase for subtle secondary label that doesn't compete with status badge
- [03.2-02]: Flat list display with visual distinction via badge (not nested hierarchy)
- [Phase 09-01]: ActivityStore follows StateStore pattern with atomic writes and non-critical error handling
- [Phase 09-01]: ActivityProvider interface uses optional injection to avoid breaking existing callers
- [Phase 09-02]: ActivityStore injected as optional dependency to Orchestrator (no breaking changes)
- [Phase 09-02]: Phase activities use em-dash separator format: 'Phase N: Name — action'
- [Phase 09-02]: Question-pending activities display truncated question text (not raw UUIDs)
- [Phase 09-02]: Question-answered activities marked without exposing answer text
- [Phase 09-02]: All activities use server timestamps (new Date().toISOString()) not client timestamps
- [Phase 09-02]: Activity creation at event source (server-side) not client-side
- [Phase 09-03]: Dashboard activities exclusively loaded from server via fetchActivities() REST endpoint
- [Phase 09-03]: Timestamp formatting: relative time < 24h, absolute date >= 24h
- [Phase 09-03]: Live timestamp refresh every 30 seconds using useState + useEffect
- [Phase 09-03]: Load more pagination: initial 20 entries with button for older entries
- [Phase 09-03]: Error activities styled with bold text + red background tint
- [Phase 09-03]: Answered questions show checkmark indicator in activity feed
- [Phase 06.1-01]: web-push library used for Web Push protocol implementation with VAPID authentication
- [Phase 06.1-01]: VAPID keys stored in .planning/.vapid-keys.json with .gitignore protection (env vars, file, or auto-generation)
- [Phase 06.1-01]: In-memory subscription storage via Map keyed by endpoint (production would use database)
- [Phase 06.1-01]: Automatic cleanup of expired subscriptions on 404/410 HTTP status from web-push
- [Phase 06.1-02]: vite-plugin-pwa with injectManifest strategy for custom Service Worker control
- [Phase 06.1-02]: Service Worker auto-registers on page load via injectRegister: 'auto' setting
- [Phase 06.1-02]: PWA icons use GSD brand color #1f2937 for consistent dashboard theme
- [Phase 06.1-02]: Notification click handler navigates existing window or opens new tab to dashboard page
- [Phase 06.1-02]: Programmatic PNG/MP3 generation scripts for reproducible asset builds
- [Phase 06.1-01]: Push routes follow Express Router factory pattern consistent with routes/api.ts
- [Phase 06.1-03]: Action-needed notifications (questions, errors) enabled by default, informational (phaseCompleted) disabled by default
- [Phase 06.1-03]: Soft-ask permission flow: show 'Enable notifications' link, not auto-prompt
- [Phase 06.1-03]: Badge API integrated as progressive enhancement (silent fail)
- [Phase 06.1-04]: Pass pushManager through sseDeps instead of separate initPush call for cleaner wiring
- [Phase 06.1-04]: Question debouncing: 500ms window, group multiple rapid-fire questions into single notification
- [Phase 06.1-04]: Foreground sound plays at 50% volume to avoid jarring users
- [Phase 06.1-04]: All push notifications include "GSD Autopilot: " title prefix for brand recognition
- [Phase 10-01]: Regex-based markdown parsing for milestone data (not full markdown library like marked/markdown-it)
- [Phase 10-01]: ENOENT returns empty/null gracefully - missing milestone files are valid state for fresh projects
- [Phase 10-01]: Cross-reference PROJECT.md and MILESTONES.md to determine active vs shipped milestone status
- [Phase 10-01]: parseFloat() instead of parseInt() for decimal phase number support (3.1, 06.1)
- [Phase 10-03]: Dashboard milestone types duplicated from server (consistent with separate Vite project pattern)
- [Phase 10-03]: setMilestones action takes current/shipped separately (matches API response shape)
- [Phase 10-03]: fetchMilestones wrapped in .catch() for graceful degradation with older servers
- [Phase 10-03]: Milestone identity shown in PhaseCard header only (per user decision)
- [Phase 10-03]: Dual progress indicators - phase count (right) and milestone progress (subtitle)
- [Phase 10-04]: Victory screen shows only the just-shipped milestone (no historical references per user decision)
- [Phase 10-04]: Victory screen triggered by milestone status === 'shipped' OR currentMilestone null with shipped milestones
- [Phase 10-04]: 100% progress alone does NOT trigger victory (only shipped status per user decision)
- [Phase 10-04]: No-milestone card is inline lightweight component (not separate file)
- [Phase 10-04]: Victory screen uses CSS-only icons (no external icon library)
- [Phase 10-04]: Next-milestone prompt shows command only (button deferred per user decision)
- [Phase 07-03]: Test file exclusion from npm package via negation patterns in files array (!workflows/**/__tests__, !workflows/**/*.test.js)
- [Phase 07-03]: Structural Unix compatibility verification (shebangs + .gitattributes) with runtime testing deferred to CI/CD
- [Phase 07-03]: End-to-end tarball verification process: build → pack → install in temp dir → test CLI → clean up
- [Phase 11-01]: TunnelManagementHttpClient uses ProductHeaderValue object {name, version} for user agent (not separate strings)
- [Phase 11-01]: Port URI extraction via portUriFormat.replace('{port}', port) pattern (endpoints use templates, not pre-computed maps)
- [Phase 11-01]: Reconnection scaffolding implemented without event wiring (SDK event API needs runtime validation)
- [Phase 11-01]: ManagementApiVersions.Version20230927preview is CamelCase with lowercase 'preview' suffix
- [Phase 11-02]: tunnelUrl stored in AutopilotState for persistence across restarts and cross-tool access
- [Phase 11-02]: Tunnel enabled by default in CLI, explicit opt-out with --no-tunnel flag
- [Phase 11-02]: Tunnel failure is non-fatal - dashboard works locally with warning (graceful degradation)
- [Phase 11-02]: Tunnel cleanup registered in ShutdownManager LIFO order (runs before server shutdown)
- [Phase 11-02]: Standalone server checks DEVTUNNEL_TOKEN/AAD_TOKEN env vars to auto-enable tunnel
- [Phase 12-01]: RemoteSessionManager spawns claude remote-control with 30s timeout for URL detection
- [Phase 12-01]: No auto-restart on remote session process death (log warning only)
- [Phase 12-01]: Remote session lifecycle follows TunnelManager pattern (SIGTERM -> 5s -> SIGKILL)
- [Phase 12-01]: Remote session enabled by default with --no-remote opt-out flag
- [Phase 12-02]: Blue color scheme (bg-blue-50, text-blue-*) for RemoteSessionCard to visually distinguish from TunnelBanner (purple)
- [Phase 12-02]: Added tunnelUrl to /api/status response (was in state but missing from API - fixed gap)
- [Phase 12-02]: Placed RemoteSessionCard immediately below TunnelBanner for logical URL grouping

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Display claude console output to parent node process so users can see whats happening (URGENT)
- Phase 8 added: Autopilot should be able to be executed by using a claude command
- Phase 06.1 inserted after Phase 6: add browser notifications to alert users when needed (URGENT)
- Phase 03.2 inserted after Phase 3: Add Sub phase support to orchestrator and dashboard (URGENT)
- Phase 9 added: Fix Recent activity so it persists in the .planning folder so it stays consistant and time works properly
- Phase 10 added: Add GSD Milestone support to autopilot and dashboard
- Phase 11 added: Use Microsoft dev-tunnels to create public URLs for remote dashboard access
- Phase 12 added: have gsd autopilot process create a claude code remote session and add the url to the dashboard so users can ask questions to claude code. The claude code session will stay open so users can ask questions or restart autopilot if nessessary.

### Pending Todos

None yet.

### Blockers/Concerns

- Agent SDK + GSD slash command integration is untested (needs validation in Phase 2)
- ~~`Promise.withResolvers` requires Node.js 22+ or polyfill for Node.js 20~~ RESOLVED: polyfill created in 02-01

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 12-02-PLAN.md (Remote session dashboard integration - 6 files modified)
Resume file: None
