// Launcher for gsd-autopilot slash command
// Main entry point that routes subcommands and manages background autopilot process
// Pure JavaScript (not TypeScript) - runs directly from ~/.claude/skills/

const CLI_PATH = '__CLI_PATH__';
const DEVTUNNEL_PATH = '__DEVTUNNEL_PATH__';

import { spawn, execSync, execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve as pathResolve } from 'node:path';
import { createInterface } from 'node:readline';
import { request } from 'node:http';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { assignPort } from './port-manager.js';
import { writePid, readPid, isProcessRunning, stopProcess, cleanupPid } from './pid-manager.js';

const execFileAsync = promisify(execFile);

/**
 * Main entry point
 * Usage: node launcher.js <branch> [subcommand|args...]
 */
async function main() {
  const branch = process.argv[2];
  const projectDir = process.cwd();

  if (!branch) {
    console.error('Error: Branch name required');
    console.error('Usage: node launcher.js <branch> [subcommand|args...]');
    process.exit(1);
  }

  const subcommandOrArg = process.argv[3];

  // Route to appropriate handler
  if (subcommandOrArg === 'status') {
    await handleStatus(branch, projectDir);
  } else if (subcommandOrArg === 'stop') {
    await handleStop(branch, projectDir);
  } else if (subcommandOrArg === 'show') {
    await handleShow(branch, projectDir);
  } else if (subcommandOrArg === 'login') {
    const provider = process.argv[4]; // 'github' or undefined (for Microsoft default)
    await handleLogin(provider);
  } else {
    // Everything else goes to launch (including no args, --prd, --resume, etc.)
    const remainingArgs = process.argv.slice(3);
    await handleLaunch(branch, projectDir, remainingArgs);
  }
}

/**
 * Handle launch subcommand (or default action)
 * Spawns autopilot as detached background process
 */
async function handleLaunch(branch, projectDir, args) {
  // 1. Check if already running
  const existingPid = await readPid(branch, projectDir);
  if (existingPid && isProcessRunning(existingPid)) {
    // Read port from state file to show dashboard URL
    const stateFilePath = join(projectDir, '.planning', 'autopilot', 'state.json');
    let port = 3847; // default
    try {
      const stateContent = await readFile(stateFilePath, 'utf-8');
      const state = JSON.parse(stateContent);
      port = state.branches?.[branch]?.port ?? 3847;
    } catch {
      // State file doesn't exist or invalid - use default port
    }

    console.log(`Autopilot already running for branch '${branch}' on port ${port}`);
    console.log(`Dashboard: http://localhost:${port}`);
    console.log(`PID: ${existingPid}`);
    return;
  }

  // 2. Detect resume vs fresh: check for existing ROADMAP.md
  const roadmapPath = join(projectDir, '.planning', 'ROADMAP.md');
  let hasRoadmap = false;
  try {
    await readFile(roadmapPath, 'utf-8');
    hasRoadmap = true;
  } catch {
    // ROADMAP.md doesn't exist
  }

  // If no ROADMAP and no --prd in args, prompt for PRD path
  const hasPrdArg = args.some(arg => arg === '--prd' || arg.startsWith('--prd='));
  if (!hasRoadmap && !hasPrdArg) {
    console.log('No existing planning found (.planning/ROADMAP.md)');
    const prdPath = await promptForPrdPath();
    args.push('--prd', prdPath);
  }

  // 3. Assign port
  const port = await assignPort(branch, projectDir);

  // 3b. Kill any stale process on that port (e.g. orphaned dashboard from a previous run)
  killProcessOnPort(port);

  // 4. Build spawn args
  const spawnArgs = [CLI_PATH, '--port', String(port), ...args];

  // 5. Spawn in a visible cmd window using `start` (Windows built-in)
  // Write a temporary .cmd file to avoid quoting hell with nested cmd interpreters
  console.log(`Starting autopilot for branch '${branch}' on port ${port}...`);
  const cmdTitle = `GSD Autopilot [${branch}] :${port}`;
  const batContent = `@title ${cmdTitle}\n@"${process.execPath}" ${spawnArgs.map(a => `"${a}"`).join(' ')}\n@pause\n`;
  const batPath = join(projectDir, '.planning', 'autopilot', 'run.cmd');
  await writeFile(batPath, batContent, 'utf-8');
  const child = spawn('start', ['""', batPath], {
    shell: true,
    stdio: 'ignore',
    cwd: projectDir,
    env: process.env,
  });
  child.unref();

  // 6. Write PID (the `start` wrapper exits immediately; read actual PID from
  //    the heartbeat file once the autopilot process writes it)
  // Write the shell PID as a fallback — the health check gives the process time to start
  await writePid(branch, child.pid, projectDir);

  // 7. Health check
  const healthCheckSuccess = await performHealthCheck(port);

  // 8. Read real PID from heartbeat (the autopilot process writes process.pid there)
  //    and overwrite the .pid file so subsequent status/stop calls use the correct PID
  const realPid = await readHeartbeatPid(projectDir);
  if (realPid) {
    await writePid(branch, realPid, projectDir);
  }

  const displayPid = realPid ?? child.pid;
  if (healthCheckSuccess) {
    console.log(`Autopilot started successfully (PID ${displayPid})`);
  } else {
    console.log(`Autopilot process started (PID ${displayPid}) but dashboard may take a moment to become available.`);
  }

  console.log(`Dashboard: http://localhost:${port}`);

  // Open dashboard in default browser so the service worker registers for push notifications
  spawn('start', ['', `http://localhost:${port}`], { shell: true, stdio: 'ignore' }).unref();
}

