/**
 * Phase 4 installer migration integration tests.
 *
 * These exercise the public install() entry point so the migration runner is
 * pinned at the install/update seam, not just as a standalone library.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const installModule = require('../bin/install.js');
const pkg = require('../package.json');
const { install } = installModule;
const { createTempDir, cleanup } = require('./helpers.cjs');

const installScript = path.join(__dirname, '..', 'bin', 'install.js');
const SUPPORTED_RUNTIMES = installModule.allRuntimes;
const RUNTIME_INSTALL_CONTRACTS = {
  claude: { surface: 'flat-skills', settings: true, packageJson: true },
  antigravity: { surface: 'flat-skills', settings: true, packageJson: true },
  augment: { surface: 'flat-skills', settings: true, packageJson: true },
  cline: { surface: 'clinerules', settings: false, packageJson: false },
  codebuddy: { surface: 'flat-skills', settings: true, packageJson: true },
  codex: { surface: 'flat-skills', settings: false, packageJson: false, codexConfig: true },
  copilot: { surface: 'flat-skills', settings: false, packageJson: false, copilotInstructions: true },
  cursor: { surface: 'flat-skills', settings: false, packageJson: false },
  gemini: { surface: 'commands-gsd', settings: true, packageJson: true },
  hermes: { surface: 'hermes-skills', settings: true, packageJson: true },
  kilo: { surface: 'flat-command', settings: false, packageJson: true },
  opencode: { surface: 'flat-command', settings: true, packageJson: true },
  qwen: { surface: 'flat-skills', settings: true, packageJson: true },
  trae: { surface: 'flat-skills', settings: false, packageJson: false },
  windsurf: { surface: 'flat-skills', settings: false, packageJson: false },
};

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function writeFile(root, relPath, content) {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function writeManifest(root, files) {
  fs.writeFileSync(
    path.join(root, 'gsd-file-manifest.json'),
    JSON.stringify({
      version: '1.49.0',
      timestamp: '2026-05-10T00:00:00.000Z',
      mode: 'full',
      files,
    }, null, 2),
    'utf8'
  );
}

function withEnv(key, value, fn) {
  const previous = process.env[key];
  process.env[key] = value;
  try {
    return fn();
  } finally {
    if (previous == null) delete process.env[key];
    else process.env[key] = previous;
  }
}

function captureConsole(fn) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  console.warn = (...args) => { lines.push(args.join(' ')); };
  try {
    return { value: fn(), output: lines.join('\n') };
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

function withWriteFailure(matchPath, fn) {
  const originalWriteFileSync = fs.writeFileSync;
  fs.writeFileSync = (filePath, ...args) => {
    if (path.resolve(String(filePath)) === path.resolve(matchPath)) {
      throw new Error(`injected write failure for ${path.basename(matchPath)}`);
    }
    return originalWriteFileSync.call(fs, filePath, ...args);
  };
  try {
    return fn();
  } finally {
    fs.writeFileSync = originalWriteFileSync;
  }
}

function withSdkDistPresent(fn) {
  const sdkCliPath = path.join(__dirname, '..', 'sdk', 'dist', 'cli.js');
  const originalExistsSync = fs.existsSync;
  const originalStatSync = fs.statSync;
  const originalChmodSync = fs.chmodSync;
  fs.existsSync = (filePath) => {
    if (path.resolve(String(filePath)) === path.resolve(sdkCliPath)) return true;
    return originalExistsSync.call(fs, filePath);
  };
  fs.statSync = (filePath, ...args) => {
    if (path.resolve(String(filePath)) === path.resolve(sdkCliPath)) {
      return { mode: 0o755 };
    }
    return originalStatSync.call(fs, filePath, ...args);
  };
  fs.chmodSync = (filePath, ...args) => {
    if (path.resolve(String(filePath)) === path.resolve(sdkCliPath)) return;
    return originalChmodSync.call(fs, filePath, ...args);
  };
  try {
    return fn();
  } finally {
    fs.existsSync = originalExistsSync;
    fs.statSync = originalStatSync;
    fs.chmodSync = originalChmodSync;
  }
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

function runInstallerCli(runtime, targetDir, options = {}) {
  const { minimal = true } = options;
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  env.HOME = path.join(path.dirname(targetDir), 'home');
  env.USERPROFILE = env.HOME;

  return spawnSync(
    process.execPath,
    [
      installScript,
      `--${runtime}`,
      '--global',
      '--config-dir',
      targetDir,
      ...(minimal ? ['--minimal'] : []),
      '--no-sdk',
    ],
    {
      encoding: 'utf8',
      env,
    }
  );
}

function listDirNames(root, relPath) {
  const dir = path.join(root, relPath);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => entry.name);
}

function assertHasGsdDirectory(root, relPath) {
  assert.ok(
    listDirNames(root, relPath).some((name) => name.startsWith('gsd-')),
    `${relPath} should contain generated GSD entries`
  );
}

function assertFreshInstallContract(runtime, targetDir) {
  const contract = RUNTIME_INSTALL_CONTRACTS[runtime];
  assert.ok(contract, `missing runtime install contract for ${runtime}`);

  assert.equal(
    fs.readFileSync(path.join(targetDir, 'get-shit-done', 'VERSION'), 'utf8'),
    pkg.version,
    `${runtime} should install the package VERSION`
  );
  assert.ok(
    fs.existsSync(path.join(targetDir, 'get-shit-done', 'bin', 'gsd-tools.cjs')),
    `${runtime} should install the GSD tool payload`
  );
  assert.ok(
    fs.existsSync(path.join(targetDir, 'gsd-file-manifest.json')),
    `${runtime} should write the install manifest`
  );

  const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'gsd-file-manifest.json'), 'utf8'));
  assert.equal(manifest.version, pkg.version, `${runtime} manifest should record the package version`);
  assert.equal(manifest.mode, 'full', `${runtime} manifest should record a full install`);
  assert.ok(
    manifest.files['get-shit-done/VERSION'],
    `${runtime} manifest should track the installed VERSION file`
  );

  if (contract.surface === 'flat-skills') {
    assertHasGsdDirectory(targetDir, 'skills');
  } else if (contract.surface === 'hermes-skills') {
    assertHasGsdDirectory(targetDir, path.join('skills', 'gsd'));
    assert.ok(
      fs.existsSync(path.join(targetDir, 'skills', 'gsd', 'DESCRIPTION.md')),
      'Hermes should install the nested GSD category description'
    );
  } else if (contract.surface === 'flat-command') {
    assert.ok(
      listDirNames(targetDir, 'command').some((name) => name.startsWith('gsd-') && name.endsWith('.md')),
      `${runtime} should install flattened command markdown files`
    );
  } else if (contract.surface === 'commands-gsd') {
    assert.ok(
      listDirNames(targetDir, path.join('commands', 'gsd')).length > 0,
      `${runtime} should install commands/gsd entries`
    );
  } else if (contract.surface === 'clinerules') {
    assert.match(
      fs.readFileSync(path.join(targetDir, '.clinerules'), 'utf8'),
      /GSD workflows live in `get-shit-done\/workflows\/`/,
      'Cline should install root .clinerules guidance'
    );
  }

  assert.ok(
    listDirNames(targetDir, 'agents').some((name) => name.startsWith('gsd-')),
    `${runtime} full install should install agents`
  );

  assert.equal(
    fs.existsSync(path.join(targetDir, 'settings.json')),
    contract.settings,
    `${runtime} settings.json presence should match the runtime contract`
  );
  assert.equal(
    fs.existsSync(path.join(targetDir, 'package.json')),
    contract.packageJson,
    `${runtime} package.json presence should match the runtime contract`
  );

  if (contract.codexConfig) {
    assert.match(
      fs.readFileSync(path.join(targetDir, 'config.toml'), 'utf8'),
      /GSD Agent Configuration/,
      'Codex should install config.toml with the GSD marker'
    );
  }

  if (contract.copilotInstructions) {
    assert.match(
      fs.readFileSync(path.join(targetDir, 'copilot-instructions.md'), 'utf8'),
      /GSD Configuration/,
      'Copilot should install managed copilot instructions'
    );
  }
}

describe('installer migration install integration', { concurrency: false }, () => {
  let tmpRoot;
  let codexHome;

  beforeEach(() => {
    tmpRoot = createTempDir('gsd-install-migrations-');
    codexHome = path.join(tmpRoot, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpRoot);
  });

  test('reports applied migration actions before package materialization', () => {
    writeFile(codexHome, 'hooks/statusline.js', 'legacy managed hook\n');
    writeManifest(codexHome, {
      'hooks/statusline.js': sha256('legacy managed hook\n'),
    });

    const { output } = captureConsole(() =>
      withEnv('CODEX_HOME', codexHome, () => install(true, 'codex'))
    );

    const plainOutput = stripAnsi(output);
    assert.match(plainOutput, /Installer migrations/);
    assert.match(plainOutput, /removed\s+hooks\/statusline\.js/);
    assert.ok(
      plainOutput.indexOf('Installer migrations') < plainOutput.indexOf('Installed get-shit-done'),
      'migration report should appear before package materialization'
    );
    assert.equal(fs.existsSync(path.join(codexHome, 'hooks/statusline.js')), false);
  });

  test('blocks install before materialization when baseline needs explicit user choice', () => {
    writeFile(codexHome, 'hooks/gsd-retired-hook.js', 'old gsd hook\n');

    assert.throws(
      () => captureConsole(() =>
        withEnv('CODEX_HOME', codexHome, () => install(true, 'codex'))
      ),
      /installer migration blocked/
    );

    assert.equal(fs.readFileSync(path.join(codexHome, 'hooks/gsd-retired-hook.js'), 'utf8'), 'old gsd hook\n');
    assert.equal(fs.existsSync(path.join(codexHome, 'skills')), false);
    assert.equal(fs.existsSync(path.join(codexHome, 'get-shit-done', 'VERSION')), false);
  });

  test('rolls back applied migrations when package materialization fails for non-Codex installs', () => {
    const claudeHome = path.join(tmpRoot, '.claude');
    fs.mkdirSync(claudeHome, { recursive: true });
    writeFile(claudeHome, 'hooks/statusline.js', 'legacy managed hook\n');
    writeManifest(claudeHome, {
      'hooks/statusline.js': sha256('legacy managed hook\n'),
    });

    assert.throws(
      () => captureConsole(() =>
        withEnv('CLAUDE_CONFIG_DIR', claudeHome, () =>
          withWriteFailure(path.join(claudeHome, 'get-shit-done', 'VERSION'), () => install(true, 'claude'))
        )
      ),
      /injected write failure for VERSION/
    );

    assert.equal(
      fs.readFileSync(path.join(claudeHome, 'hooks/statusline.js'), 'utf8'),
      'legacy managed hook\n'
    );
    assert.equal(fs.existsSync(path.join(claudeHome, 'gsd-install-state.json')), false);
  });

  test('rolls back applied migrations when multi-runtime finalization fails', () => {
    const claudeHome = path.join(tmpRoot, '.claude');
    fs.mkdirSync(claudeHome, { recursive: true });
    writeFile(claudeHome, 'hooks/statusline.js', 'legacy managed hook\n');
    writeManifest(claudeHome, {
      'hooks/statusline.js': sha256('legacy managed hook\n'),
    });

    assert.throws(
      () => captureConsole(() =>
        withEnv('CLAUDE_CONFIG_DIR', claudeHome, () =>
          withSdkDistPresent(() =>
            withWriteFailure(path.join(claudeHome, 'settings.json'), () =>
              installModule.installAllRuntimes(['claude'], true, false)
            )
          )
        )
      ),
      /injected write failure for settings\.json/
    );

    assert.equal(
      fs.readFileSync(path.join(claudeHome, 'hooks/statusline.js'), 'utf8'),
      'legacy managed hook\n'
    );
    assert.equal(fs.existsSync(path.join(claudeHome, 'gsd-install-state.json')), false);
  });

  test('rolls back completed runtime migrations when a later runtime install fails', () => {
    const claudeHome = path.join(tmpRoot, '.claude');
    fs.mkdirSync(claudeHome, { recursive: true });
    writeFile(claudeHome, 'hooks/statusline.js', 'legacy managed hook\n');
    writeManifest(claudeHome, {
      'hooks/statusline.js': sha256('legacy managed hook\n'),
    });

    writeFile(codexHome, 'hooks/statusline.js', 'legacy managed hook\n');
    writeManifest(codexHome, {
      'hooks/statusline.js': sha256('legacy managed hook\n'),
    });

    assert.throws(
      () => captureConsole(() =>
        withEnv('CLAUDE_CONFIG_DIR', claudeHome, () =>
          withEnv('CODEX_HOME', codexHome, () =>
            withWriteFailure(path.join(codexHome, 'get-shit-done', 'VERSION'), () =>
              installModule.installAllRuntimes(['claude', 'codex'], true, false)
            )
          )
        )
      ),
      /injected write failure for VERSION/
    );

    assert.equal(
      fs.readFileSync(path.join(claudeHome, 'hooks/statusline.js'), 'utf8'),
      'legacy managed hook\n'
    );
    assert.equal(fs.existsSync(path.join(claudeHome, 'gsd-install-state.json')), false);
    assert.equal(
      fs.readFileSync(path.join(codexHome, 'hooks/statusline.js'), 'utf8'),
      'legacy managed hook\n'
    );
    assert.equal(fs.existsSync(path.join(codexHome, 'gsd-install-state.json')), false);
  });

  for (const runtime of SUPPORTED_RUNTIMES) {
    test(`runs a full end-to-end install for ${runtime}`, () => {
      const targetDir = path.join(tmpRoot, `.${runtime}-full-install`);
      fs.mkdirSync(targetDir, { recursive: true });
      writeFile(targetDir, 'hooks/statusline.js', 'legacy managed hook\n');
      writeManifest(targetDir, {
        'hooks/statusline.js': sha256('legacy managed hook\n'),
      });

      const result = runInstallerCli(runtime, targetDir, { minimal: false });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const output = stripAnsi(`${result.stdout}\n${result.stderr}`);
      assert.match(output, /Installing for /);
      assert.match(output, /Installer migrations/);
      assert.match(output, /removed\s+hooks\/statusline\.js/);
      assert.match(output, /Installed get-shit-done/);
      assert.match(output, /Done!/);
      assert.equal(fs.existsSync(path.join(targetDir, 'hooks/statusline.js')), false);

      const installState = JSON.parse(fs.readFileSync(path.join(targetDir, 'gsd-install-state.json'), 'utf8'));
      assert.ok(
        installState.appliedMigrations.some((entry) => entry.id === '2026-05-11-legacy-orphan-files'),
        `${runtime} should track the applied cleanup migration in install state`
      );
      assertFreshInstallContract(runtime, targetDir);
    });

    test(`runs managed cleanup migrations for ${runtime}`, () => {
      const targetDir = path.join(tmpRoot, `.${runtime}-managed-cleanup`);
      fs.mkdirSync(targetDir, { recursive: true });
      writeFile(targetDir, 'hooks/statusline.js', 'legacy managed hook\n');
      writeManifest(targetDir, {
        'hooks/statusline.js': sha256('legacy managed hook\n'),
      });

      const result = runInstallerCli(runtime, targetDir);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const output = stripAnsi(`${result.stdout}\n${result.stderr}`);
      assert.match(output, /Installer migrations/);
      assert.match(output, /removed\s+hooks\/statusline\.js/);
      assert.equal(fs.existsSync(path.join(targetDir, 'hooks/statusline.js')), false);
      const installState = JSON.parse(fs.readFileSync(path.join(targetDir, 'gsd-install-state.json'), 'utf8'));
      assert.ok(
        installState.appliedMigrations.some((entry) => entry.id === '2026-05-11-legacy-orphan-files'),
        'successful install should write install state for the applied cleanup migration'
      );
    });

    test(`blocks ambiguous GSD-looking user-choice artifacts for ${runtime}`, () => {
      const targetDir = path.join(tmpRoot, `.${runtime}-blocked`);
      fs.mkdirSync(targetDir, { recursive: true });
      writeFile(targetDir, 'get-shit-done/gsd-retired-tool.cjs', 'old ambiguous artifact\n');

      const result = runInstallerCli(runtime, targetDir);

      assert.notEqual(result.status, 0, 'install should fail before materialization');
      const output = stripAnsi(`${result.stdout}\n${result.stderr}`);
      assert.match(output, /Installer migrations/);
      assert.match(output, /blocked\s+get-shit-done\/gsd-retired-tool\.cjs/);
      assert.match(output, /installer migration blocked/);
      assert.equal(
        fs.readFileSync(path.join(targetDir, 'get-shit-done/gsd-retired-tool.cjs'), 'utf8'),
        'old ambiguous artifact\n'
      );
      assert.equal(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')), false);
    });
  }
});
