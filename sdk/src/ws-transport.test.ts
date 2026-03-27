import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { WSTransport } from './ws-transport.js';
import { GSDEventType, type GSDEvent, type GSDEventBase } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBase(overrides: Partial<GSDEventBase> = {}): Omit<GSDEventBase, 'type'> {
  return {
    timestamp: '2025-06-15T14:30:45.123Z',
    sessionId: 'test-session',
    ...overrides,
  };
}

/** Connect a WS client and resolve once open. */
function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** Wait for the next message on a WS client. */
function waitForMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('message timeout')), 5000);
    ws.once('message', (data) => {
      clearTimeout(timeout);
      resolve(data.toString());
    });
  });
}

// Track transports for cleanup
const activeTransports: WSTransport[] = [];

afterEach(() => {
  for (const t of activeTransports) {
    try { t.close(); } catch { /* ignore */ }
  }
  activeTransports.length = 0;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WSTransport', () => {
  it('start() creates a server on the specified port', async () => {
    const transport = new WSTransport({ port: 0 }); // dynamic port
    activeTransports.push(transport);

    await transport.start();

    // Server is listening — we can connect a client
    const address = (transport as any).server?.address();
    expect(address).toBeTruthy();
    expect(typeof address.port).toBe('number');
    expect(address.port).toBeGreaterThan(0);
  });

  it('onEvent broadcasts JSON to connected client', async () => {
    const transport = new WSTransport({ port: 0 });
    activeTransports.push(transport);
    await transport.start();

    const address = (transport as any).server?.address();
    const client = await connectClient(address.port);

    const event: GSDEvent = {
      ...makeBase(),
      type: GSDEventType.SessionInit,
      model: 'claude-sonnet-4-20250514',
      tools: ['Read', 'Write'],
      cwd: '/tmp/test',
    } as GSDEvent;

    const msgPromise = waitForMessage(client);
    transport.onEvent(event);

    const received = await msgPromise;
    const parsed = JSON.parse(received);

    expect(parsed.type).toBe('session_init');
    expect(parsed.model).toBe('claude-sonnet-4-20250514');
    expect(parsed.tools).toEqual(['Read', 'Write']);

    client.close();
  });

  it('onEvent handles no connected clients without error', async () => {
    const transport = new WSTransport({ port: 0 });
    activeTransports.push(transport);
    await transport.start();

    // No clients connected — should not throw
    expect(() => {
      transport.onEvent({
        ...makeBase(),
        type: GSDEventType.MilestoneStart,
        phaseCount: 2,
        prompt: 'test',
      } as GSDEvent);
    }).not.toThrow();
  });

  it('close() shuts down the server', async () => {
    const transport = new WSTransport({ port: 0 });
    // Don't push to activeTransports — we close manually

    await transport.start();
    const address = (transport as any).server?.address();
    expect(address).toBeTruthy();

    transport.close();

    // Server should be null after close
    expect((transport as any).server).toBeNull();

    // Connecting should fail
    await expect(connectClient(address.port)).rejects.toThrow();
  });

  it('close() before start() does not throw', () => {
    const transport = new WSTransport({ port: 0 });
    expect(() => transport.close()).not.toThrow();
  });

  it('broadcasts to multiple connected clients', async () => {
    const transport = new WSTransport({ port: 0 });
    activeTransports.push(transport);
    await transport.start();

    const address = (transport as any).server?.address();
    const client1 = await connectClient(address.port);
    const client2 = await connectClient(address.port);

    const event: GSDEvent = {
      ...makeBase(),
      type: GSDEventType.MilestoneComplete,
      success: true,
      totalCostUsd: 5.0,
      totalDurationMs: 120000,
      phasesCompleted: 3,
    } as GSDEvent;

    const msg1Promise = waitForMessage(client1);
    const msg2Promise = waitForMessage(client2);

    transport.onEvent(event);

    const [msg1, msg2] = await Promise.all([msg1Promise, msg2Promise]);

    expect(JSON.parse(msg1).type).toBe('milestone_complete');
    expect(JSON.parse(msg2).type).toBe('milestone_complete');
    expect(JSON.parse(msg1).success).toBe(true);

    client1.close();
    client2.close();
  });
});
