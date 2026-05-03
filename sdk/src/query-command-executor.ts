export interface QueryCommandExecutorDeps {
  nativeMatch: (command: string, args: string[]) => { cmd: string; args: string[] } | null;
  execute: (input: {
    legacyCommand: string;
    legacyArgs: string[];
    registryCommand: string;
    registryArgs: string[];
    mode: 'json' | 'raw';
  }) => Promise<unknown>;
}

/**
 * Module owning command normalization + execution payload shape.
 */
export class QueryCommandExecutor {
  constructor(private readonly deps: QueryCommandExecutorDeps) {}

  async exec(command: string, args: string[], mode: 'json' | 'raw'): Promise<unknown> {
    const matched = this.deps.nativeMatch(command, args);
    const registryCommand = matched?.cmd ?? command;
    const registryArgs = matched?.args ?? args;

    return this.deps.execute({
      legacyCommand: command,
      legacyArgs: args,
      registryCommand,
      registryArgs,
      mode,
    });
  }
}
