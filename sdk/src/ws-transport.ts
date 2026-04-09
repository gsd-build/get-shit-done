/**
 * WebSocket Transport — broadcasts GSD events as JSON over WebSocket.
 *
 * Implements TransportHandler. Starts a WebSocketServer on a given port
 * and JSON-serializes each event to all connected clients.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { GSDEvent, TransportHandler } from './types.js';

export interface WSTransportOptions {
  port: number;
}

export class WSTransport implements TransportHandler {
  private readonly port: number;
  private server: WebSocketServer | null = null;
  private closing = false;

  constructor(options: WSTransportOptions) {
    this.port = options.port;
  }

  /**
   * Start the WebSocket server on the configured port.
   * Resolves once the server is listening.
   */
  async start(): Promise<void> {
    if (this.closing) return;

    return new Promise<void>((resolve, reject) => {
      try {
        this.server = new WebSocketServer({ port: this.port });
        this.server.on('listening', () => resolve());
        this.server.on('error', (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Broadcast a GSD event as JSON to all connected clients.
   * Never throws — wraps each client.send in try/catch.
   */
  onEvent(event: GSDEvent): void {
    try {
      if (!this.server) return;

      const payload = JSON.stringify(event);

      for (const client of this.server.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(payload);
          } catch {
            // Ignore individual client send errors
          }
        }
      }
    } catch {
      // TransportHandler contract: onEvent must never throw
    }
  }

  /**
   * Close all client connections and shut down the server.
   * Safe to call before start() — sets a closing flag.
   */
  close(): void {
    this.closing = true;

    if (!this.server) return;

    // Terminate all clients
    for (const client of this.server.clients) {
      try {
        client.terminate();
      } catch {
        // Ignore client close errors
      }
    }

    // Close the server
    try {
      this.server.close();
    } catch {
      // Ignore server close errors
    }

    this.server = null;
  }
}
