/**
 * GENERATED FILE — command alias expansion for state.*, verify.*, init.*, phase.*, phases.*, validate.*, and roadmap.* pilots.
 * Source: sdk/src/query/command-manifest.{state,verify,init,phase,phases,validate,roadmap}.ts
 */

export interface FamilyCommandAlias {
  canonical: string;
  aliases: string[];
  subcommand: string;
  mutation: boolean;
}

export const STATE_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'state.load', aliases: [], subcommand: 'load', mutation: false },
  { canonical: 'state.json', aliases: ['state json'], subcommand: 'json', mutation: false },
  { canonical: 'state.get', aliases: ['state get'], subcommand: 'get', mutation: false },
  { canonical: 'state.update', aliases: ['state update'], subcommand: 'update', mutation: true },
  { canonical: 'state.patch', aliases: ['state patch'], subcommand: 'patch', mutation: true },
  { canonical: 'state.begin-phase', aliases: ['state begin-phase'], subcommand: 'begin-phase', mutation: true },
  { canonical: 'state.advance-plan', aliases: ['state advance-plan'], subcommand: 'advance-plan', mutation: true },
  { canonical: 'state.record-metric', aliases: ['state record-metric'], subcommand: 'record-metric', mutation: true },
  { canonical: 'state.update-progress', aliases: ['state update-progress'], subcommand: 'update-progress', mutation: true },
  { canonical: 'state.add-decision', aliases: ['state add-decision'], subcommand: 'add-decision', mutation: true },
  { canonical: 'state.add-blocker', aliases: ['state add-blocker'], subcommand: 'add-blocker', mutation: true },
  { canonical: 'state.resolve-blocker', aliases: ['state resolve-blocker'], subcommand: 'resolve-blocker', mutation: true },
  { canonical: 'state.record-session', aliases: ['state record-session'], subcommand: 'record-session', mutation: true },
  { canonical: 'state.signal-waiting', aliases: ['state signal-waiting'], subcommand: 'signal-waiting', mutation: true },
  { canonical: 'state.signal-resume', aliases: ['state signal-resume'], subcommand: 'signal-resume', mutation: true },
  { canonical: 'state.planned-phase', aliases: ['state planned-phase'], subcommand: 'planned-phase', mutation: true },
  { canonical: 'state.validate', aliases: ['state validate'], subcommand: 'validate', mutation: false },
  { canonical: 'state.sync', aliases: ['state sync'], subcommand: 'sync', mutation: true },
  { canonical: 'state.prune', aliases: ['state prune'], subcommand: 'prune', mutation: true },
  { canonical: 'state.milestone-switch', aliases: ['state milestone-switch'], subcommand: 'milestone-switch', mutation: true },
  { canonical: 'state.add-roadmap-evolution', aliases: ['state add-roadmap-evolution'], subcommand: 'add-roadmap-evolution', mutation: true },
] as const;

export const VERIFY_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'verify.plan-structure', aliases: ['verify plan-structure'], subcommand: 'plan-structure', mutation: false },
  { canonical: 'verify.phase-completeness', aliases: ['verify phase-completeness'], subcommand: 'phase-completeness', mutation: false },
  { canonical: 'verify.references', aliases: ['verify references'], subcommand: 'references', mutation: false },
  { canonical: 'verify.commits', aliases: ['verify commits'], subcommand: 'commits', mutation: false },
  { canonical: 'verify.artifacts', aliases: ['verify artifacts'], subcommand: 'artifacts', mutation: false },
  { canonical: 'verify.key-links', aliases: ['verify key-links'], subcommand: 'key-links', mutation: false },
  { canonical: 'verify.schema-drift', aliases: ['verify schema-drift'], subcommand: 'schema-drift', mutation: false },
  { canonical: 'verify.codebase-drift', aliases: ['verify codebase-drift'], subcommand: 'codebase-drift', mutation: false },
] as const;

