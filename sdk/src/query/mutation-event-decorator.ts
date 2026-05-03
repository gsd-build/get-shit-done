import type { QueryRegistry } from './registry.js';
import type { GSDEventStream } from '../event-stream.js';
import type { QueryHandler } from './utils.js';
import { buildMutationEvent } from './mutation-event-mapper.js';

export function decorateMutationsWithEvents(
  registry: QueryRegistry,
  mutationCommands: Set<string>,
  eventStream: GSDEventStream,
  correlationSessionId: string,
): void {
  for (const cmd of mutationCommands) {
    const original = registry.getHandler(cmd);
    if (!original) continue;
    registry.register(cmd, async (args: string[], projectDir: string, workstream?: string) => {
      const result = await original(args, projectDir, workstream);
      try {
        const event = buildMutationEvent(correlationSessionId, cmd, args, result);
        eventStream.emitEvent(event);
      } catch {
        // Event emission is fire-and-forget; never block mutation success
      }
      return result;
    });
  }
}

export function countDecoratedMutationHandlers(
  registry: QueryRegistry,
  mutationCommands: Set<string>,
): number {
  let count = 0;
  for (const cmd of mutationCommands) {
    if (registry.getHandler(cmd)) count++;
  }
  return count;
}
