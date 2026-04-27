/**
 * Regression: issue #2760 — Codex install path corrupts existing config.toml.
 *
 * Three defects, three fixes (defensive triple):
 *
 *   Defect 3 (confirmed real) — Hooks AoT downgrade. When the user already has
 *     `[[hooks.SessionStart]]` (namespaced AoT) entries in their config, GSD
 *     used to append a `[[hooks]]` (top-level AoT) block that confuses
 *     round-trip writers and produces a config Codex refuses to load.
 *     Fix: detect the user's preferred shape and emit GSD's hook in the same
 *     namespaced form so both coexist cleanly.
 *
 *   Defects 1+2 (defensive) — Strip-step robustness. Pre-existing legacy
 *     `[agents]` (single-bracket) and `[[agents]]` (sequence) blocks are
 *     invalid in current Codex schema and break Codex even though GSD now
 *     emits the correct `[agents.<name>]` struct form. Fix: install-time
 *     stripping always purges these forms regardless of GSD marker presence
 *     so reinstall self-heals files where the marker was edited out or never
 *     existed (third-party tools).
 *
 *   Fix 3 (defensive) — Post-write validation. Parse the bytes we are about
 *     to commit, assert they match Codex's expected schema (no bare/sequence
 *     `agents`, no bare `hooks.<Event>`); on failure, restore the pre-install
 *     backup and abort so the user never gets a broken Codex CLI.
 */

// Scope GSD_TEST_MODE to module load only — restore prior value (or unset) so
// downstream tests in the same node process never see test-only behaviour
// leak through (#2760 CR4 finding 5).
const previousGsdTestMode = process.env.GSD_TEST_MODE;
process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  install,
  validateCodexConfigSchema,
  hasUserNamespacedAotHooks,
  stripGsdFromCodexConfig,
  installCodexConfig,
  parseTomlToObject,
} = require('../bin/install.js');

if (previousGsdTestMode === undefined) {
  delete process.env.GSD_TEST_MODE;
} else {
  process.env.GSD_TEST_MODE = previousGsdTestMode;
}

function runCodexInstall(codexHome, cwd = path.join(__dirname, '..')) {
  const previousCodeHome = process.env.CODEX_HOME;
  const previousCwd = process.cwd();
  process.env.CODEX_HOME = codexHome;
  try {
    process.chdir(cwd);
    return install(true, 'codex');
  } finally {
    process.chdir(previousCwd);
    if (previousCodeHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodeHome;
    }
  }
}

function readCodexConfig(codexHome) {
  return fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
}

function writeCodexConfig(codexHome, content) {
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'config.toml'), content, 'utf8');
}

describe('#2760 defect 3 — Hooks AoT preservation across install/uninstall/reinstall', () => {
  let tmpDir;
  let codexHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-d3-'));
    codexHome = path.join(tmpDir, 'codex-home');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('preserves both pre-existing [[hooks.SessionStart]] entries and adds GSD entry in namespaced form', () => {
    const userConfig = [
      '[[hooks.SessionStart]]',
      'command = "echo first user hook"',
      '',
      '[[hooks.SessionStart]]',
      'command = "echo second user hook"',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, userConfig);

    runCodexInstall(codexHome);
    const afterInstall = readCodexConfig(codexHome);
    const parsed = parseTomlToObject(afterInstall);

    // hooks.SessionStart must be an array-of-tables (namespaced AoT form).
    assert.ok(
      parsed.hooks && Array.isArray(parsed.hooks.SessionStart),
      'hooks.SessionStart must be an array-of-tables, got: '
        + (parsed.hooks ? typeof parsed.hooks.SessionStart : 'no hooks table')
    );

    const commands = parsed.hooks.SessionStart.map((entry) => entry.command);

    // Both pre-existing user hook entries survive in the parsed structure.
    assert.ok(
      commands.includes('echo first user hook'),
      'first user [[hooks.SessionStart]] entry preserved in parsed structure: ' + JSON.stringify(commands)
    );
    assert.ok(
      commands.includes('echo second user hook'),
      'second user [[hooks.SessionStart]] entry preserved in parsed structure: ' + JSON.stringify(commands)
    );

    // GSD's managed entry is emitted in the same namespaced AoT shape so it
    // does not collide with the user's preferred form.
    assert.ok(
      commands.some((cmd) => typeof cmd === 'string' && /gsd-check-update\.js/.test(cmd)),
      'GSD entry must appear in hooks.SessionStart array (not top-level [[hooks]]): '
        + JSON.stringify(commands)
    );

    // Top-level [[hooks]] AoT must not coexist when namespaced form is in use —
    // mixing forms is what produces the round-trip break this fix prevents.
    assert.ok(
      !Array.isArray(parsed.hooks) || parsed.hooks.length === 0,
      'no top-level [[hooks]] AoT entries when namespaced form is in use'
    );
  });

  test('selects top-level [[hooks]] form when user has no namespaced hooks (status-quo behavior)', () => {
    writeCodexConfig(codexHome, '');
    runCodexInstall(codexHome);
    const content = readCodexConfig(codexHome);
    const parsed = parseTomlToObject(content);

    // Top-level hooks must be an array-of-tables; the GSD entry must be one
    // of those tables and carry event = "SessionStart".
    assert.ok(
      Array.isArray(parsed.hooks),
      'fresh install must produce top-level [[hooks]] AoT, got: ' + typeof parsed.hooks
    );
    assert.ok(
      parsed.hooks.some((h) => h && h.event === 'SessionStart'),
      'top-level [[hooks]] AoT must contain an entry with event = "SessionStart": '
        + JSON.stringify(parsed.hooks)
    );
  });
});

