import type { QueryDispatchResult } from './query-dispatch-contract.js';
import { validationError } from './query-error-taxonomy.js';
import { dispatchFailure } from './query-dispatch-result-builder.js';

export interface DispatchInputValidationResult {
  queryArgs: string[];
  pickField?: string;
  error?: QueryDispatchResult;
}

export function validateQueryDispatchInput(queryArgv: string[]): DispatchInputValidationResult {
  const queryArgs = [...queryArgv];
  const pickIdx = queryArgs.indexOf('--pick');
  if (pickIdx !== -1) {
    if (pickIdx + 1 >= queryArgs.length) {
      return {
        queryArgs,
        error: dispatchFailure(validationError({
          message: 'Error: --pick requires a field name',
          details: { field: '--pick', reason: 'missing_value' },
        })),
      };
    }
    const pickField = queryArgs[pickIdx + 1];
    queryArgs.splice(pickIdx, 2);
    if (queryArgs.length === 0 || !queryArgs[0]) {
      return {
        queryArgs,
        error: dispatchFailure(validationError({
          message: 'Error: "gsd-sdk query" requires a command',
          details: { reason: 'missing_command' },
        })),
      };
    }
    return { queryArgs, pickField };
  }

  if (queryArgs.length === 0 || !queryArgs[0]) {
    return {
      queryArgs,
      error: dispatchFailure(validationError({
        message: 'Error: "gsd-sdk query" requires a command',
        details: { reason: 'missing_command' },
      })),
    };
  }

  return { queryArgs };
}
