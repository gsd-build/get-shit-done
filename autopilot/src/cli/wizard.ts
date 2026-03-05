// Interactive setup wizard for first-run experience
// Uses @inquirer/prompts for npm init-like flow with sensible defaults

import { input, select, confirm } from '@inquirer/prompts';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

export interface WizardResult {
  prdPath: string;
  notify: 'console' | 'system' | 'teams' | 'slack';
  webhookUrl?: string;
  model: 'quality' | 'balanced' | 'budget';
  depth: 'quick' | 'standard' | 'comprehensive';
  savedConfig: boolean;
}

/**
 * Run interactive setup wizard for first-time users.
 * Collects PRD path, notification preferences, model profile, and planning depth.
 * Offers to save settings to .gsd-autopilot.json.
 */
export async function runSetupWizard(): Promise<WizardResult> {
  try {
    // Step 1: Welcome banner
    console.log('');
    console.log('  GSD Autopilot by NexeraDigital');
    console.log('  Autonomous workflow orchestrator');
    console.log('');
    console.log("Let's set up your autonomous build.\n");

    // Step 2: PRD path with file existence validation
    const prdPath = await input({
      message: 'Path to your PRD or idea document:',
      default: './idea.md',
      validate: async (value: string): Promise<string | true> => {
        try {
          const resolvedPath = resolve(value);
          await access(resolvedPath);
          return true;
        } catch {
          return `File not found: ${value}. Enter a valid file path.`;
        }
      },
    });

    // Step 3: Notification channel
    const notify = await select({
      message: 'How should we notify you when questions arise?',
      choices: [
        { name: 'Console output (default)', value: 'console' },
        { name: 'System notifications (OS toasts)', value: 'system' },
        { name: 'Microsoft Teams webhook', value: 'teams' },
        { name: 'Slack webhook', value: 'slack' },
      ],
      default: 'console',
    });

    // Step 4: Webhook URL (conditional on notify choice)
    let webhookUrl: string | undefined;
    if (notify === 'teams' || notify === 'slack') {
      webhookUrl = await input({
        message: 'Webhook URL:',
        validate: (value: string): string | true => {
          if (!value.startsWith('https://')) {
            return 'URL must start with https://';
          }
          return true;
        },
      });
    }

    // Step 5: Model profile
    const model = await select({
      message: 'Model profile:',
      choices: [
        { name: 'Balanced (recommended)', value: 'balanced' },
        { name: 'Quality (slower, more thorough)', value: 'quality' },
        { name: 'Budget (faster, less thorough)', value: 'budget' },
      ],
      default: 'balanced',
    });

    // Step 6: Planning depth
    const depth = await select({
      message: 'Planning depth:',
      choices: [
        { name: 'Standard (recommended)', value: 'standard' },
        { name: 'Quick (fewer plans, faster)', value: 'quick' },
        { name: 'Comprehensive (more plans, thorough)', value: 'comprehensive' },
      ],
      default: 'standard',
    });

    // Step 7: Save config
    const shouldSave = await confirm({
      message: 'Save these settings to .gsd-autopilot.json for next time?',
      default: true,
    });

    let savedConfig = false;
    if (shouldSave) {
      const config: Record<string, unknown> = {
        notify,
        model,
        depth,
      };

      // Only include webhookUrl if provided
      if (webhookUrl) {
        config.webhookUrl = webhookUrl;
      }

      const configPath = resolve(process.cwd(), '.gsd-autopilot.json');
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      savedConfig = true;
    }

    // Return wizard results with resolved absolute prdPath
    return {
      prdPath: resolve(prdPath),
      notify: notify as 'console' | 'system' | 'teams' | 'slack',
      webhookUrl,
      model: model as 'quality' | 'balanced' | 'budget',
      depth: depth as 'quick' | 'standard' | 'comprehensive',
      savedConfig,
    };
  } catch (err) {
    // Handle Ctrl+C gracefully (ExitPromptError from @inquirer/prompts)
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ExitPromptError') {
      console.log('\nSetup cancelled.');
      process.exit(0);
    }
    throw err;
  }
}