/**
 * Handle status subcommand
 * Reports running state, phase progress, and dashboard URL
 */
async function handleStatus(branch, projectDir) {
  // 1. Check if process is running — prefer heartbeat PID (real), fall back to .pid file
  const realPid = await readHeartbeatPid(projectDir);
  const fallbackPid = await readPid(branch, projectDir);
  const pid = realPid ?? fallbackPid;
  if (!pid || !isProcessRunning(pid)) {
    console.log(`No autopilot running for branch '${branch}'`);
    return;
  }

  // 2. Read state file for progress
  const stateFilePath = join(projectDir, '.planning', 'autopilot', 'state.json');
  let status = 'unknown';
  let currentPhase = 0;
  let totalPhases = 0;
  let progress = 0;
  let port = 3847;

  try {
    const stateContent = await readFile(stateFilePath, 'utf-8');
    const state = JSON.parse(stateContent);

    status = state.status ?? 'unknown';
    currentPhase = state.currentPhase ?? 0;
    totalPhases = state.phases?.length ?? 0;

    // Compute progress: count completed phases
    const completedPhases = state.phases?.filter(p => p.status === 'completed').length ?? 0;
    progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

    // Get port from branches
    port = state.branches?.[branch]?.port ?? 3847;
  } catch (err) {
    // State file doesn't exist or invalid
    console.log(`Autopilot Status (${branch})`);
    console.log(`Status: running (no state file yet)`);
    console.log(`Dashboard: http://localhost:${port}`);
    console.log(`PID: ${pid}`);
    return;
  }

  // 4. Print formatted status
  console.log(`Autopilot Status (${branch})`);
  console.log(`Status: ${status}`);
  console.log(`Phase:  ${currentPhase}/${totalPhases}`);
  console.log(`Progress: ${progress}%`);
  console.log(`Dashboard: http://localhost:${port}`);
  console.log(`PID: ${pid}`);
}

/**
 * Handle show subcommand
 * Starts standalone dashboard (if not already running) and opens it in the browser.
 * Does NOT launch the autopilot orchestrator — view-only.
 */
async function handleShow(branch, projectDir) {
  const port = await assignPort(branch, projectDir);

  // Check if dashboard is already responding
  const alreadyUp = await checkHealth(port);
  if (!alreadyUp) {
    // Start standalone dashboard server (no orchestrator)
    console.log(`Starting dashboard server on port ${port}...`);
    killProcessOnPort(port);

    const standaloneScript = join(dirname(CLI_PATH), '..', 'server', 'standalone.js');
    const child = spawn(process.execPath, [standaloneScript, '--project-dir', projectDir, '--port', String(port)], {
      stdio: 'ignore',
      detached: true,
      cwd: projectDir,
      env: { ...process.env, NO_TUNNEL: 'true' },
    });
    child.unref();

    // Wait for health check
    const healthy = await performHealthCheck(port);
    if (!healthy) {
      console.log('Dashboard server may take a moment to start.');
    }
  } else {
    console.log('Dashboard already running.');
  }

  console.log(`Dashboard: http://localhost:${port}`);
  // Open in browser
  spawn('start', ['', `http://localhost:${port}`], { shell: true, stdio: 'ignore' }).unref();
}

