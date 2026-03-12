import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventWriter } from '../event-writer.js';
import { IPC_PATHS } from '../types.js';
import type { IPCEvent } from '../types.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'ipc-event-writer-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('EventWriter', () => {
  it('creates the events file and parent directory on first write', async () => {
    const writer = new EventWriter(testDir);
    await writer.write('test-event', { key: 'value' });

    const content = await readFile(writer.path, 'utf-8');
    expect(content).toBeTruthy();
  });

  it('writes valid NDJSON with sequence numbers', async () => {
    const writer = new EventWriter(testDir);
    await writer.write('event-one', { a: 1 });
    await writer.write('event-two', { b: 2 });

    const content = await readFile(writer.path, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]!) as IPCEvent;
    const second = JSON.parse(lines[1]!) as IPCEvent;

    expect(first.seq).toBe(1);
    expect(first.event).toBe('event-one');
    expect(first.data).toEqual({ a: 1 });
    expect(first.timestamp).toBeTruthy();

    expect(second.seq).toBe(2);
    expect(second.event).toBe('event-two');
    expect(second.data).toEqual({ b: 2 });
  });

  it('tracks sequence number via currentSeq', async () => {
    const writer = new EventWriter(testDir);
    expect(writer.currentSeq).toBe(0);

    await writer.write('e', {});
    expect(writer.currentSeq).toBe(1);

    await writer.write('e', {});
    expect(writer.currentSeq).toBe(2);
  });
});

describe('EventWriter worker metadata', () => {
  it('writes events with worker metadata when options provided', async () => {
    const writer = new EventWriter(testDir, { phaseNumber: 3, workerId: 'phase-3' });
    await writer.write('worker-event', { key: 'val' });

    const content = await readFile(writer.path, 'utf-8');
    const entry = JSON.parse(content.trim()) as IPCEvent;

    expect(entry.phaseNumber).toBe(3);
    expect(entry.workerId).toBe('phase-3');
  });

  it('writes events with stepName when provided', async () => {
    const writer = new EventWriter(testDir, { phaseNumber: 1, workerId: 'w1' });
    await writer.write('step-event', { x: 1 }, 'plan');

    const content = await readFile(writer.path, 'utf-8');
    const entry = JSON.parse(content.trim()) as IPCEvent;

    expect(entry.stepName).toBe('plan');
  });

  it('uses per-worker event file path when phaseNumber provided', async () => {
    const writer = new EventWriter(testDir, { phaseNumber: 5, workerId: 'phase-5' });
    const expectedPath = IPC_PATHS.workerEvents(testDir, 5);

    expect(writer.path).toBe(expectedPath);
    expect(writer.path).toContain('events-phase-5.ndjson');
  });

  it('omits worker fields when no options provided', async () => {
    const writer = new EventWriter(testDir);
    await writer.write('plain-event', { a: 1 });

    const content = await readFile(writer.path, 'utf-8');
    const entry = JSON.parse(content.trim()) as IPCEvent;

    expect(entry.phaseNumber).toBeUndefined();
    expect(entry.workerId).toBeUndefined();
    expect(entry.stepName).toBeUndefined();
  });

  it('two workers write to separate files', async () => {
    const writer1 = new EventWriter(testDir, { phaseNumber: 1, workerId: 'w1' });
    const writer2 = new EventWriter(testDir, { phaseNumber: 2, workerId: 'w2' });

    await writer1.write('event-a', { from: 1 });
    await writer2.write('event-b', { from: 2 });

    expect(writer1.path).not.toBe(writer2.path);

    const content1 = await readFile(writer1.path, 'utf-8');
    const content2 = await readFile(writer2.path, 'utf-8');

    const entry1 = JSON.parse(content1.trim()) as IPCEvent;
    const entry2 = JSON.parse(content2.trim()) as IPCEvent;

    expect(entry1.phaseNumber).toBe(1);
    expect(entry2.phaseNumber).toBe(2);
  });
});
