import { describe, it, expect } from 'vitest';
import { sanitizePrompt } from './prompt-sanitizer.js';

describe('sanitizePrompt', () => {
  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty string unchanged', () => {
      expect(sanitizePrompt('')).toBe('');
    });

    it('returns undefined/null-ish input unchanged', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(sanitizePrompt(undefined as any)).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(sanitizePrompt(null as any)).toBeNull();
    });

    it('preserves clean content with no patterns', () => {
      const clean = 'This is a clean prompt.\nIt has no interactive patterns.\n\nJust normal text.';
      expect(sanitizePrompt(clean)).toBe(clean.trim());
    });
  });

  // ─── @file: references ───────────────────────────────────────────────────

  describe('@file: references', () => {
    it('strips lines containing @file: references', () => {
      const input = 'Before\nLoad @file:path/to/context.md for context\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toContain('@file:');
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('strips @file: with various path formats', () => {
      const input = [
        '@file:simple.md',
        '@file:./relative/path.md',
        '@file:/absolute/path/to/file.md',
        '@file:~/.claude/get-shit-done/workflows/execute-plan.md',
      ].join('\n');
      expect(sanitizePrompt(input)).toBe('');
    });
  });

  // ─── /gsd- skill commands ────────────────────────────────────────────────

  describe('/gsd- skill commands', () => {
    it('strips lines containing /gsd- commands', () => {
      const input = 'Before\nRun /gsd-execute-plan to proceed\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toContain('/gsd-');
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('strips various /gsd- skill formats', () => {
      const input = [
        'Use /gsd-research-phase',
        'Then /gsd-plan-phase --auto',
        'Finally /gsd-verify-phase',
      ].join('\n');
      expect(sanitizePrompt(input)).toBe('');
    });

    it('strips legacy /gsd: slash commands for backward compatibility', () => {
      const input = 'Before\nRun /gsd:execute-plan to proceed\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toContain('/gsd:');
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('strips various legacy /gsd: command formats', () => {
      const input = [
        'Use /gsd:research-phase',
        'Then /gsd:plan-phase --auto',
        'Finally /gsd:verify-phase',
      ].join('\n');
      expect(sanitizePrompt(input)).toBe('');
    });
  });

  // ─── AskUserQuestion() calls ─────────────────────────────────────────────

  describe('AskUserQuestion() calls', () => {
    it('strips AskUserQuestion lines', () => {
      const input = 'Before\nAskUserQuestion("What should we do?")\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toContain('AskUserQuestion');
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('strips AskUserQuestion with various argument styles', () => {
      const input = [
        'AskUserQuestion("simple")',
        'AskUserQuestion( "with spaces" )',
        '  AskUserQuestion("indented")',
        'Use AskUserQuestion("inline") here',
      ].join('\n');
      expect(sanitizePrompt(input)).toBe('');
    });
  });

  // ─── SlashCommand() calls ────────────────────────────────────────────────

  describe('SlashCommand() calls', () => {
    it('strips SlashCommand lines', () => {
      const input = 'Before\nSlashCommand("/gsd:execute")\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toContain('SlashCommand');
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('strips SlashCommand with various forms', () => {
      const input = [
        'SlashCommand("proceed")',
        'SlashCommand( "next" )',
        '  SlashCommand("indented")',
      ].join('\n');
      expect(sanitizePrompt(input)).toBe('');
    });
  });

  // ─── STOP directives ────────────────────────────────────────────────────

  describe('STOP directives', () => {
    it('strips "STOP and wait" lines', () => {
      const input = 'Before\nSTOP and wait for user input\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toContain('STOP');
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('strips bare STOP lines', () => {
      const input = 'Before\nSTOP\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toContain('STOP');
    });

    it('strips STOP with trailing punctuation', () => {
      const input = 'Before\nSTOP.\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toContain('STOP');
    });

    it('strips "STOP here" and "STOP now"', () => {
      const input = 'STOP here\nSTOP now\nSTOP and ask';
      const result = sanitizePrompt(input);
      expect(result).toBe('');
    });

    it('preserves STOP in normal prose (not as directive)', () => {
      const input = 'Do not stop the build process.';
      const result = sanitizePrompt(input);
      // "stop" in lowercase in normal prose should be preserved
      expect(result).toContain('stop the build');
    });
  });

  // ─── 'wait for user' / 'ask the user' instructions ──────────────────────

  describe('wait for user / ask the user', () => {
    it('strips "wait for user" lines', () => {
      const input = 'Before\nWait for user confirmation before proceeding\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toMatch(/wait for.*user/i);
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('strips "wait for the user" lines', () => {
      const input = 'Before\nWait for the user to respond\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toMatch(/wait for the user/i);
    });

    it('strips "ask the user" lines', () => {
      const input = 'Before\nAsk the user for clarification\nAfter';
      const result = sanitizePrompt(input);
      expect(result).not.toMatch(/ask the user/i);
      expect(result).toContain('Before');
      expect(result).toContain('After');
    });

    it('is case-insensitive for wait/ask patterns', () => {
      const input = [
        'WAIT FOR USER input',
        'wait for user approval',
        'ASK THE USER what to do',
        'ask the user for feedback',
      ].join('\n');
      expect(sanitizePrompt(input)).toBe('');
    });
  });

  // ─── Multiple patterns in one string ─────────────────────────────────────

  describe('multiple patterns in one string', () => {
    it('strips all pattern types from a mixed prompt', () => {
      const input = [
        '## Research Phase',
        '',
        'Investigate the codebase using @file:context.md for context.',
        '',
        'When done, run /gsd-plan-phase to proceed.',
        '',
        'If unclear, AskUserQuestion("What should I focus on?")',
        '',
        'STOP and wait for user input.',
        '',
        'Use SlashCommand("next") to continue.',
        '',
        'Wait for user confirmation before executing.',
        '',
        'This line is clean and should remain.',
      ].join('\n');

      const result = sanitizePrompt(input);
      expect(result).not.toContain('@file:');
      expect(result).not.toContain('/gsd-');
      expect(result).not.toContain('/gsd:');
      expect(result).not.toContain('AskUserQuestion');
      expect(result).not.toContain('SlashCommand');
      expect(result).not.toMatch(/\bSTOP\b/);
      expect(result).not.toMatch(/wait for user/i);
      expect(result).toContain('## Research Phase');
      expect(result).toContain('This line is clean and should remain.');
    });
  });

  // ─── Blank line collapsing ───────────────────────────────────────────────

  describe('blank line collapsing', () => {
    it('collapses 3+ consecutive blank lines to 2', () => {
      const input = 'Line 1\n\n\n\n\nLine 2';
      const result = sanitizePrompt(input);
      // After trim(), the result should have at most 2 consecutive newlines
      expect(result).not.toMatch(/\n{3,}/);
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });

    it('collapses blanks left by stripped lines', () => {
      const input = [
        'Before',
        '',
        'AskUserQuestion("something")',
        '',
        'After',
      ].join('\n');
      const result = sanitizePrompt(input);
      expect(result).toBe('Before\n\nAfter');
    });
  });
});
