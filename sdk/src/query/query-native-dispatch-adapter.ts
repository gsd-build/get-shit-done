import type { QueryRegistry } from './registry.js';
import type { QueryResult } from './utils.js';

export interface QueryNativeDispatchAdapter {
  dispatch(command: string, args: string[]): Promise<QueryResult>;
}

export function createQueryNativeDispatchAdapter(
  registry: QueryRegistry,
  projectDir: string,
  ws?: string,
): QueryNativeDispatchAdapter {
  return {
    dispatch: (command, args) => registry.dispatch(command, args, projectDir, ws),
  };
}
