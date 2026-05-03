import { describe, it, expect, vi } from 'vitest';
import { QueryRegistry } from './registry.js';
import { decorateMutationsWithEvents } from './mutation-event-decorator.js';

describe('decorateMutationsWithEvents', () => {
  it('wraps registered mutation handler and emits event', async () => {
    const registry = new QueryRegistry();
    const eventStream = { emitEvent: vi.fn() } as unknown as import('../event-stream.js').GSDEventStream;

    registry.register('template.fill', async () => ({ data: { template: 'phase', path: 'x', created: true } }));

    decorateMutationsWithEvents(registry, new Set(['template.fill']), eventStream, 'sid-1');

    const result = await registry.dispatch('template.fill', ['phase', 'x'], '/tmp');
    expect(result.data).toEqual({ template: 'phase', path: 'x', created: true });
    expect(eventStream.emitEvent).toHaveBeenCalledOnce();
  });

  it('does not throw when event emission fails (fire-and-forget)', async () => {
    const registry = new QueryRegistry();
    const eventStream = {
      emitEvent: vi.fn(() => {
        throw new Error('stream down');
      }),
    } as unknown as import('../event-stream.js').GSDEventStream;

    registry.register('state.update', async () => ({ data: { ok: true } }));

    decorateMutationsWithEvents(registry, new Set(['state.update']), eventStream, 'sid-2');

    const result = await registry.dispatch('state.update', ['k', 'v'], '/tmp');
    expect(result.data).toEqual({ ok: true });
    expect(eventStream.emitEvent).toHaveBeenCalledOnce();
  });

  it('skips commands not registered in registry', async () => {
    const registry = new QueryRegistry();
    const eventStream = { emitEvent: vi.fn() } as unknown as import('../event-stream.js').GSDEventStream;

    decorateMutationsWithEvents(registry, new Set(['unknown.command']), eventStream, 'sid-3');

    await expect(registry.dispatch('unknown.command', [], '/tmp')).rejects.toThrow('Unknown command');
    expect(eventStream.emitEvent).not.toHaveBeenCalled();
  });
});
