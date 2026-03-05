#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadConfig } from '../config/index.js';
import { derivePort } from '../config/derive-port.js';
import { StateStore } from '../state/index.js';
import { AutopilotLogger } from '../logger/index.js';
import { ClaudeService } from '../claude/index.js';
import { Orchestrator } from '../orchestrator/index.js';
import { ShutdownManager } from '../orchestrator/shutdown.js';
import { parsePhaseRange } from '../orchestrator/gap-detector.js';
import { runPreflightChecks } from './preflight.js';
import { runSetupWizard } from './wizard.js';
import { StreamRenderer, StreamLogger } from '../output/index.js';
import type { VerbosityLevel } from '../output/index.js';
import { ResponseServer } from '../server/index.js';
import { ActivityStore, truncateText } from '../activity/index.js';
import { EventWriter } from '../ipc/event-writer.js';
import { HeartbeatWriter } from '../ipc/heartbeat-writer.js';
import { AnswerPoller } from '../ipc/answer-poller.js';
import {
  NotificationManager,
  ConsoleAdapter,
  TeamsAdapter,
  SlackAdapter,
  CustomWebhookAdapter,
  SystemAdapter,
  loadCustomAdapter,
} from '../notifications/index.js';
import { randomUUID } from 'node:crypto';
import type { Notification } from '../types/notification.js';
import type { QuestionEvent } from '../claude/types.js';
import { TunnelManager } from '../server/tunnel/index.js';
import { RemoteSessionManager } from '../server/remote-session/index.js';

// Read version from package.json at runtime
const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

const program = new Command();