/**
 * Handle stop subcommand
 *
 * Uses cooperative shutdown signals instead of taskkill (which gets "Access denied"
 * for processes spawned in a different console session via `start`):
 *
 * 1. Writes a `.planning/autopilot/shutdown` marker file — the autopilot's
 *    HeartbeatWriter detects this within 5 seconds and triggers graceful shutdown.
 * 2. Sends POST /api/shutdown to the dashboard HTTP server — the dashboard
 *    exits immediately.
 * 3. Waits for processes to exit, then falls back to taskkill if needed.
 */
async function handleStop(branch, projectDir) {
  // 1. Read the assigned port from state (needed for dashboard shutdown)
  const stateFilePath = join(projectDir, '.planning', 'autopilot', 'state.json');
  let port = 3847;
  try {
    const stateContent = await readFile(stateFilePath, 'utf-8');
    const state = JSON.parse(stateContent);
    port = state.branches?.[branch]?.port ?? 3847;
  } catch {
    // State file doesn't exist or invalid — use default port
  }

  // 2. Get real PID from heartbeat for status reporting
  const realPid = await readHeartbeatPid(projectDir);
  const fallbackPid = await readPid(branch, projectDir);
  const pid = realPid ?? fallbackPid;

  console.log(`Stopping autopilot for branch '${branch}'...`);

  // 3. Write shutdown marker file — the autopilot HeartbeatWriter checks for this
  //    every 5 seconds and triggers graceful orchestrator shutdown
  const shutdownMarkerPath = join(projectDir, '.planning', 'autopilot', 'shutdown');
  try {
    await writeFile(shutdownMarkerPath, new Date().toISOString(), 'utf-8');
    console.log('  Shutdown signal sent to autopilot process.');
  } catch {
    // .planning/ may not exist — that's fine
  }

  // 4. Send HTTP POST /api/shutdown to the dashboard server
  const dashboardStopped = await sendShutdownRequest(port);
  if (dashboardStopped) {
    console.log('  Dashboard server stopped.');
  }

  // 5. Wait briefly for cooperative shutdown, then force-kill if needed
  if (pid && isProcessRunning(pid)) {
    // Wait up to 8 seconds for the autopilot to self-terminate (heartbeat interval is 5s)
    let exited = false;
    for (let i = 0; i < 16; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!isProcessRunning(pid)) {
        exited = true;
        break;
      }
    }

    if (!exited) {
      // Fall back to force-kill
      console.log('  Autopilot did not exit in time, force-killing...');
      forceKillPid(pid);
    }
  }

  // 6. Kill any remaining process on the dashboard port (catches orphans)
  killProcessOnPort(port);

  // 7. Clean up PID file
  await cleanupPid(branch, projectDir);

  console.log('Autopilot stopped.');
}

/**
 * Resolve the path to the bundled devtunnel executable.
 * The devtunnel binary lives at the autopilot package root.
 * @returns {string} Path to devtunnel.exe (or devtunnel on non-Windows)
 */