describe('#2760 fix 2 — Strip purges invalid legacy [agents] / [[agents]] regardless of marker', () => {
  let tmpDir;
  let codexHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-f2-'));
    codexHome = path.join(tmpDir, 'codex-home');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('strips bare [agents] single-bracket block (no GSD marker, arbitrary user keys)', () => {
    writeCodexConfig(codexHome, [
      '[agents]',
      'default = "custom-agent"',
      'extra_key = "value"',
      '',
      '[model]',
      'name = "o3"',
      '',
    ].join('\n'));

    runCodexInstall(codexHome);
    const content = readCodexConfig(codexHome);
    const parsed = parseTomlToObject(content);

    // Bare [agents] would have left { default, extra_key } as scalar leaves
    // on parsed.agents. After strip + struct emit, every key under agents
    // must itself be a table (the gsd-* struct form).
    assert.ok(
      parsed.agents && typeof parsed.agents === 'object' && !Array.isArray(parsed.agents),
      'agents must be a table-of-tables in parsed structure, got: ' + typeof parsed.agents
    );
    assert.equal(parsed.agents.default, undefined, 'bare [agents] default key must be stripped');
    assert.equal(parsed.agents.extra_key, undefined, 'bare [agents] extra_key must be stripped');
    const gsdAgents = Object.keys(parsed.agents).filter((k) => k.startsWith('gsd-'));
    assert.ok(
      gsdAgents.length > 0 && gsdAgents.every((k) => typeof parsed.agents[k] === 'object'),
      'agents.gsd-* struct form must be present: ' + JSON.stringify(Object.keys(parsed.agents))
    );

    // User's unrelated [model] section preserved structurally.
    assert.ok(
      parsed.model && parsed.model.name === 'o3',
      'unrelated user [model] section preserved with name = "o3", got: ' + JSON.stringify(parsed.model)
    );
  });

  test('strips [[agents]] sequence-form block without GSD marker (third-party / marker-edited-out)', () => {
    writeCodexConfig(codexHome, [
      '[[agents]]',
      'name = "user-helper"',
      'description = "third-party agent"',
      '',
      '[[agents]]',
      'name = "another-helper"',
      'description = "second one"',
      '',
      '[projects."/tmp/x"]',
      'trust_level = "trusted"',
      '',
    ].join('\n'));

    runCodexInstall(codexHome);
    const content = readCodexConfig(codexHome);
    const parsed = parseTomlToObject(content);

    // [[agents]] sequence form would parse to Array — after strip it must be
    // a table-of-tables with gsd-* struct keys.
    assert.ok(
      parsed.agents && typeof parsed.agents === 'object' && !Array.isArray(parsed.agents),
      'agents must be a table-of-tables in parsed structure (sequence form must be stripped), got: '
        + (Array.isArray(parsed.agents) ? 'array' : typeof parsed.agents)
    );
    const gsdAgents = Object.keys(parsed.agents).filter((k) => k.startsWith('gsd-'));
    assert.ok(
      gsdAgents.length > 0,
      'agents.gsd-* struct form must be present: ' + JSON.stringify(Object.keys(parsed.agents))
    );

    // User's unrelated [projects."/tmp/x"] section preserved structurally.
    assert.ok(
      parsed.projects && parsed.projects['/tmp/x'] && parsed.projects['/tmp/x'].trust_level === 'trusted',
      'unrelated user [projects."/tmp/x"] section preserved with trust_level = "trusted", got: '
        + JSON.stringify(parsed.projects)
    );
  });
});