program
  .name('gsd-autopilot')
  .description('Autonomous GSD workflow orchestrator')
  .version(pkg.version)
  .showHelpAfterError('(run gsd-autopilot --help for usage information)')
  .addHelpText('after', `
Examples:
  $ gsd-autopilot --prd ./idea.md           # New project from PRD
  $ gsd-autopilot                            # Run with existing .planning/
  $ gsd-autopilot --resume                   # Resume from last checkpoint
  $ gsd-autopilot --prd ./spec.md --phases 1-3,5

Dashboard:
  Port auto-derived from git repo (override with --port)

Created by NexeraDigital — https://github.com/NexeraDigital
`)
  .option('--prd <path>', 'Path to PRD/idea document')
  .option('--resume', 'Resume from last checkpoint')
  .option('--skip-discuss', 'Skip discuss-phase, let Claude decide everything')
  .option('--skip-verify', 'Skip verification step')
  .option('--phases <range>', 'Run specific phases (e.g., 1-3,5,7-9)')
  .option('--notify <channel>', 'Notification channel (console, system, teams, slack)', 'console')
  .option('--webhook-url <url>', 'Webhook URL for Teams/Slack notifications')
  .option('--port <number>', 'Dashboard server port (auto-derived from git repo if omitted)')
  .option('--depth <level>', 'Planning depth (quick, standard, comprehensive)', 'standard')
  .option('--model <profile>', 'Model profile (quality, balanced, budget)', 'balanced')
  .option('--verbose', 'Verbose output')
  .option('--quiet', 'Suppress non-error output')
  .option('--adapter-path <path>', 'Path to custom notification adapter module')
  .option('--embedded-server', 'Run dashboard server in-process (legacy mode)')
  .option('--no-tunnel', 'Disable public tunnel (local-only dashboard)')
  .option('--no-remote', 'Disable Claude Code remote session')
  .action(async (options: {
    prd?: string;
    resume?: boolean;
    skipDiscuss?: boolean;
    skipVerify?: boolean;
    phases?: string;
    notify: string;
    webhookUrl?: string;
    adapterPath?: string;
    port?: string;
    depth: string;
    model: string;
    verbose?: boolean;
    quiet?: boolean;
    embeddedServer?: boolean;
    tunnel?: boolean;
    remote?: boolean;
  }) => {
    // a. Launch interactive wizard if no --prd or --resume provided
    if (!options.resume && !options.prd) {
      // Check if existing .planning/ROADMAP.md has phases -- no PRD needed
      const projectDir = process.cwd();
      let hasExistingPlanning = false;
      try {
        const roadmapPath = join(projectDir, '.planning', 'ROADMAP.md');
        const content = await readFile(roadmapPath, 'utf-8');
        // Quick check: does it contain phase entries?
        // Match both checkbox format (- [ ] **Phase N:) and heading format (## Phase N:)
        hasExistingPlanning = /^- \[[ x]\] \*\*Phase \d+:/m.test(content)
          || /^#{1,3} Phase \d+:/m.test(content);
      } catch {
        // ROADMAP.md doesn't exist
      }

      if (!hasExistingPlanning) {
        // No existing planning -- launch interactive setup wizard
        const wizardResult = await runSetupWizard();
        options.prd = wizardResult.prdPath;
        options.notify = wizardResult.notify;
        options.model = wizardResult.model;
        options.depth = wizardResult.depth;
        if (wizardResult.webhookUrl) {
          options.webhookUrl = wizardResult.webhookUrl;
        }
      }
    }

    // If --prd provided, resolve path (existence check happens in preflight)
    if (options.prd) {
      options.prd = resolve(options.prd);
    }

    // b. Determine project directory
    const projectDir = process.cwd();

    // c. Derive port from git repo identity (stable per repo+branch)
    const derivedPort = await derivePort(projectDir);

    // d. Load config with CLI overrides
    const cliFlags: Record<string, unknown> = {
      skipDiscuss: options.skipDiscuss ?? false,
      skipVerify: options.skipVerify ?? false,
      verbose: options.verbose ?? false,
      quiet: options.quiet ?? false,
      depth: options.depth as 'quick' | 'standard' | 'comprehensive',
      model: options.model as 'quality' | 'balanced' | 'budget',
      notify: options.notify as 'console' | 'system' | 'teams' | 'slack' | 'webhook',
      webhookUrl: options.webhookUrl,
      adapterPath: options.adapterPath,
    };
    // Only include port in CLI flags when explicitly passed
    if (options.port !== undefined) {
      cliFlags.port = parseInt(options.port, 10);
    }

    let config;
    try {
      config = await loadConfig(projectDir, cliFlags, { port: derivedPort });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Configuration error: ${msg}\n`);
      console.error('Check your .gsd-autopilot.json file or CLI flags.');
      console.error('Run gsd-autopilot --help for valid options.');
      process.exit(1);
    }

    // e. Run preflight checks -- validate ALL prerequisites at once
    const preflightFailures = await runPreflightChecks(config, options.prd);
    if (preflightFailures.length > 0) {
      console.error('\nPreflight checks failed:\n');
      for (const failure of preflightFailures) {
        console.error(`  x ${failure.error}`);
        console.error(`    ${failure.fix}\n`);
      }
      process.exit(1);
    }

    // f. Create core components
    const logger = new AutopilotLogger(join(projectDir, '.planning', 'autopilot', 'log'));
    const claudeService = new ClaudeService({ defaultCwd: projectDir, autoAnswer: false });

    // Handle state restore vs fresh creation
    // No --prd: restore existing state to preserve completed phases
    // --prd: fresh start from new PRD document
    let stateStore;
    const stateFilePath = join(projectDir, '.planning', 'autopilot', 'state.json');
    const shouldRestore = !options.prd;

    if (shouldRestore) {
      try {
        stateStore = await StateStore.restore(stateFilePath);
      } catch {
        if (options.resume) {
          console.error('No previous run found in this directory.\n');
          console.error('To start a new run:');
          console.error('  gsd-autopilot --prd <path-to-your-prd>\n');
          console.error('The --resume flag requires a previous autopilot run in the current directory.');
          process.exit(1);
        }
        // --phases without --resume: no state file yet, create fresh
        stateStore = StateStore.createFresh(projectDir);
        await stateStore.setState({});
      }
    } else {
      stateStore = StateStore.createFresh(projectDir);
      // Persist fresh state immediately to clear stale data (e.g. pending questions)
      // from previous runs before the dashboard starts reading the state file.
      await stateStore.setState({});
    }

    // Create and restore ActivityStore
    const activityStore = new ActivityStore(projectDir);
    await activityStore.restore();

    // f. Determine verbosity level from config
    const verbosity: VerbosityLevel = config.quiet ? 'quiet' : config.verbose ? 'verbose' : 'default';

    // g. Create output streaming components
    const streamRenderer = new StreamRenderer(verbosity, undefined, new Set(['AskUserQuestion']));
    const streamLogger = new StreamLogger(join(projectDir, '.planning', 'autopilot', 'log'));

    // Wire SDK message stream to terminal renderer and log file (dual output per user decision)
    claudeService.on('message', (message: unknown) => {
      streamRenderer.render(message);
      streamLogger.write(message);
    });

    // h. Parse phase range (if provided)
    const phaseRange = options.phases ? parsePhaseRange(options.phases) : undefined;

    // i. Create NotificationManager and wire adapters
    const notificationManager = new NotificationManager({
      questionReminderMs: config.questionReminderMs,
    });

    // Always add console adapter (default, zero-dependency)
    // getTunnelUrl callback will be populated after tunnel manager is created
    let tunnelUrlGetter: (() => string | null) | undefined;
    notificationManager.addAdapter(new ConsoleAdapter({
      port: config.port,
      stopSpinner: () => streamRenderer.stopSpinner(),
      getTunnelUrl: () => tunnelUrlGetter?.() ?? null,
    }));

    // Add channel-specific adapter based on config.notify
    switch (config.notify) {
      case 'system':
        notificationManager.addAdapter(new SystemAdapter());
        break;
      case 'teams':
        if (config.webhookUrl) {
          notificationManager.addAdapter(new TeamsAdapter({ webhookUrl: config.webhookUrl }));
        } else {
          console.error('Warning: --notify teams requires --webhook-url');
        }
        break;
      case 'slack':
        if (config.webhookUrl) {
          notificationManager.addAdapter(new SlackAdapter({ webhookUrl: config.webhookUrl }));
        } else {
          console.error('Warning: --notify slack requires --webhook-url');
        }
        break;
      case 'webhook':
        if (config.webhookUrl) {
          notificationManager.addAdapter(new CustomWebhookAdapter({ webhookUrl: config.webhookUrl }));
        } else {
          console.error('Warning: --notify webhook requires --webhook-url');
        }
        break;
      case 'console':
      default:
        // Console already added above
        break;
    }

    // Load custom adapter if --adapter-path provided
    if (config.adapterPath) {
      try {
        const customAdapter = await loadCustomAdapter(config.adapterPath);
        notificationManager.addAdapter(customAdapter);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Warning: Failed to load custom adapter: ${msg}`);
      }
    }

    // Initialize all adapters (failures logged and adapter removed, not thrown)
    await notificationManager.init();

    // j. Create IPC components for file-based communication with dashboard
    const eventWriter = new EventWriter(projectDir);
    const heartbeatWriter = new HeartbeatWriter(projectDir);

    const answerPoller = new AnswerPoller(projectDir, (qId, answers) => claudeService.submitAnswer(qId, answers));

    // k. Create Orchestrator
    const orchestrator = new Orchestrator({
      stateStore,
      claudeService,
      logger,
      config,
      projectDir,
      activityStore,
    });

    // Wire phase/step banners to StreamRenderer
    orchestrator.on('phase:started', ({ phase, name }: { phase: number; name: string }) => {
      streamRenderer.showBanner(phase, `Starting: ${name}`);
    });
    orchestrator.on('step:started', ({ phase, step }: { phase: number; step: string }) => {
      streamRenderer.startSpinner(`Phase ${phase}: ${step}...`);
    });
    orchestrator.on('step:completed', () => {
      streamRenderer.stopSpinner();
    });
    orchestrator.on('build:complete', () => {
      streamRenderer.stopSpinner();
    });

    // Wire events to EventWriter for IPC
    orchestrator.on('phase:started', (data: unknown) => {
      void eventWriter.write('phase-started', data);
    });
    orchestrator.on('phase:completed', (data: unknown) => {
      void eventWriter.write('phase-completed', data);
    });
    orchestrator.on('step:completed', (data: unknown) => {
      void eventWriter.write('step-completed', data);
    });
    // Track the build-complete write promise so shutdown can await it
    let buildCompleteWritePromise: Promise<void> | null = null;
    orchestrator.on('build:complete', () => {
      buildCompleteWritePromise = eventWriter.write('build-complete', {});
    });
    orchestrator.on('error:escalation', (data: unknown) => {
      void eventWriter.write('error', data);
    });

    // Wire error:escalation -> activity creation
    orchestrator.on('error:escalation', ({ phase, step, error }: { phase: number; step: string; error: string }) => {
      void activityStore.addActivity({
        type: 'error',
        message: truncateText(error, 100),
        timestamp: new Date().toISOString(),
        metadata: { phase, step },
      });
    });
    claudeService.on('question:pending', (data: unknown) => {
      void eventWriter.write('question-pending', data);
    });
    claudeService.on('question:answered', (data: unknown) => {
      void eventWriter.write('question-answered', data);
    });
    logger.on('entry', (entry: unknown) => {
      void eventWriter.write('log-entry', entry);
    });

    // Wire SDK messages to EventWriter as log-entry events for dashboard live logs.
    // Converts meaningful message types (tool use, assistant text) to LogEntry format.
    // Skips noisy stream_event text deltas to prevent log bloat.
    // Track tool_use IDs already logged from assistant messages to avoid duplicates with tool_use_summary
    const loggedToolUseIds = new Set<string>();

    claudeService.on('message', (message: unknown) => {
      const msg = message as { type?: string; subtype?: string; tool_name?: string; tool_use_id?: string; parameters?: Record<string, unknown>; message?: { content?: Array<{ type?: string; text?: string; name?: string; id?: string }> }; parent_tool_use_id?: string | null; event?: { type?: string; content_block?: { type?: string; name?: string }; delta?: { type?: string } } };

      if (msg.type === 'tool_use_summary') {
        // Skip if already logged from assistant message
        if (msg.tool_use_id && loggedToolUseIds.has(msg.tool_use_id)) {
          loggedToolUseIds.delete(msg.tool_use_id);
          return;
        }
        const toolName = msg.tool_name ?? 'unknown';
        if (toolName === 'AskUserQuestion') return;
        const params = msg.parameters ?? {};
        const summary = (params.file_path ?? params.command ?? params.pattern ?? params.query ?? params.description ?? params.skill ?? '') as string;
        const preview = typeof summary === 'string' ? summary.split('\n')[0]?.slice(0, 120) ?? '' : '';
        void eventWriter.write('log-entry', {
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'claude',
          message: `[${toolName}] ${preview}`.trimEnd(),
        });
      } else if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            const preview = block.text.split('\n')[0]?.slice(0, 200) ?? '';
            if (preview.trim()) {
              void eventWriter.write('log-entry', {
                timestamp: new Date().toISOString(),
                level: 'info',
                component: 'claude',
                message: preview,
              });
            }
          } else if (block.type === 'tool_use' && block.name) {
            if (block.name === 'AskUserQuestion') continue;
            const input = (block as { input?: Record<string, unknown> }).input ?? {};
            const summary = (input.file_path ?? input.command ?? input.pattern ?? input.query ?? input.description ?? input.skill ?? '') as string;
            const preview = typeof summary === 'string' ? summary.split('\n')[0]?.slice(0, 120) ?? '' : '';
            if (block.id) loggedToolUseIds.add(block.id);
            void eventWriter.write('log-entry', {
              timestamp: new Date().toISOString(),
              level: 'info',
              component: 'claude',
              message: `[${block.name}] ${preview}`.trimEnd(),
            });
          }
        }
      } else if (msg.type === 'result') {
        const result = message as { is_error?: boolean; result?: string; num_turns?: number; duration_ms?: number };
        const isError = result.is_error === true;
        void eventWriter.write('log-entry', {
          timestamp: new Date().toISOString(),
          level: isError ? 'error' : 'info',
          component: 'claude',
          message: isError
            ? `Command failed: ${(result.result ?? 'Unknown error').slice(0, 200)}`
            : `Command completed (${result.num_turns ?? 0} turns, ${((result.duration_ms ?? 0) / 1000).toFixed(1)}s)`,
        });
      }
    });

    // Wire question:pending -> persist full question data to state file
    claudeService.on('question:pending', (event: QuestionEvent) => {
      const state = stateStore.getState();
      const pendingQuestions = [...state.pendingQuestions];
      pendingQuestions.push({
        id: event.id,
        phase: event.phase ?? 0,
        step: (event.step as any) ?? 'idle',
        questions: event.questions.map(q => q.question),
        questionItems: event.questions,
        createdAt: event.createdAt,
      });
      void stateStore.setState({ pendingQuestions });
    });

    // Wire question:pending -> activity creation
    claudeService.on('question:pending', (event: QuestionEvent) => {
      const questionText = event.questions.map(q => q.question).join('; ');
      void activityStore.addActivity({
        type: 'question-pending',
        message: `Question: ${truncateText(questionText)}`,
        timestamp: new Date().toISOString(),
        metadata: { questionId: event.id, phase: event.phase },
      });
    });

    // Wire question:answered -> update state file + log selected answers
    claudeService.on('question:answered', ({ id, answers }: { id: string; answers: Record<string, string> }) => {
      const state = stateStore.getState();
      const pendingQuestions = state.pendingQuestions.map(q =>
        q.id === id ? { ...q, answeredAt: new Date().toISOString(), answers } : q,
      );
      void stateStore.setState({ pendingQuestions });

      // Log each answered question with the selected option
      for (const [question, answer] of Object.entries(answers)) {
        const short = question.length > 80 ? question.slice(0, 77) + '...' : question;
        void eventWriter.write('log-entry', {
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'claude',
          message: `[Answer] ${short} -> ${answer}`,
        });
      }
    });

    // Wire question:answered -> activity creation
    claudeService.on('question:answered', ({ id }: { id: string }) => {
      void activityStore.addActivity({
        type: 'question-answered',
        message: `Question answered`,
        timestamp: new Date().toISOString(),
        metadata: { questionId: id },
      });
    });

    // Wire question:pending -> notification dispatch + reminder
    claudeService.on('question:pending', (event: QuestionEvent) => {
      const respondUrl = `http://localhost:${config.port}/questions/${event.id}`;
      const questionText = event.questions.map(q => q.question).join('\n');
      const optionLabels = event.questions.flatMap(q => q.options.map(o => o.label));

      const notification: Notification = {
        id: randomUUID(),
        type: 'question',
        title: `Question${event.phase ? ` (Phase ${event.phase})` : ''}: ${event.questions[0]?.header ?? 'Input needed'}`,
        body: questionText,
        severity: 'warning',
        respondUrl,
        options: optionLabels.length > 0 ? optionLabels : undefined,
        phase: event.phase,
        step: event.step,
        createdAt: new Date().toISOString(),
      };

      notificationManager.notify(notification);
      notificationManager.startReminder(event.id, notification);
    });

    // Wire question:answered -> cancel reminder
    claudeService.on('question:answered', ({ id }: { id: string }) => {
      notificationManager.cancelReminder(id);
    });

    // Wire build:complete -> completion notification
    orchestrator.on('build:complete', () => {
      const state = stateStore.getState();
      const completedCount = state.phases.filter(p => p.status === 'completed').length;
      const totalCount = state.phases.length;
      const elapsed = state.startedAt
        ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 60000)
        : 0;

      const notification: Notification = {
        id: randomUUID(),
        type: 'complete',
        title: 'Build complete',
        body: 'All phases finished successfully.',
        severity: 'info',
        createdAt: new Date().toISOString(),
        summary: `${completedCount} of ${totalCount} phases completed in ${elapsed} min`,
        nextSteps: 'Review output in .planning/ directory',
      };

      notificationManager.notify(notification);
    });

    // Wire error:escalation -> error notification
    orchestrator.on('error:escalation', ({ phase, step, error }: { phase: number; step: string; error: string }) => {
      const state = stateStore.getState();
      const completedCount = state.phases.filter(p => p.status === 'completed').length;
      const totalCount = state.phases.length;
      const elapsed = state.startedAt
        ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 60000)
        : 0;

      const notification: Notification = {
        id: randomUUID(),
        type: 'error',
        title: `Autopilot stopped (Phase ${phase}, ${step})`,
        body: error,
        severity: 'critical',
        phase,
        step,
        createdAt: new Date().toISOString(),
        summary: `${completedCount} of ${totalCount} phases completed in ${elapsed} min`,
        nextSteps: 'Run `gsd-autopilot --resume` to retry from the failed step',
        errorMessage: error,
      };

      notificationManager.notify(notification);
    });

    // l. Install ShutdownManager (created before dashboard spawn so child cleanup can register)
    const shutdown = new ShutdownManager();

    // m. Resolve dashboard dist path for SPA serving
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const dashboardDir = join(__dirname, '..', '..', 'dashboard', 'dist');

    // n. Start dashboard -- either embedded (legacy) or as a separate process
    let responseServer: ResponseServer | null = null;

    if (options.embeddedServer) {
      // Legacy mode: run dashboard server in-process
      responseServer = new ResponseServer({
        stateStore,
        claudeService,
        orchestrator,
        logger,
        config,
        dashboardDir,
        activityProvider: activityStore,
      });
      await responseServer.start(config.port);
    } else {
      // Spawn dashboard as a detached child process
      const standaloneScript = join(__dirname, '..', 'server', 'standalone.js');
      const child = spawn(
        process.execPath,
        [standaloneScript, '--project-dir', projectDir, '--port', String(config.port)],
        {
          stdio: 'ignore',
          detached: true,
        },
      );
      child.unref();

      // Kill detached dashboard server on shutdown
      shutdown.register(async () => {
        if (child.pid && !child.killed) {
          try {
            process.kill(child.pid);
          } catch {
            // Already exited -- ignore
          }
        }
      });
    }

    // Tunnel lifecycle: start tunnel after dashboard server is ready
    const enableTunnel = options.tunnel !== false; // --no-tunnel sets this to false
    let tunnelManager: TunnelManager | null = null;

    if (enableTunnel) {
      tunnelManager = new TunnelManager({
        logger: {
          info: (msg: string) => logger.log('info', 'tunnel', msg),
          warn: (msg: string) => logger.log('warn', 'tunnel', msg),
          error: (msg: string) => logger.log('error', 'tunnel', msg),
        },
        onReconnect: (url: string) => {
          logger.log('info', 'tunnel', `Tunnel reconnected: ${url}`);
          void stateStore.setState({ tunnelUrl: url });
        },
        onDisconnect: () => {
          logger.log('warn', 'tunnel', 'Tunnel connection dropped, reconnecting...');
        },
      });

      // Wire tunnel URL getter for ConsoleAdapter
      tunnelUrlGetter = () => tunnelManager?.url || null;

      try {
        const url = await tunnelManager.start(config.port);
        await stateStore.setState({ tunnelUrl: url, tunnelError: undefined });
        if (!options.quiet) {
          console.log(`Dashboard available at: ${url}`);
          console.log(`Dashboard local:        http://localhost:${config.port}`);
        }
        // Register tunnel cleanup AFTER server cleanup (LIFO = runs before server shutdown)
        shutdown.register(async () => {
          logger.log('info', 'cli', 'Stopping tunnel');
          await tunnelManager!.stop();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.log('warn', 'tunnel', `Tunnel creation failed: ${message}`);
        if (!options.quiet) {
          console.log(`Dashboard available at: http://localhost:${config.port} (tunnel unavailable)`);
          console.log('  To enable remote access:');
          console.log('    devtunnel user login       (recommended)');
          console.log('    set GITHUB_TOKEN=<pat>     (any GitHub PAT)');
          console.log('    set DEVTUNNEL_TOKEN=<tok>  (Azure AD token)');
          console.log('  Use --no-tunnel to suppress this message.');
        }
        await stateStore.setState({ tunnelUrl: undefined, tunnelError: message });
      }
    } else {
      if (!options.quiet) {
        console.log(`Dashboard server: http://localhost:${config.port}`);
      }
      await stateStore.setState({ tunnelUrl: undefined, tunnelError: undefined });
    }

    // Remote session lifecycle: start claude remote-control after tunnel setup
    const enableRemote = options.remote !== false; // --no-remote sets this to false
    let remoteSessionManager: RemoteSessionManager | null = null;

    if (enableRemote) {
      remoteSessionManager = new RemoteSessionManager({
        logger: {
          info: (msg: string) => logger.log('info', 'remote-session', msg),
          warn: (msg: string) => logger.log('warn', 'remote-session', msg),
          error: (msg: string) => logger.log('error', 'remote-session', msg),
        },
        onUrlDetected: (url: string) => {
          void stateStore.setState({ remoteSessionUrl: url });
        },
      });

      try {
        const url = await remoteSessionManager.start(projectDir);
        await stateStore.setState({ remoteSessionUrl: url });
        if (!options.quiet) {
          console.log(`Claude remote session: ${url}`);
        }
        // Register cleanup in ShutdownManager
        shutdown.register(async () => {
          logger.log('info', 'cli', 'Stopping remote session');
          await remoteSessionManager!.stop();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.log('warn', 'remote-session', `Failed to start remote session: ${message}`);
        if (!options.quiet) {
          console.log('Claude remote session unavailable (continuing without it)');
          console.log('  Ensure claude CLI is installed and you are logged in.');
          console.log('  Use --no-remote to suppress this message.');
        }
        await stateStore.setState({ remoteSessionUrl: undefined });
      }
    } else {
      await stateStore.setState({ remoteSessionUrl: undefined });
    }

    shutdown.register(async () => {
      logger.log('info', 'cli', 'Flushing stream logger on shutdown');
      await streamLogger.flush();
    });
    shutdown.register(async () => {
      logger.log('info', 'cli', 'Flushing logger on shutdown');
      await logger.flush();
    });
    shutdown.register(async () => {
      logger.log('info', 'cli', 'Persisting state on shutdown');
      await stateStore.setState({ status: 'idle' });
    });
    // Register notification manager shutdown (runs before server due to LIFO)
    shutdown.register(async () => {
      logger.log('info', 'cli', 'Closing notification manager');
      await notificationManager.close();
    });
    // Register IPC cleanup
    shutdown.register(async () => {
      logger.log('info', 'cli', 'Stopping IPC components');
      heartbeatWriter.stop();
      answerPoller?.stop();
    });
    // Register server shutdown if embedded (runs FIRST due to LIFO -- registered last)
    if (responseServer) {
      shutdown.register(async () => {
        logger.log('info', 'cli', 'Shutting down embedded response server');
        await responseServer!.close();
      });
    }
    shutdown.install(() => {
      logger.log('warn', 'cli', 'Shutdown requested, finishing current step...');
      orchestrator.requestShutdown();
    });

    // o. Start IPC components
    heartbeatWriter.onShutdown = () => {
      logger.log('warn', 'cli', 'Shutdown marker detected — requesting graceful shutdown');
      orchestrator.requestShutdown();
    };
    await heartbeatWriter.start();
    await answerPoller?.start();

    // p. Run orchestrator
    try {
      const prdPath = options.prd ? resolve(options.prd) : '';
      await orchestrator.run(prdPath, phaseRange);

      if (!options.quiet) {
        console.log('\nAutopilot run complete.');
      }

      // Ensure the build-complete event is flushed to disk for SSE clients
      if (buildCompleteWritePromise) {
        await buildCompleteWritePromise;
      }

      // Send browser push notification via the standalone dashboard's HTTP API.
      // This is synchronous (we await the response) so the notification is
      // guaranteed to be delivered before the CLI exits and kills the dashboard.
      if (!options.embeddedServer) {
        try {
          const pushUrl = `http://localhost:${config.port}/api/push/send`;
          const res = await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'GSD Autopilot: Build complete!',
              body: 'All phases completed successfully!',
              tag: 'gsd-build-complete',
              url: '/',
              requireInteraction: false,
              silent: true,
            }),
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) {
            const text = await res.text();
            logger.log('warn', 'cli', `Push notification send failed: ${res.status} ${text}`);
          }
        } catch {
          // Standalone dashboard may not be running or push not configured -- non-fatal
        }
      }

      heartbeatWriter.stop();
      answerPoller?.stop();
      await notificationManager.close();
      if (responseServer) await responseServer.close();
      await streamLogger.flush();
      await logger.flush();
      process.exit(0);
    } catch (err) {
      streamRenderer.stopSpinner();
      heartbeatWriter.stop();
      answerPoller?.stop();
      await notificationManager.close();
      if (responseServer) await responseServer.close();
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', 'cli', 'Autopilot failed', { error: message });
      if (!options.quiet) {
        console.error(`\nAutopilot failed: ${message}`);
      }
      process.exit(1);
    }
  });

// q. Top-level error handling
try {
  await program.parseAsync(process.argv);
} catch (err) {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
}
