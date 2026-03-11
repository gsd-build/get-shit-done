/**
 * @gsd/server - GSD Dashboard Server Entry Point
 *
 * This module will serve as the entry point for the Express + Socket.IO server.
 * Socket.IO setup will be added in Plan 02.
 */

import {
  EVENTS,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type TokenEvent,
} from '@gsd/events';

// Log available events to verify import works
console.log('GSD Server starting with events:', Object.keys(EVENTS));

// Type verification - ensure types are importable
type ServerEvents = ServerToClientEvents;
type ClientEvents = ClientToServerEvents;

// Example event payload (for type verification)
const exampleToken: TokenEvent = {
  agentId: 'agent-123',
  token: 'Hello',
  sequence: 0,
};

console.log('Example token event:', exampleToken);
console.log('Server ready for Socket.IO setup (Plan 02)');
