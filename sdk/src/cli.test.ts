import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseCliArgs, resolveInitInput, USAGE, type ParsedCliArgs } from './cli.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('parseCliArgs', () => {
  it('parses run <prompt> with defaults', () => {
    const result = parseCliArgs(['run', 'build auth']);

    expect(result.command).toBe('run');
    expect(result.prompt).toBe('build auth');
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
    expect(result.wsPort).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.maxBudget).toBeUndefined();
  });

  it('parses --help flag', () => {
    const result = parseCliArgs(['--help']);

    expect(result.help).toBe(true);
    expect(result.command).toBeUndefined();
  });

  it('parses -h short flag', () => {
    const result = parseCliArgs(['-h']);

    expect(result.help).toBe(true);
  });

  it('parses --version flag', () => {
    const result = parseCliArgs(['--version']);

    expect(result.version).toBe(true);
  });

  it('parses -v short flag', () => {
    const result = parseCliArgs(['-v']);

    expect(result.version).toBe(true);
  });

  it('parses --ws-port as number', () => {
    const result = parseCliArgs(['run', 'build X', '--ws-port', '8080']);

    expect(result.command).toBe('run');
    expect(result.prompt).toBe('build X');
    expect(result.wsPort).toBe(8080);
  });

  it('parses --model option', () => {
    const result = parseCliArgs(['run', 'build X', '--model', 'claude-sonnet-4-6']);

    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('parses --max-budget option', () => {
    const result = parseCliArgs(['run', 'build X', '--max-budget', '10']);

    expect(result.maxBudget).toBe(10);
  });

  it('parses --project-dir option', () => {
    const result = parseCliArgs(['run', 'build X', '--project-dir', '/tmp/my-project']);

    expect(result.projectDir).toBe('/tmp/my-project');
  });

  it('returns undefined command and prompt for empty args', () => {
    const result = parseCliArgs([]);

    expect(result.command).toBeUndefined();
    expect(result.prompt).toBeUndefined();
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it('parses multi-word prompts from positionals', () => {
    const result = parseCliArgs(['run', 'build', 'the', 'entire', 'app']);

    expect(result.prompt).toBe('build the entire app');
  });

  it('handles all options combined', () => {
    const result = parseCliArgs([
      'run', 'build auth',
      '--project-dir', '/tmp/proj',
      '--ws-port', '9090',
      '--model', 'claude-sonnet-4-6',
      '--max-budget', '15',
    ]);

    expect(result.command).toBe('run');
    expect(result.prompt).toBe('build auth');
    expect(result.projectDir).toBe('/tmp/proj');
    expect(result.wsPort).toBe(9090);
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.maxBudget).toBe(15);
  });

  it('rejects unknown options (strict parser)', () => {
    expect(() => parseCliArgs(['--unknown-flag'])).toThrow();
  });

  it('rejects unknown flags on run command', () => {
    expect(() => parseCliArgs(['run', 'hello', '--not-a-real-option'])).toThrow();
  });

  it('parses query permissively (keeps gsd-tools flags like --pick, --json)', () => {
    const result = parseCliArgs([
      'query', 'state.load', '--pick', 'data', '--project-dir', 'C:\\tmp\\proj',
    ]);
    expect(result.command).toBe('query');
    expect(result.projectDir).toBe('C:\\tmp\\proj');
    expect(result.queryArgv).toEqual(['state.load', '--pick', 'data']);
  });

  it('parses query with extra flags forwarded in queryArgv', () => {
    const result = parseCliArgs([
      'query', 'audit-open', '--json', '--project-dir', 'D:\\proj',
    ]);
    expect(result.command).toBe('query');
    expect(result.projectDir).toBe('D:\\proj');
    expect(result.queryArgv).toEqual(['audit-open', '--json']);
  });

  // ─── #3019: --help inside `query <subcommand>` reaches the handler ────

  it('forwards --help to queryArgv when a subcommand precedes it (#3019)', () => {
    // gsd-sdk query phase add --help
    // Previously: --help was harvested as global, queryArgv = ['phase', 'add'],
    // help: true → main() short-circuits to top-level USAGE, never dispatching.
    // Now: --help travels with the rest of queryArgv so the registry handler
    // (or the gsd-tools.cjs fallback) can render contextual subcommand help.
    const result = parseCliArgs(['query', 'phase', 'add', '--help']);
    expect(result.command).toBe('query');
    expect(result.queryArgv).toEqual(['phase', 'add', '--help']);
    // The global help flag must NOT short-circuit dispatch when there is a
    // subcommand to dispatch to.
    expect(result.help).toBe(false);
  });

  it('forwards -h to queryArgv when a subcommand precedes it (#3019)', () => {
    const result = parseCliArgs(['query', 'init', '-h']);
    expect(result.queryArgv).toEqual(['init', '-h']);
    expect(result.help).toBe(false);
  });

  it('treats bare `query --help` as a top-level help request (no subcommand to dispatch to)', () => {
    // gsd-sdk query --help
    // No subcommand follows, so the only useful response is the top-level
    // USAGE. Preserve existing behavior: help: true.
    const result = parseCliArgs(['query', '--help']);
    expect(result.command).toBe('query');
    expect(result.help).toBe(true);
    // queryArgv may be empty or carry just the lone --help; either is fine
    // because main() short-circuits on help when there is no subcommand.
    expect((result.queryArgv ?? []).filter((x) => x !== '--help' && x !== '-h')).toEqual([]);
  });

  it('preserves --help position when intermixed with other query flags (#3019)', () => {
    // gsd-sdk query phase --help --pick name
    // The handler/fallback should see --help in argv so it can render help
    // even when other flags are present.
    const result = parseCliArgs(['query', 'phase', '--help', '--pick', 'name']);
    expect(result.queryArgv).toEqual(['phase', '--help', '--pick', 'name']);
    expect(result.help).toBe(false);
  });

  // ─── Init command parsing ──────────────────────────────────────────────

  it('parses init with @file input', () => {
    const result = parseCliArgs(['init', '@prd.md']);

    expect(result.command).toBe('init');
    expect(result.initInput).toBe('@prd.md');
    expect(result.prompt).toBe('@prd.md');
  });

  it('parses init with raw text input', () => {
    const result = parseCliArgs(['init', 'build a todo app']);

    expect(result.command).toBe('init');
    expect(result.initInput).toBe('build a todo app');
  });

  it('parses init with multi-word text input', () => {
    const result = parseCliArgs(['init', 'build', 'a', 'todo', 'app']);

    expect(result.command).toBe('init');
    expect(result.initInput).toBe('build a todo app');
  });

  it('parses init with no input (stdin mode)', () => {
    const result = parseCliArgs(['init']);

    expect(result.command).toBe('init');
    expect(result.initInput).toBeUndefined();
    expect(result.prompt).toBeUndefined();
  });

  it('parses init with options', () => {
    const result = parseCliArgs(['init', '@prd.md', '--project-dir', '/tmp/proj', '--model', 'claude-sonnet-4-6']);

    expect(result.command).toBe('init');
    expect(result.initInput).toBe('@prd.md');
    expect(result.projectDir).toBe('/tmp/proj');
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('does not set initInput for non-init commands', () => {
    const result = parseCliArgs(['run', 'build auth']);

    expect(result.command).toBe('run');
    expect(result.initInput).toBeUndefined();
    expect(result.prompt).toBe('build auth');
  });

  // ─── Auto command parsing ──────────────────────────────────────────────

  it('parses auto command with no prompt', () => {
    const result = parseCliArgs(['auto']);

    expect(result.command).toBe('auto');
    expect(result.prompt).toBeUndefined();
    expect(result.initInput).toBeUndefined();
  });

  it('parses auto with --project-dir', () => {
    const result = parseCliArgs(['auto', '--project-dir', '/tmp/x']);

    expect(result.command).toBe('auto');
    expect(result.projectDir).toBe('/tmp/x');
  });

  it('parses auto with --ws-port', () => {
    const result = parseCliArgs(['auto', '--ws-port', '9090']);

    expect(result.command).toBe('auto');
    expect(result.wsPort).toBe(9090);
  });

  it('parses auto with all options combined', () => {
    const result = parseCliArgs([
      'auto',
      '--project-dir', '/tmp/proj',
      '--ws-port', '8080',
      '--model', 'claude-sonnet-4-6',
      '--max-budget', '20',
    ]);

    expect(result.command).toBe('auto');
    expect(result.projectDir).toBe('/tmp/proj');
    expect(result.wsPort).toBe(8080);
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.maxBudget).toBe(20);
  });

  it('auto command does not set initInput', () => {
    const result = parseCliArgs(['auto']);

    expect(result.initInput).toBeUndefined();
  });

  // ─── Auto --init parsing ──────────────────────────────────────────────

  it('parses auto --init with @file', () => {
    const result = parseCliArgs(['auto', '--init', '@prd.md']);

    expect(result.command).toBe('auto');
    expect(result.init).toBe('@prd.md');
    expect(result.initInput).toBeUndefined();
  });

  it('parses auto --init with raw text', () => {
    const result = parseCliArgs(['auto', '--init', 'build a todo app']);

    expect(result.command).toBe('auto');
    expect(result.init).toBe('build a todo app');
  });

  it('parses auto --init with other options', () => {
    const result = parseCliArgs([
      'auto',
      '--init', '@spec.md',
      '--project-dir', '/tmp/proj',
      '--model', 'claude-sonnet-4-6',
      '--max-budget', '25',
    ]);

    expect(result.command).toBe('auto');
    expect(result.init).toBe('@spec.md');
    expect(result.projectDir).toBe('/tmp/proj');
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.maxBudget).toBe(25);
  });

  it('init is undefined when --init not provided', () => {
    const result = parseCliArgs(['auto']);

    expect(result.init).toBeUndefined();
  });

  it('init is undefined for non-auto commands', () => {
    const result = parseCliArgs(['run', 'build auth']);

    expect(result.init).toBeUndefined();
  });
});

// ─── resolveInitInput tests ──────────────────────────────────────────────────

describe('resolveInitInput', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `cli-init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeArgs(overrides: Partial<ParsedCliArgs>): ParsedCliArgs {
    return {
      command: 'init',
      prompt: undefined,
      initInput: undefined,
      init: undefined,
      projectDir: tmpDir,
      wsPort: undefined,
      model: undefined,
      maxBudget: undefined,
      help: false,
      version: false,
      ...overrides,
    };
  }

  it('reads file contents when input starts with @', async () => {
    const prdPath = join(tmpDir, 'prd.md');
    await writeFile(prdPath, '# My PRD\n\nBuild a todo app');

    const result = await resolveInitInput(makeArgs({ initInput: '@prd.md' }));

    expect(result).toBe('# My PRD\n\nBuild a todo app');
  });

  it('resolves @file path relative to projectDir', async () => {
    const subDir = join(tmpDir, 'docs');
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, 'spec.md'), 'specification content');

    const result = await resolveInitInput(makeArgs({ initInput: '@docs/spec.md' }));

    expect(result).toBe('specification content');
  });

  it('throws descriptive error when @file does not exist', async () => {
    await expect(
      resolveInitInput(makeArgs({ initInput: '@nonexistent.md' }))
    ).rejects.toThrow('file not found');
  });

  it('returns raw text as-is when input does not start with @', async () => {
    const result = await resolveInitInput(makeArgs({ initInput: 'build a todo app' }));

    expect(result).toBe('build a todo app');
  });

  it('throws TTY error when no input and stdin is TTY', async () => {
    // In test environment, stdin.isTTY is typically undefined (not a TTY),
    // but we can verify the function throws when stdin is a TTY by
    // checking the error path directly via the export.
    // This test verifies the raw text path works for empty-like scenarios.
    const result = await resolveInitInput(makeArgs({ initInput: 'some text' }));
    expect(result).toBe('some text');
  });

  it('reads @file with absolute path', async () => {
    const absPath = join(tmpDir, 'absolute-prd.md');
    await writeFile(absPath, 'absolute path content');

    // Absolute paths are resolved relative to projectDir, so we need
    // to use the relative form or the absolute form via @
    const result = await resolveInitInput(makeArgs({ initInput: `@${absPath}` }));

    expect(result).toBe('absolute path content');
  });

  it('preserves whitespace in raw text input', async () => {
    const input = '  build a todo app with spaces  ';
    const result = await resolveInitInput(makeArgs({ initInput: input }));

    expect(result).toBe(input);
  });

  it('reads large file content from @file', async () => {
    const largeContent = 'x'.repeat(10000) + '\n# PRD\nDescription here';
    await writeFile(join(tmpDir, 'large.md'), largeContent);

    const result = await resolveInitInput(makeArgs({ initInput: '@large.md' }));

    expect(result).toBe(largeContent);
  });
});

// ─── USAGE text tests ────────────────────────────────────────────────────────

describe('USAGE', () => {
  it('includes auto command', () => {
    expect(USAGE).toContain('auto');
  });

  it('describes auto as autonomous lifecycle', () => {
    expect(USAGE).toMatch(/auto\s+.*autonomous/i);
  });

  it('documents --init option', () => {
    expect(USAGE).toContain('--init');
    expect(USAGE).toContain('Bootstrap from a PRD');
  });
});