export const INIT_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'init.execute-phase', aliases: ['init execute-phase'], subcommand: 'execute-phase', mutation: false },
  { canonical: 'init.plan-phase', aliases: ['init plan-phase'], subcommand: 'plan-phase', mutation: false },
  { canonical: 'init.new-project', aliases: ['init new-project'], subcommand: 'new-project', mutation: false },
  { canonical: 'init.new-milestone', aliases: ['init new-milestone'], subcommand: 'new-milestone', mutation: false },
  { canonical: 'init.quick', aliases: ['init quick'], subcommand: 'quick', mutation: false },
  { canonical: 'init.ingest-docs', aliases: ['init ingest-docs'], subcommand: 'ingest-docs', mutation: false },
  { canonical: 'init.resume', aliases: ['init resume'], subcommand: 'resume', mutation: false },
  { canonical: 'init.verify-work', aliases: ['init verify-work'], subcommand: 'verify-work', mutation: false },
  { canonical: 'init.phase-op', aliases: ['init phase-op'], subcommand: 'phase-op', mutation: false },
  { canonical: 'init.todos', aliases: ['init todos'], subcommand: 'todos', mutation: false },
  { canonical: 'init.milestone-op', aliases: ['init milestone-op'], subcommand: 'milestone-op', mutation: false },
  { canonical: 'init.map-codebase', aliases: ['init map-codebase'], subcommand: 'map-codebase', mutation: false },
  { canonical: 'init.progress', aliases: ['init progress'], subcommand: 'progress', mutation: false },
  { canonical: 'init.manager', aliases: ['init manager'], subcommand: 'manager', mutation: false },
  { canonical: 'init.new-workspace', aliases: ['init new-workspace'], subcommand: 'new-workspace', mutation: false },
  { canonical: 'init.list-workspaces', aliases: ['init list-workspaces'], subcommand: 'list-workspaces', mutation: false },
  { canonical: 'init.remove-workspace', aliases: ['init remove-workspace'], subcommand: 'remove-workspace', mutation: false },
] as const;

export const PHASE_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'phase.list-plans', aliases: ['phase list-plans'], subcommand: 'list-plans', mutation: false },
  { canonical: 'phase.list-artifacts', aliases: ['phase list-artifacts'], subcommand: 'list-artifacts', mutation: false },
  { canonical: 'phase.next-decimal', aliases: ['phase next-decimal'], subcommand: 'next-decimal', mutation: false },
  { canonical: 'phase.add', aliases: ['phase add'], subcommand: 'add', mutation: true },
  { canonical: 'phase.add-batch', aliases: ['phase add-batch'], subcommand: 'add-batch', mutation: true },
  { canonical: 'phase.insert', aliases: ['phase insert'], subcommand: 'insert', mutation: true },
  { canonical: 'phase.remove', aliases: ['phase remove'], subcommand: 'remove', mutation: true },
  { canonical: 'phase.complete', aliases: ['phase complete'], subcommand: 'complete', mutation: true },
  { canonical: 'phase.scaffold', aliases: ['phase scaffold'], subcommand: 'scaffold', mutation: true },
] as const;

export const PHASES_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'phases.list', aliases: ['phases list'], subcommand: 'list', mutation: false },
  { canonical: 'phases.clear', aliases: ['phases clear'], subcommand: 'clear', mutation: true },
  { canonical: 'phases.archive', aliases: ['phases archive'], subcommand: 'archive', mutation: true },
] as const;

export const VALIDATE_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'validate.consistency', aliases: ['validate consistency'], subcommand: 'consistency', mutation: false },
  { canonical: 'validate.health', aliases: ['validate health'], subcommand: 'health', mutation: false },
  { canonical: 'validate.agents', aliases: ['validate agents'], subcommand: 'agents', mutation: false },
  { canonical: 'validate.context', aliases: ['validate context'], subcommand: 'context', mutation: false },
] as const;

export const ROADMAP_COMMAND_ALIASES: readonly FamilyCommandAlias[] = [
  { canonical: 'roadmap.analyze', aliases: ['roadmap analyze'], subcommand: 'analyze', mutation: false },
  { canonical: 'roadmap.get-phase', aliases: ['roadmap get-phase'], subcommand: 'get-phase', mutation: false },
  { canonical: 'roadmap.update-plan-progress', aliases: ['roadmap update-plan-progress'], subcommand: 'update-plan-progress', mutation: true },
  { canonical: 'roadmap.annotate-dependencies', aliases: ['roadmap annotate-dependencies'], subcommand: 'annotate-dependencies', mutation: true },
] as const;

export const STATE_SUBCOMMANDS = new Set<string>(STATE_COMMAND_ALIASES.map((entry) => entry.subcommand));
export const VERIFY_SUBCOMMANDS = new Set<string>(VERIFY_COMMAND_ALIASES.map((entry) => entry.subcommand));
export const INIT_SUBCOMMANDS = new Set<string>(INIT_COMMAND_ALIASES.map((entry) => entry.subcommand));
export const PHASE_SUBCOMMANDS = new Set<string>(PHASE_COMMAND_ALIASES.map((entry) => entry.subcommand));
export const PHASES_SUBCOMMANDS = new Set<string>(PHASES_COMMAND_ALIASES.map((entry) => entry.subcommand));
export const VALIDATE_SUBCOMMANDS = new Set<string>(VALIDATE_COMMAND_ALIASES.map((entry) => entry.subcommand));
export const ROADMAP_SUBCOMMANDS = new Set<string>(ROADMAP_COMMAND_ALIASES.map((entry) => entry.subcommand));

