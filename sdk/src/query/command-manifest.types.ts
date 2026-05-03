export type CommandFamily = 'state' | 'verify' | 'init' | 'phase' | 'phases' | 'validate' | 'roadmap';

export type OutputMode = 'json' | 'raw';

export interface CommandManifestEntry {
  family: CommandFamily;
  canonical: string;
  aliases: string[];
  mutation: boolean;
  outputMode: OutputMode;
  /** Optional explicit handler key (defaults to canonical). */
  handlerKey?: string;
}