function resolveDevTunnelExe() {
  // 1. Use injected path from postinstall (production)
  if (DEVTUNNEL_PATH !== '__DEVTUNNEL_' + 'PATH__' && existsSync(DEVTUNNEL_PATH)) {
    return DEVTUNNEL_PATH;
  }
  // 2. Fallback: resolve relative to launcher location
  const __filename = fileURLToPath(import.meta.url);
  const packageRoot = pathResolve(dirname(__filename), '..', '..');
  const ext = process.platform === 'win32' ? '.exe' : '';
  const bundled = pathResolve(packageRoot, `devtunnel${ext}`);
  if (existsSync(bundled)) return bundled;
  // Fall back: check project cwd autopilot/ directory (dev/repo layout)
  const cwdBundled = pathResolve(process.cwd(), 'autopilot', `devtunnel${ext}`);
  if (existsSync(cwdBundled)) return cwdBundled;
  // Fall back: scan process.env.PATH
  const sep = process.platform === 'win32' ? ';' : ':';
  const dirs = (process.env.PATH || '').split(sep);
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = pathResolve(dir, `devtunnel${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return bundled; // Return original path so error message shows expected location
}

/**
 * Check authentication status via devtunnel user show.
 * Parses the "Logged in as X using Y." line for account info.
 * @param {string} exe - Path to devtunnel executable
 * @returns {Promise<{loggedIn: boolean, account?: string, provider?: string}>}
 */
async function checkAuthStatus(exe) {
  try {
    const { stdout } = await execFileAsync(exe, ['user', 'show'], {
      timeout: 10_000,
      windowsHide: true,
    });
    const match = stdout.match(/Logged in as (.+?) using (.+?)\./);
    if (match) {
      return { loggedIn: true, account: match[1], provider: match[2] };
    }
    return { loggedIn: false };
  } catch {
    return { loggedIn: false };
  }
}

/**
 * Prompt user to confirm re-authentication if already logged in.
 * Uses readline for simple yes/no prompt.
 * @param {string} account - Current logged-in account name
 * @returns {Promise<boolean>} True if user wants to re-authenticate
 */
function confirmReLogin(account) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`Already logged in as: ${account}`);
    rl.question('Re-authenticate? (y/N): ', (answer) => {
      rl.close();
      const choice = answer.trim().toLowerCase();
      resolve(choice === 'y' || choice === 'yes');
    });
  });
}

/**
 * Wrap a promise with a timeout.
 * Uses timer.unref() to avoid blocking Node.js exit.
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} timeoutMessage - Error message if timeout occurs
 * @returns {Promise}
 */
function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
      timer.unref();
    }),
  ]);
}

/**
 * Spawn devtunnel user login in interactive mode.
 * Uses stdio: 'inherit' for interactive CLI and windowsHide: false for Windows compatibility.
 * @param {string} exe - Path to devtunnel executable
 * @param {string|undefined} provider - 'github' or undefined for Microsoft default
 * @returns {Promise<void>}
 */
function spawnDevTunnelLogin(exe, provider) {
  return new Promise((resolve, reject) => {
    const args = ['user', 'login'];
    if (provider === 'github') {
      args.push('-g');
    }

    const proc = spawn(exe, args, {
      stdio: 'inherit',
      windowsHide: false,
    });

    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Login failed (exit code ${code})`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn devtunnel: ${err.message}`));
    });
  });
}

/**
 * Handle login subcommand.
 * Runs devtunnel browser-based authentication flow from within Claude Code.
 * Flow:
 * 1. Resolve devtunnel.exe path and verify it exists
 * 2. Pre-check auth status via `devtunnel user show`
 * 3. If already logged in, prompt for re-authentication confirmation
 * 4. Print waiting message and spawn login with 5-minute timeout
 * 5. On success, fetch account info and display confirmation
 * 6. On failure, show error and suggest retry
 * @param {string|undefined} provider - 'github' or undefined for Microsoft default
 */
async function handleLogin(provider) {
  const exe = resolveDevTunnelExe();

  // Check if devtunnel.exe exists
  if (!existsSync(exe)) {
    console.error('Error: devtunnel executable not found');
    console.error(`Expected location: ${exe}`);
    console.error('Reinstall GSD to restore devtunnel: npm install -g get-shit-done-cc');
    process.exit(1);
  }

  // Validate provider argument
  if (provider && provider !== 'github') {
    console.error(`Unknown auth provider: ${provider}`);
    console.error('Usage: /gsd:autopilot login [github]');
    console.error('  (omit provider for Microsoft account, or specify "github")');
    process.exit(1);
  }

  // Pre-check: is user already logged in?
  const status = await checkAuthStatus(exe);
  if (status.loggedIn) {
    const shouldReLogin = await confirmReLogin(status.account);
    if (!shouldReLogin) {
      console.log('Login cancelled.');
      return;
    }
  }

  // Run login with 5-minute timeout
  console.log('Waiting for browser authentication... (Press Ctrl+C to cancel)');
  try {
    await withTimeout(
      spawnDevTunnelLogin(exe, provider),
      5 * 60 * 1000,
      'Login timeout: authentication not completed within 5 minutes'
    );

    // Get account info after successful login
    const newStatus = await checkAuthStatus(exe);
    if (newStatus.loggedIn) {
      console.log(`\nLogged in as: ${newStatus.account}`);
      console.log('Dev tunnels are ready.');
    } else {
      console.log('\nLogin completed.');
    }
  } catch (err) {
    console.error(`\nLogin failed: ${err.message}`);
    console.error('Please try running /gsd:autopilot login again.');
    process.exit(1);
  }
}

/**
 * Prompt user for PRD path using readline
 * @returns {Promise<string>} Path entered by user
 */
function promptForPrdPath() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter path to PRD document: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Perform health check on dashboard server
 * Retries 3 times with 1-second delays
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if health check succeeds
 */
async function performHealthCheck(port) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Wait 1 second before each attempt
    await new Promise(resolve => setTimeout(resolve, 1000));

    const success = await checkHealth(port);
    if (success) {
      return true;
    }
  }
  return false;
}

/**
 * Single health check attempt
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if responds successfully
 */
function checkHealth(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: '/api/health',
      method: 'GET',
      timeout: 2000,
    };

    const req = request(options, (res) => {
      // Any response (even error codes) means server is up
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on('error', () => {
      // Connection refused or timeout - server not ready yet
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Force-kill a process by PID. On Windows, tries taskkill then falls back to
 * PowerShell .Kill() (which works for cross-session processes where taskkill
 * returns "Access denied"). On other platforms, sends SIGKILL.
 * @param {number} pid - Process ID to kill
 */
function forceKillPid(pid) {
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
    } catch {
      try {
        execSync(`powershell -NoProfile -Command "(Get-Process -Id ${pid}).Kill()"`, { stdio: 'ignore' });
      } catch {
        // Already gone or truly inaccessible
      }
    }
  } else {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

/**
 * Send POST /api/shutdown to the dashboard server.
 * Returns true if the request succeeded (dashboard will exit), false otherwise.
 * @param {number} port - Dashboard port
 * @returns {Promise<boolean>}
 */
function sendShutdownRequest(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: '/api/shutdown',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 3000,
    };

    const req = request(options, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end('{}');
  });
}

/**
 * Read the real autopilot PID from the heartbeat file.
 * The autopilot process writes its own process.pid to this file every 5 seconds.
 * Returns null if the file doesn't exist or can't be parsed.
 * @param {string} projectDir - Project root directory
 * @returns {Promise<number|null>}
 */
async function readHeartbeatPid(projectDir) {
  try {
    const heartbeatPath = join(projectDir, '.planning', 'autopilot', 'heartbeat.json');
    const content = await readFile(heartbeatPath, 'utf-8');
    const heartbeat = JSON.parse(content);
    const pid = heartbeat?.pid;
    return typeof pid === 'number' && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Kill any process listening on the given port.
 * Uses PowerShell .Kill() as fallback since taskkill gets "Access denied" for
 * processes spawned in a different console session (via `start`).
 * Silently does nothing if the port is free or the kill fails.
 */
function killProcessOnPort(port) {
  if (process.platform !== 'win32') return;
  try {
    const output = execSync(`netstat -ano | findstr "LISTENING" | findstr ":${port} "`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const pids = new Set();
    for (const line of output.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
        console.log(`  Killed process ${pid} on port ${port}`);
      } catch {
        // taskkill may fail with "Access denied" for cross-session processes.
        // Fall back to PowerShell .Kill() which bypasses the session restriction.
        try {
          execSync(`powershell -NoProfile -Command "(Get-Process -Id ${pid}).Kill()"`, { stdio: 'ignore' });
          console.log(`  Killed process ${pid} on port ${port}`);
        } catch {
          // Already gone or truly inaccessible — ignore
        }
      }
    }
  } catch {
    // Port is free — nothing to kill
  }
}

// Run main
main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