// concurrency: false — the third test mutates installModule.__codexSchemaValidator,
// a module-level test seam. Other tests in this file (and in bug-2153, etc.)
// also call runCodexInstall() and would observe the injected validator if
// node:test ran them in parallel. Serializing this describe block keeps the
// seam mutation invisible to siblings.
describe('#2760 fix 3 — Post-write Codex schema validation', { concurrency: false }, () => {
  test('passes a clean config produced by GSD install', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-f3a-'));
    try {
      const codexHome = path.join(tmpDir, 'codex-home');
      runCodexInstall(codexHome);
      const content = readCodexConfig(codexHome);
      const result = validateCodexConfigSchema(content);
      assert.equal(result.ok, true, 'GSD-emitted config passes schema validation');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('rejects bare [agents] and bare [hooks.SessionStart] in arbitrary content', () => {
    const bareAgents = [
      '[agents]',
      'default = "x"',
      '',
    ].join('\n');
    const bareHooks = [
      '[hooks.SessionStart]',
      'command = "x"',
      '',
    ].join('\n');
    const sequenceAgents = [
      '[[agents]]',
      'name = "x"',
      '',
    ].join('\n');

    assert.equal(validateCodexConfigSchema(bareAgents).ok, false, 'bare [agents] rejected');
    assert.equal(validateCodexConfigSchema(bareHooks).ok, false, 'bare [hooks.SessionStart] rejected');
    assert.equal(validateCodexConfigSchema(sequenceAgents).ok, false, '[[agents]] sequence rejected');
  });

  test('aborts install and restores pre-install backup when post-write validation fails', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-f3b-'));
    const installModule = require('../bin/install.js');
    try {
      const codexHome = path.join(tmpDir, 'codex-home');
      // Pre-install file the user wants protected.
      const preInstall = [
        '# user file',
        '[model]',
        'name = "o3"',
        '',
      ].join('\n');
      writeCodexConfig(codexHome, preInstall);

      // Force the post-write validator to fail via the documented test seam.
      // This simulates the writer producing legacy-form output that Codex
      // would reject — install MUST abort, restore the pre-install bytes,
      // and surface a clear error.
      installModule.__codexSchemaValidator = () => ({
        ok: false,
        reason: 'simulated invalid output for test',
      });

      let threw = false;
      try {
        runCodexInstall(codexHome);
      } catch (e) {
        threw = true;
        assert.match(
          e.message,
          /post-write Codex schema validation failed/,
          'thrown error names the validation failure'
        );
        assert.match(e.message, /simulated invalid output for test/, 'thrown error includes reason');
      }
      assert.equal(threw, true, 'install threw when validator failed');

      const afterInstall = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
      assert.equal(
        afterInstall,
        preInstall,
        'pre-install file restored verbatim after validation failure'
      );
    } finally {
      delete installModule.__codexSchemaValidator;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('#2760 — hasUserNamespacedAotHooks helper', () => {
  test('detects [[hooks.SessionStart]] AoT entries', () => {
    const content = [
      '[[hooks.SessionStart]]',
      'command = "x"',
      '',
    ].join('\n');
    assert.equal(hasUserNamespacedAotHooks(content, 'SessionStart'), true);
  });

  test('returns false when only top-level [[hooks]] entries exist', () => {
    const content = [
      '[[hooks]]',
      'event = "SessionStart"',
      'command = "x"',
      '',
    ].join('\n');
    assert.equal(hasUserNamespacedAotHooks(content, 'SessionStart'), false);
  });

  test('returns false when only single-bracket [hooks.SessionStart] exists', () => {
    const content = [
      '[hooks.SessionStart]',
      'command = "x"',
      '',
    ].join('\n');
    assert.equal(hasUserNamespacedAotHooks(content, 'SessionStart'), false);
  });
});

// concurrency: false — these tests monkey-patch fs.writeFileSync, a global
// shared with every other suite running in parallel. Serializing prevents
// stray writes from sibling tests landing in the stub.
describe('#2760 fix 4 — Write-failure rollback (atomic write + snapshot restore)', { concurrency: false }, () => {
  let tmpDir;
  let codexHome;
  let originalWriteFileSync;
  // #2760 CR5 finding 5 — symmetric snapshot/restore for fs.renameSync. The
  // first test below monkey-patches renameSync; without a beforeEach/afterEach
  // pair, only the local `finally` restores it, which is fragile to future
  // edits that add early-return paths.
  let originalRenameSync;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-f4-'));
    codexHome = path.join(tmpDir, 'codex-home');
    originalWriteFileSync = fs.writeFileSync;
    originalRenameSync = fs.renameSync;
  });

  afterEach(() => {
    fs.renameSync = originalRenameSync;
    fs.writeFileSync = originalWriteFileSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('pre-install config bytes survive when fs.renameSync throws over configPath', () => {
    const preInstall = [
      '# user file',
      '[model]',
      'name = "o3"',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, preInstall);

    // After fs is restored we'll re-read the file. Capture the byte buffer
    // exactly so the comparison is bit-for-bit.
    const preInstallBytes = fs.readFileSync(path.join(codexHome, 'config.toml'));

    const configPath = path.join(codexHome, 'config.toml');
    const tempPattern = new RegExp('^' + configPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.tmp-');

    // Stub: allow writes to atomic temp files (which renameSync overwrites
    // the target, never truncating it directly) but throw on any direct
    // write to the canonical configPath. This simulates either:
    //   (a) an older code path doing a non-atomic write, or
    //   (b) a downstream module bypassing atomicWriteFileSync.
    // Either way the snapshot must be restored. We let the temp write go
    // through, then make renameSync throw to simulate the partial write
    // never landing.
    // #2760 CR5 finding 5 — fs.renameSync is restored by the suite-level
    // afterEach; no local finally needed.
    fs.renameSync = (src, dst) => {
      if (dst === configPath) {
        throw new Error('simulated rename failure mid-install');
      }
      return originalRenameSync(src, dst);
    };

    let threw = false;
    let thrownErr = null;
    try {
      runCodexInstall(codexHome);
    } catch (e) {
      threw = true;
      thrownErr = e;
      assert.ok(/rename failure|simulated|post-write/.test(e.message),
        'thrown error must surface the simulated failure or its post-write wrapper: ' + e.message);
    }
    // #2760 CR5 finding 4 — tighten contract per finding #1: ALL pre-write
    // and write failures must be fatal. This test previously accepted either
    // throw OR warn — sibling tests already require throw, so lock parity.
    assert.equal(threw, true, 'rename failure must be fatal: ' + (thrownErr && thrownErr.message));

    const afterBytes = fs.readFileSync(path.join(codexHome, 'config.toml'));
    assert.deepStrictEqual(
      afterBytes,
      preInstallBytes,
      'pre-install config.toml bytes must survive a mid-install write/rename failure'
    );

    // And the parsed structure of the surviving file must still be the
    // user's [model] section, not a half-written GSD block.
    const parsed = parseTomlToObject(afterBytes.toString('utf8'));
    assert.equal(parsed.model && parsed.model.name, 'o3',
      'surviving file must still be the user pre-install content');
    assert.equal(parsed.agents, undefined,
      'no GSD agents block may have leaked into the surviving file');

    // No stray .tmp-* siblings left behind in the codex home.
    const stray = fs.readdirSync(codexHome).filter((f) => tempPattern.test(path.join(codexHome, f)));
    assert.equal(stray.length, 0,
      'atomic write must clean up its temp file on failure: ' + stray.join(', '));
  });

  test('pre-install config bytes survive when fs.writeFileSync throws on the .tmp- target', () => {
    const preInstall = [
      '# user file',
      '[model]',
      'name = "o3"',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, preInstall);

    const preInstallBytes = fs.readFileSync(path.join(codexHome, 'config.toml'));
    const configPath = path.join(codexHome, 'config.toml');
    const tempPattern = new RegExp('^' + configPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.tmp-');

    // Stub: fault writes targeting the atomic temp file (the pre-rename branch
    // of atomicWriteFileSync). Other writes (agent .toml files in CODEX_HOME)
    // pass through. This exercises the failure path where the temp write itself
    // throws, not the rename — the case the prior test left untested.
    // #2760 CR5 finding 5 — fs.writeFileSync is restored by the suite-level
    // afterEach (via originalWriteFileSync); no local finally needed.
    const captured = originalWriteFileSync;
    fs.writeFileSync = function patchedWriteFileSync(target, data, options) {
      if (typeof target === 'string' && tempPattern.test(target)) {
        throw new Error('simulated writeFileSync failure on .tmp- target');
      }
      return captured.call(this, target, data, options);
    };

    let threw = false;
    try {
      runCodexInstall(codexHome);
    } catch (e) {
      threw = true;
      assert.ok(/simulated writeFileSync failure|post-write Codex install failed|pre-write/.test(e.message),
        'thrown error must surface the simulated failure or its post-write wrapper: ' + e.message);
    }
    // Per #2760 CR4 finding 1 / CR5 finding 1, write failures must abort install (not warn).
    assert.equal(threw, true, 'install must throw when atomic temp-write fails');

    const afterBytes = fs.readFileSync(path.join(codexHome, 'config.toml'));
    assert.deepStrictEqual(
      afterBytes,
      preInstallBytes,
      'pre-install config.toml bytes must survive a temp-write failure'
    );

    const parsed = parseTomlToObject(afterBytes.toString('utf8'));
    assert.equal(parsed.model && parsed.model.name, 'o3',
      'surviving file must still be the user pre-install content');
    assert.equal(parsed.agents, undefined,
      'no GSD agents block may have leaked into the surviving file');

    const stray = fs.readdirSync(codexHome).filter((f) => tempPattern.test(path.join(codexHome, f)));
    assert.equal(stray.length, 0,
      'atomic write must clean up its temp file on failure: ' + stray.join(', '));
  });
});

// concurrency: false — these tests rely on the same install path and module-
// level pre-install snapshot that the fix-3/fix-4 suites exercise. Serializing
// keeps state mutations from leaking across parallel siblings.
describe('#2760 CR4 finding 2 — Legacy flat [[hooks]] block migrates to namespaced AoT on reinstall', { concurrency: false }, () => {
  let tmpDir;
  let codexHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-cr4-f2-'));
    codexHome = path.join(tmpDir, 'codex-home');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('pre-install legacy flat [[hooks]] gsd-check-update + user namespaced [[hooks.SessionStart]] → post-install converges on namespaced AoT', () => {
    // Reproduce the upgrade scenario:
    //   - User has [[hooks.SessionStart]] entry of their own (signal that GSD
    //     should emit in the namespaced shape).
    //   - A previous GSD install left the legacy flat [[hooks]] managed block
    //     for gsd-check-update. The pre-CR4 strip step would short-circuit
    //     the namespaced emit and leave the user stuck in the mixed layout.
    const userPlusLegacy = [
      '[[hooks.SessionStart]]',
      'command = "echo user hook"',
      '',
      '# GSD Hooks',
      '[[hooks]]',
      'event = "SessionStart"',
      'command = "node /old/path/hooks/gsd-check-update.js"',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, userPlusLegacy);

    runCodexInstall(codexHome);
    const afterInstall = readCodexConfig(codexHome);
    const parsed = parseTomlToObject(afterInstall);

    // After CR4 finding 2: the legacy flat [[hooks]] managed block is stripped
    // and the GSD entry is re-emitted in the namespaced AoT shape so the two
    // forms do not coexist.
    assert.ok(
      parsed.hooks && Array.isArray(parsed.hooks.SessionStart),
      'hooks.SessionStart must be an array-of-tables, got: '
        + (parsed.hooks ? typeof parsed.hooks.SessionStart : 'no hooks table')
    );

    const namespacedCommands = parsed.hooks.SessionStart.map((entry) => entry.command);
    assert.ok(
      namespacedCommands.includes('echo user hook'),
      'user [[hooks.SessionStart]] entry preserved: ' + JSON.stringify(namespacedCommands)
    );
    assert.ok(
      namespacedCommands.some((cmd) => typeof cmd === 'string' && /gsd-check-update\.js/.test(cmd)),
      'GSD entry must appear in hooks.SessionStart array (namespaced AoT form): '
        + JSON.stringify(namespacedCommands)
    );

    // The legacy top-level [[hooks]] AoT must NOT coexist with the namespaced
    // form after migration. parseTomlToObject distinguishes via Array.isArray.
    assert.ok(
      !Array.isArray(parsed.hooks) || parsed.hooks.length === 0,
      'no top-level [[hooks]] AoT entries may remain after legacy migration: '
        + JSON.stringify(parsed.hooks)
    );

    // No duplicate gsd-check-update entries — exactly one managed entry.
    const gsdEntries = namespacedCommands.filter(
      (cmd) => typeof cmd === 'string' && /gsd-check-update\.js/.test(cmd)
    );
    assert.equal(gsdEntries.length, 1,
      'exactly one gsd-check-update entry after migration, got: ' + gsdEntries.length);
  });
});

describe('#2760 CR4 finding 3 — parseTomlToObject rejects malformed input that previously slipped through', () => {
  test('rejects float values (timeout = 0.5)', () => {
    const content = [
      '[server]',
      'timeout = 0.5',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /unsupported TOML value|trailing bytes/,
      'float values must be rejected, not silently truncated to int prefix'
    );
  });

  test('rejects date values (created = 1979-05-27)', () => {
    const content = [
      '[meta]',
      'created = 1979-05-27',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /unsupported TOML value|trailing bytes/,
      'date values must be rejected, not silently truncated'
    );
  });

  test('rejects trailing garbage after a string value (key = "x" junk)', () => {
    const content = [
      '[section]',
      'key = "x" junk',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /trailing bytes/,
      'trailing bytes after a complete value must be rejected'
    );
  });

  test('accepts trailing whitespace and # comment after a value', () => {
    const content = [
      '[section]',
      'key = "x"   # an inline comment',
      'flag = true',
      'count = 7   ',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.equal(parsed.section.key, 'x');
    assert.equal(parsed.section.flag, true);
    assert.equal(parsed.section.count, 7);
  });
});

// concurrency: false — see the fix-3 suite above for the same rationale.
describe('#2760 CR4 finding 1 — atomicWriteFileSync failure aborts install (post-write fatal)', { concurrency: false }, () => {
  let tmpDir;
  let codexHome;
  let originalRenameSync;
  let originalConsoleLog;
  let consoleOutput;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-cr4-f1-'));
    codexHome = path.join(tmpDir, 'codex-home');
    originalRenameSync = fs.renameSync;
    originalConsoleLog = console.log;
    consoleOutput = [];
    console.log = (...args) => { consoleOutput.push(args.join(' ')); };
  });

  afterEach(() => {
    fs.renameSync = originalRenameSync;
    console.log = originalConsoleLog;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('install throws and never prints "Done!" when atomicWriteFileSync fails on configPath', () => {
    const preInstall = [
      '# user file',
      '[model]',
      'name = "o3"',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, preInstall);

    const configPath = path.join(codexHome, 'config.toml');
    // Only fault the hook-block atomic rename — earlier writes to config.toml
    // happen via mergeCodexConfig (agent-block emit). We want to exercise the
    // post-write Codex install branch specifically. Detect by reading the temp
    // file's contents and only faulting when the hook block is present.
    fs.renameSync = (src, dst) => {
      if (dst === configPath) {
        let isHookWrite = false;
        try {
          const data = fs.readFileSync(src, 'utf8');
          isHookWrite = /gsd-check-update\.js/.test(data);
        } catch (_) { /* ignore */ }
        if (isHookWrite) {
          throw new Error('simulated rename failure');
        }
      }
      return originalRenameSync(src, dst);
    };

    let threw = false;
    let thrownMessage = '';
    try {
      runCodexInstall(codexHome);
    } catch (e) {
      threw = true;
      thrownMessage = e.message;
    }

    assert.equal(threw, true, 'install must throw when atomic write fails');
    assert.match(
      thrownMessage,
      /post-write Codex install failed/,
      'thrown error must use the post-write prefix so the outer catch treats it as fatal'
    );

    // Critical: install must NOT have printed any "Done!" success banner.
    const printedDone = consoleOutput.some(
      (line) => typeof line === 'string' && /Done!/i.test(line)
    );
    assert.equal(printedDone, false,
      'install must NOT print "Done!" after a write failure: ' + JSON.stringify(consoleOutput.filter((l) => /Done|✓/.test(l))));

    // And the user's pre-install bytes are intact (snapshot restore).
    const after = fs.readFileSync(configPath, 'utf8');
    assert.equal(after, preInstall, 'pre-install bytes preserved after fatal abort');
  });
});

// concurrency: false — patches module.exports.__codexSchemaValidator, a
// shared test seam. Serializing prevents stray patches from sibling tests.
describe('#2760 CR5 finding 1 — pre-write failures abort install (outer catch fatal)', { concurrency: false }, () => {
  let tmpDir;
  let codexHome;
  let originalConsoleLog;
  let consoleOutput;
  const installModule = require('../bin/install.js');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-cr5-f1-'));
    codexHome = path.join(tmpDir, 'codex-home');
    originalConsoleLog = console.log;
    consoleOutput = [];
    console.log = (...args) => { consoleOutput.push(args.join(' ')); };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    delete installModule.__codexSchemaValidator;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('pre-write throw (validator throws, not returns {ok:false}) is fatal and restores snapshot', () => {
    // A validator that THROWS (vs returning {ok:false}) bypasses the
    // validation branch and exits the inner try via the catch at the outer
    // level. Pre-CR5, that catch downgraded to console.warn and let the
    // install print "Done!" with no Codex hooks. Post-CR5 it must rethrow.
    const preInstall = [
      '# user file',
      '[model]',
      'name = "o3"',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, preInstall);

    installModule.__codexSchemaValidator = () => {
      throw new Error('synthetic validator-throw simulating a pre-write helper failure');
    };

    let threw = false;
    let thrownMsg = '';
    try {
      runCodexInstall(codexHome);
    } catch (e) {
      threw = true;
      thrownMsg = e.message;
    }

    assert.equal(threw, true,
      'install must rethrow when a pre-write step throws (CR5 finding 1)');
    assert.match(thrownMsg, /pre-write|synthetic validator-throw/,
      'thrown error must surface the pre-write wrapper or original message: ' + thrownMsg);

    const printedDone = consoleOutput.some(
      (line) => typeof line === 'string' && /Done!/i.test(line)
    );
    assert.equal(printedDone, false,
      'install must NOT print "Done!" after a pre-write failure: ' +
      JSON.stringify(consoleOutput.filter((l) => /Done|✓/.test(l))));

    // Pre-install bytes intact (snapshot restored).
    const after = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    assert.equal(after, preInstall,
      'pre-install bytes must survive a pre-write helper throw');
  });
});

describe('#2760 CR5 finding 2 — parseTomlToObject rejects duplicate keys and shape-mismatched headers', () => {
  test('rejects duplicate scalar key in same table ([a]\\nx=1\\nx=2)', () => {
    const content = [
      '[a]',
      'x = 1',
      'x = 2',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /duplicate key/,
      'real TOML 1.0 rejects duplicate keys in the same table'
    );
  });

  test('rejects duplicate scalar key in root table', () => {
    const content = [
      'x = 1',
      'x = 2',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /duplicate key/,
      'duplicate root-table keys must be rejected'
    );
  });

  test('rejects re-declared [a] table header ([a] then [a] again)', () => {
    const content = [
      '[a]',
      'x = 1',
      '',
      '[a]',
      'y = 2',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /duplicate or shape-mismatched table header/,
      'real TOML 1.0 rejects re-declaring the same [a] header twice'
    );
  });

  test('rejects [[arr]] then [arr] for same path (array-of-tables → table)', () => {
    const content = [
      '[[arr]]',
      'x = 1',
      '',
      '[arr]',
      'y = 2',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /duplicate or shape-mismatched table header/,
      'cannot redeclare an array-of-tables path as a plain table'
    );
  });

  test('accepts repeated [[arr]] (genuine array-of-tables)', () => {
    const content = [
      '[[arr]]',
      'x = 1',
      '',
      '[[arr]]',
      'x = 2',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.ok(Array.isArray(parsed.arr));
    assert.strictEqual(parsed.arr.length, 2);
    assert.strictEqual(parsed.arr[0].x, 1);
    assert.strictEqual(parsed.arr[1].x, 2);
  });

  test('accepts disjoint nested headers (not duplicates)', () => {
    const content = [
      '[a.b]',
      'x = 1',
      '',
      '[a.c]',
      'y = 2',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.strictEqual(parsed.a.b.x, 1);
    assert.strictEqual(parsed.a.c.y, 2);
  });
});

// concurrency: false — drives the same install pipeline as the other f-suites.
describe('#2760 CR5 finding 3 — migration emits namespaced AoT (no flat/namespaced mixing)', { concurrency: false }, () => {
  let tmpDir;
  let codexHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2760-cr5-f3-'));
    codexHome = path.join(tmpDir, 'codex-home');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('user has [[hooks.AfterTool]] AND legacy [hooks.SessionStart] → post-install both namespaced, no flat AoT', () => {
    // Reproduces the mixed-form scenario from finding 3:
    //  - User pre-config has both a namespaced AoT entry [[hooks.AfterTool]]
    //    AND a legacy single-bracket [hooks.SessionStart].
    //  - Pre-CR5 migration converts the legacy section to flat [[hooks]]
    //    with event="SessionStart", leaving a mixed flat+namespaced layout.
    //  - Post-CR5 migration emits [[hooks.SessionStart]] directly so both
    //    of the user's hooks coexist in the namespaced shape, and the
    //    GSD-managed entry converges on namespaced too.
    const userPlusLegacy = [
      '[[hooks.AfterTool]]',
      'command = "x"',
      '',
      '[hooks.SessionStart]',
      'command = "y"',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, userPlusLegacy);

    runCodexInstall(codexHome);
    const after = readCodexConfig(codexHome);
    const parsed = parseTomlToObject(after);

    // The pre-existing [[hooks.AfterTool]] entry is preserved.
    assert.ok(
      parsed.hooks && Array.isArray(parsed.hooks.AfterTool),
      'pre-existing [[hooks.AfterTool]] must remain a namespaced AoT array'
    );
    assert.ok(
      parsed.hooks.AfterTool.some((entry) => entry.command === 'x'),
      'user AfterTool entry must be preserved: ' + JSON.stringify(parsed.hooks.AfterTool)
    );

    // The migrated SessionStart entry is now namespaced AoT, not flat
    // [[hooks]] with event="SessionStart".
    assert.ok(
      parsed.hooks && Array.isArray(parsed.hooks.SessionStart),
      'migrated SessionStart must be namespaced AoT (not flat [[hooks]])'
    );
    const ssCommands = parsed.hooks.SessionStart.map((e) => e.command);
    assert.ok(
      ssCommands.includes('y'),
      'user SessionStart command "y" must be preserved in namespaced array: ' +
        JSON.stringify(ssCommands)
    );
    // GSD's managed gsd-check-update entry also lives in the namespaced array.
    assert.ok(
      ssCommands.some((cmd) => typeof cmd === 'string' && /gsd-check-update\.js/.test(cmd)),
      'managed gsd-check-update entry must appear in hooks.SessionStart array: ' +
        JSON.stringify(ssCommands)
    );

    // No flat top-level [[hooks]] AoT may remain.
    assert.ok(
      !Array.isArray(parsed.hooks) || parsed.hooks.length === 0,
      'no flat top-level [[hooks]] AoT entries may remain after migration: ' +
        JSON.stringify(parsed.hooks)
    );

    // No synthetic event field on the migrated SessionStart entries — the
    // namespace IS the event.
    for (const entry of parsed.hooks.SessionStart) {
      assert.equal(entry.event, undefined,
        'no synthetic event field — namespace [[hooks.SessionStart]] encodes the event: ' +
          JSON.stringify(entry));
    }
  });
});
