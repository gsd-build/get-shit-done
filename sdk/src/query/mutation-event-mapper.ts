import {
  GSDEventType,
  type GSDEvent,
  type GSDStateMutationEvent,
  type GSDConfigMutationEvent,
  type GSDFrontmatterMutationEvent,
  type GSDGitCommitEvent,
  type GSDTemplateFillEvent,
} from '../types.js';
import type { QueryResult } from './utils.js';

interface EventBase {
  timestamp: string;
  sessionId: string;
}

type EventFamily =
  | 'template'
  | 'git'
  | 'frontmatter'
  | 'config'
  | 'validate'
  | 'phase'
  | 'state'
  | 'default';

const FAMILY_RULES: Array<{ family: EventFamily; matches: (cmd: string) => boolean }> = [
  { family: 'template', matches: (cmd) => cmd.startsWith('template.') || cmd.startsWith('template ') },
  { family: 'git', matches: (cmd) => cmd === 'commit' || cmd === 'check-commit' || cmd === 'commit-to-subrepo' },
  { family: 'frontmatter', matches: (cmd) => cmd.startsWith('frontmatter.') || cmd.startsWith('frontmatter ') },
  { family: 'config', matches: (cmd) => cmd.startsWith('config-') },
  { family: 'validate', matches: (cmd) => cmd.startsWith('validate.') || cmd.startsWith('validate ') },
  { family: 'phase', matches: (cmd) => cmd.startsWith('phase.') || cmd.startsWith('phase ') || cmd.startsWith('phases.') || cmd.startsWith('phases ') },
  { family: 'state', matches: (cmd) => cmd.startsWith('state.') || cmd.startsWith('state ') },
];

function resolveFamily(cmd: string): EventFamily {
  return FAMILY_RULES.find((rule) => rule.matches(cmd))?.family ?? 'default';
}

export function buildMutationEvent(
  correlationSessionId: string,
  cmd: string,
  args: string[],
  result: QueryResult,
): GSDEvent {
  const base: EventBase = {
    timestamp: new Date().toISOString(),
    sessionId: correlationSessionId,
  };

  switch (resolveFamily(cmd)) {
    case 'template': {
      const data = result.data as Record<string, unknown> | null;
      return {
        ...base,
        type: GSDEventType.TemplateFill,
        templateType: (data?.template as string) ?? args[0] ?? '',
        path: (data?.path as string) ?? args[1] ?? '',
        created: (data?.created as boolean) ?? false,
      } as GSDTemplateFillEvent;
    }
    case 'git': {
      const data = result.data as Record<string, unknown> | null;
      return {
        ...base,
        type: GSDEventType.GitCommit,
        hash: (data?.hash as string) ?? null,
        committed: (data?.committed as boolean) ?? false,
        reason: (data?.reason as string) ?? '',
      } as GSDGitCommitEvent;
    }
    case 'frontmatter':
      return {
        ...base,
        type: GSDEventType.FrontmatterMutation,
        command: cmd,
        file: args[0] ?? '',
        fields: args.slice(1),
        success: true,
      } as GSDFrontmatterMutationEvent;
    case 'config':
    case 'validate':
      return {
        ...base,
        type: GSDEventType.ConfigMutation,
        command: cmd,
        key: args[0] ?? '',
        success: true,
      } as GSDConfigMutationEvent;
    case 'phase':
    case 'state':
    case 'default':
      return {
        ...base,
        type: GSDEventType.StateMutation,
        command: cmd,
        fields: args.slice(0, 2),
        success: true,
      } as GSDStateMutationEvent;
  }
}
