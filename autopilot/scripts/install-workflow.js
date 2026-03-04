#!/usr/bin/env node
// Postinstall script that copies gsd-autopilot workflow files to ~/.claude/commands/gsd/
// This runs automatically during npm install to make /gsd:autopilot available in Claude Code

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function installWorkflow() {
  try {
    // 1. Determine source directory (from scripts/ to workflows/gsd-autopilot/)
    const sourceDir = join(__dirname, '..', 'workflows', 'gsd-autopilot');

    // 2. Determine destination directories
    const commandsDir = join(homedir(), '.claude', 'commands', 'gsd');
    const workflowSubdir = join(commandsDir, 'gsd-autopilot');

    // 3. Create destination directories
    await mkdir(commandsDir, { recursive: true });
    await mkdir(workflowSubdir, { recursive: true });

    // 4. Copy JS files (launcher, port-manager, pid-manager) to subdirectory
    const jsFiles = ['launcher.js', 'port-manager.js', 'pid-manager.js'];
    for (const file of jsFiles) {
      const sourcePath = join(sourceDir, file);
      const destPath = join(workflowSubdir, file);
      await copyFile(sourcePath, destPath);
      console.log(`  Copied ${file} to ${workflowSubdir}/`);
    }

    // 4b. Resolve and inject CLI_PATH into launcher.js
    // Use forward slashes to avoid backslash escape issues in JS string literals (Node handles / on Windows)
    const cliPath = join(__dirname, '..', 'dist', 'cli', 'index.js').replace(/\\/g, '/');
    const launcherDest = join(workflowSubdir, 'launcher.js');
    let launcherContent = await readFile(launcherDest, 'utf-8');
    launcherContent = launcherContent.replace(/__CLI_PATH__/g, cliPath);
    console.log(`  Injected CLI_PATH into launcher.js: ${cliPath}`);

    // 4c. Resolve and inject DEVTUNNEL_PATH into launcher.js
    const ext = process.platform === 'win32' ? '.exe' : '';
    const devtunnelPath = join(__dirname, '..', `devtunnel${ext}`).replace(/\\/g, '/');
    launcherContent = launcherContent.replace(/__DEVTUNNEL_PATH__/g, devtunnelPath);
    console.log(`  Injected DEVTUNNEL_PATH into launcher.js: ${devtunnelPath}`);

    await writeFile(launcherDest, launcherContent, 'utf-8');

    // 5. Read SKILL.md template
    const skillTemplatePath = join(sourceDir, 'SKILL.md');
    const skillTemplate = await readFile(skillTemplatePath, 'utf-8');

    // 6. Replace __LAUNCHER_PATH__ placeholder with absolute path to installed launcher.js
    const installedLauncherPath = join(workflowSubdir, 'launcher.js');
    const skillContent = skillTemplate.replace(/__LAUNCHER_PATH__/g, installedLauncherPath);

    // 7. Write as autopilot.md to commands/gsd/ directory
    const skillDestPath = join(commandsDir, 'autopilot.md');
    await writeFile(skillDestPath, skillContent, 'utf-8');
    console.log(`  Installed command to ${skillDestPath}`);

    // Success
    console.log('');
    console.log('✓ Installed /gsd:autopilot command to ~/.claude/commands/gsd/');
    console.log('  Restart Claude Code session to pick up the new command.');

  } catch (err) {
    // Postinstall failures should NOT break npm install
    console.warn('Warning: Failed to install /gsd:autopilot command');
    console.warn(`  Error: ${err.message}`);
    console.warn('  You can manually run: npm run postinstall');
    process.exit(0); // Exit 0 to avoid breaking npm install
  }
}

// Run installation
installWorkflow();
