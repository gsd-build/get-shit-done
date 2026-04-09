import { describe, it, expect, beforeEach } from 'vitest';
import { Writable } from 'node:stream';
import { GSDLogger } from './logger.js';
import type { LogEntry } from './logger.js';
import { PhaseType } from './types.js';

// ─── Test output capture ─────────────────────────────────────────────────────

class BufferStream extends Writable {
  lines: string[] = [];
  _write(chunk: Buffer, _encoding: string, callback: () => void): void {
    const str = chunk.toString();
    this.lines.push(...str.split('\n').filter(l => l.length > 0));
    callback();
  }
}

function parseLogEntry(line: string): LogEntry {
  return JSON.parse(line) as LogEntry;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GSDLogger', () => {
  let output: BufferStream;

  beforeEach(() => {
    output = new BufferStream();
  });

  it('outputs valid JSON on each log call', () => {
    const logger = new GSDLogger({ output, level: 'debug' });
    logger.info('test message');

    expect(output.lines).toHaveLength(1);
    expect(() => JSON.parse(output.lines[0]!)).not.toThrow();
  });

  it('includes required fields: timestamp, level, message', () => {
    const logger = new GSDLogger({ output, level: 'debug' });
    logger.info('hello world');

    const entry = parseLogEntry(output.lines[0]!);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('hello world');
  });

  it('filters messages below minimum log level', () => {
    const logger = new GSDLogger({ output, level: 'warn' });

    logger.debug('should be dropped');
    logger.info('should be dropped');
    logger.warn('should appear');
    logger.error('should appear');

    expect(output.lines).toHaveLength(2);
    expect(parseLogEntry(output.lines[0]!).level).toBe('warn');
    expect(parseLogEntry(output.lines[1]!).level).toBe('error');
  });

  it('defaults to info level filtering', () => {
    const logger = new GSDLogger({ output });

    logger.debug('dropped');
    logger.info('kept');

    expect(output.lines).toHaveLength(1);
    expect(parseLogEntry(output.lines[0]!).level).toBe('info');
  });

  it('writes to custom output stream', () => {
    const customOutput = new BufferStream();
    const logger = new GSDLogger({ output: customOutput, level: 'debug' });
    logger.info('custom');

    expect(customOutput.lines).toHaveLength(1);
    expect(output.lines).toHaveLength(0);
  });

  it('includes phase, plan, and sessionId context when set', () => {
    const logger = new GSDLogger({
      output,
      level: 'debug',
      phase: PhaseType.Execute,
      plan: 'test-plan',
      sessionId: 'sess-123',
    });

    logger.info('context test');

    const entry = parseLogEntry(output.lines[0]!);
    expect(entry.phase).toBe('execute');
    expect(entry.plan).toBe('test-plan');
    expect(entry.sessionId).toBe('sess-123');
  });

  it('includes extra data when provided', () => {
    const logger = new GSDLogger({ output, level: 'debug' });
    logger.info('with data', { count: 42, tool: 'Bash' });

    const entry = parseLogEntry(output.lines[0]!);
    expect(entry.data).toEqual({ count: 42, tool: 'Bash' });
  });

  it('omits optional fields when not set', () => {
    const logger = new GSDLogger({ output, level: 'debug' });
    logger.info('minimal');

    const entry = parseLogEntry(output.lines[0]!);
    expect(entry.phase).toBeUndefined();
    expect(entry.plan).toBeUndefined();
    expect(entry.sessionId).toBeUndefined();
    expect(entry.data).toBeUndefined();
  });

  it('supports runtime context updates via setters', () => {
    const logger = new GSDLogger({ output, level: 'debug' });

    logger.info('before');
    logger.setPhase(PhaseType.Research);
    logger.setPlan('my-plan');
    logger.setSessionId('sess-456');
    logger.info('after');

    const before = parseLogEntry(output.lines[0]!);
    const after = parseLogEntry(output.lines[1]!);

    expect(before.phase).toBeUndefined();
    expect(after.phase).toBe('research');
    expect(after.plan).toBe('my-plan');
    expect(after.sessionId).toBe('sess-456');
  });

  it('emits all four log levels correctly', () => {
    const logger = new GSDLogger({ output, level: 'debug' });

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(output.lines).toHaveLength(4);
    expect(parseLogEntry(output.lines[0]!).level).toBe('debug');
    expect(parseLogEntry(output.lines[1]!).level).toBe('info');
    expect(parseLogEntry(output.lines[2]!).level).toBe('warn');
    expect(parseLogEntry(output.lines[3]!).level).toBe('error');
  });
});
