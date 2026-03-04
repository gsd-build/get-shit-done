#!/usr/bin/env node
// Standalone dashboard server -- runs in its own process, separate from the autopilot.
// Reads state and events from the filesystem; writes answers as files.

import { Command } from 'commander';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { FileStateReader } from '../ipc/file-state-reader.js';
import { EventTailer } from '../ipc/event-tailer.js';
import { AnswerWriter } from '../ipc/answer-writer.js';
import { FileQuestionProvider } from '../ipc/file-question-provider.js';
import { ResponseServer } from './index.js';
import { ActivityStore } from '../activity/index.js';
import { loadVAPIDKeys } from './push/vapid.js';
import { SubscriptionStore } from './push/subscription-store.js';
import { PushNotificationManager } from './push/manager.js';
import { parseMilestoneData } from '../milestone/parser.js';
import { TunnelManager } from './tunnel/index.js';
import { derivePort } from '../config/derive-port.js';

const program = new Command();

program
  .name('gsd-dashboard')
  .description('Standalone dashboard server for GSD autopilot')
  .version('0.2.0')
  .requiredOption('--project-dir <path>', 'Path to the project directory')
  .option('--port <number>', 'Dashboard server port (auto-derived from git repo if omitted)')
  .action(async (options: { projectDir: string; port?: string }) => {
    const projectDir = resolve(options.projectDir);
    const port = options.port
      ? parseInt(options.port, 10)
      : await derivePort(projectDir);

    // Create file-based IPC components
    const stateReader = new FileStateReader(projectDir);
    const eventTailer = new EventTailer(projectDir);
    const answerWriter = new AnswerWriter(projectDir);
    const questionProvider = new FileQuestionProvider(stateReader, answerWriter);

    // Create and restore ActivityStore
    const activityStore = new ActivityStore(projectDir);
    await activityStore.restore();

    // Start IPC readers
    stateReader.start();
    await eventTailer.start();

    // Initialize push notification infrastructure
    const planningDir = join(projectDir, '.planning');
    const autopilotDir = join(planningDir, 'autopilot');
    const subscriptionStore = new SubscriptionStore();
    const vapidKeys = await loadVAPIDKeys(autopilotDir);
    const pushManager = new PushNotificationManager(vapidKeys, subscriptionStore);

    // Create milestone provider
    const milestoneProvider = {
      getMilestones() {
        return parseMilestoneData(planningDir);
      },
    };

    // Resolve dashboard dist path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const dashboardDir = join(__dirname, '..', '..', 'dashboard', 'dist');

    // Create the server with push manager wired to SSE
    const server = new ResponseServer({
      stateProvider: stateReader,
      questionProvider,
      livenessProvider: stateReader,
      sseDeps: {
        mode: 'file-tail' as const,
        eventTailer,
        pushManager,
      },
      dashboardDir: existsSync(dashboardDir) ? dashboardDir : undefined,
      activityProvider: activityStore,
      milestoneProvider,
      pushManager,
      subscriptionStore,
      vapidPublicKey: vapidKeys.publicKey,
    });

    await server.start(port);

    // Helper: merge fields into the state.json file so the dashboard picks them up
    const statePath = join(projectDir, '.planning', 'autopilot', 'state.json');
    function patchStateFile(patch: Record<string, unknown>) {
      try {
        // Only patch if state file already exists — don't create directories
        if (!existsSync(statePath)) return;
        const state = JSON.parse(readFileSync(statePath, 'utf-8'));
        Object.assign(state, patch);
        writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
      } catch { /* best-effort */ }
    }

    // Tunnel lifecycle: start tunnel after server is ready
    const enableTunnel = process.env['NO_TUNNEL'] !== 'true';
    let tunnelManager: TunnelManager | null = null;

    if (enableTunnel) {
      tunnelManager = new TunnelManager({
        logger: {
          info: console.log,
          warn: console.warn,
          error: console.error,
        },
        onReconnect: (url: string) => console.log('Tunnel reconnected:', url),
      });

      try {
        const url = await tunnelManager.start(port);
        patchStateFile({ tunnelUrl: url, tunnelError: undefined });
        console.log(`Dashboard available at: ${url}`);
        console.log(`Dashboard local:        http://localhost:${port}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        patchStateFile({ tunnelUrl: undefined, tunnelError: message });
        console.warn('Tunnel creation failed:', message);
        console.log(`Dashboard available at: http://localhost:${port}`);
      }
    } else {
      console.log(`Dashboard server: http://localhost:${port}`);
    }

    console.log(`Push notifications: enabled`);
    console.log(`Watching project: ${projectDir}`);

    // Graceful shutdown with tunnel cleanup
    const shutdown = async () => {
      console.log('\nShutting down dashboard...');
      if (tunnelManager) {
        await tunnelManager.stop();
      }
      stateReader.stop();
      eventTailer.stop();
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());
  });

try {
  await program.parseAsync(process.argv);
} catch (err) {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
}
