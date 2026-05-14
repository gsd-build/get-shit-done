'use strict';

/**
 * GENERATED FILE — state.*, verify.*, init.*, phase.*, phases.*, validate.*, roadmap.*, and non-family alias/subcommand metadata for CJS routing.
 * Source: sdk/src/query/command-manifest.{state,verify,init,phase,phases,validate,roadmap,non-family}.ts
 */

const STATE_COMMAND_ALIASES = [
  {
    "canonical": "state.load",
    "aliases": [],
    "subcommand": "load",
    "mutation": false
  },
  {
    "canonical": "state.json",
    "aliases": [
      "state json"
    ],
    "subcommand": "json",
    "mutation": false
  },
  {
    "canonical": "state.get",
    "aliases": [
      "state get"
    ],
    "subcommand": "get",
    "mutation": false
  },
  {
    "canonical": "state.update",
    "aliases": [
      "state update"
    ],
    "subcommand": "update",
    "mutation": true
  },
  {
    "canonical": "state.patch",
    "aliases": [
      "state patch"
    ],
    "subcommand": "patch",
    "mutation": true
  },
  {
    "canonical": "state.begin-phase",
    "aliases": [
      "state begin-phase"
    ],
    "subcommand": "begin-phase",
    "mutation": true
  },
  {
    "canonical": "state.advance-plan",
    "aliases": [
      "state advance-plan"
    ],
    "subcommand": "advance-plan",
    "mutation": true
  },
  {
    "canonical": "state.record-metric",
    "aliases": [
      "state record-metric"
    ],
    "subcommand": "record-metric",
    "mutation": true
  },
  {
    "canonical": "state.update-progress",
    "aliases": [
      "state update-progress"
    ],
    "subcommand": "update-progress",
    "mutation": true
  },
  {
    "canonical": "state.add-decision",
    "aliases": [
      "state add-decision"
    ],
    "subcommand": "add-decision",
    "mutation": true
  },
  {
    "canonical": "state.add-blocker",
    "aliases": [
      "state add-blocker"
    ],
    "subcommand": "add-blocker",
    "mutation": true
  },
  {
    "canonical": "state.resolve-blocker",
    "aliases": [
      "state resolve-blocker"
    ],
    "subcommand": "resolve-blocker",
    "mutation": true
  },
  {
    "canonical": "state.record-session",
    "aliases": [
      "state record-session"
    ],
    "subcommand": "record-session",
    "mutation": true
  },
  {
    "canonical": "state.signal-waiting",
    "aliases": [
      "state signal-waiting"
    ],
    "subcommand": "signal-waiting",
    "mutation": true
  },
  {
    "canonical": "state.signal-resume",
    "aliases": [
      "state signal-resume"
    ],
    "subcommand": "signal-resume",
    "mutation": true
  },
  {
    "canonical": "state.planned-phase",
    "aliases": [
      "state planned-phase"
    ],
    "subcommand": "planned-phase",
    "mutation": true
  },
  {
    "canonical": "state.validate",
    "aliases": [
      "state validate"
    ],
    "subcommand": "validate",
    "mutation": false
  },
  {
    "canonical": "state.sync",
    "aliases": [
      "state sync"
    ],
    "subcommand": "sync",
    "mutation": true
  },
  {
    "canonical": "state.prune",
    "aliases": [
      "state prune"
    ],
    "subcommand": "prune",
    "mutation": true
  },
  {
    "canonical": "state.milestone-switch",
    "aliases": [
      "state milestone-switch"
    ],
    "subcommand": "milestone-switch",
    "mutation": true
  },
  {
    "canonical": "state.add-roadmap-evolution",
    "aliases": [
      "state add-roadmap-evolution"
    ],
    "subcommand": "add-roadmap-evolution",
    "mutation": true
  }
];

const VERIFY_COMMAND_ALIASES = [
  {
    "canonical": "verify.plan-structure",
    "aliases": [
      "verify plan-structure"
    ],
    "subcommand": "plan-structure",
    "mutation": false
  },
  {
    "canonical": "verify.phase-completeness",
    "aliases": [
      "verify phase-completeness"
    ],
    "subcommand": "phase-completeness",
    "mutation": false
  },
  {
    "canonical": "verify.references",
    "aliases": [
      "verify references"
    ],
    "subcommand": "references",
    "mutation": false
  },
  {
    "canonical": "verify.commits",
    "aliases": [
      "verify commits"
    ],
    "subcommand": "commits",
    "mutation": false
  },
  {
    "canonical": "verify.artifacts",
    "aliases": [
      "verify artifacts"
    ],
    "subcommand": "artifacts",
    "mutation": false
  },
  {
    "canonical": "verify.key-links",
    "aliases": [
      "verify key-links"
    ],
    "subcommand": "key-links",
    "mutation": false
  },
  {
    "canonical": "verify.schema-drift",
    "aliases": [
      "verify schema-drift"
    ],
    "subcommand": "schema-drift",
    "mutation": false
  },
  {
    "canonical": "verify.codebase-drift",
    "aliases": [
      "verify codebase-drift"
    ],
    "subcommand": "codebase-drift",
    "mutation": false
  }
];

const INIT_COMMAND_ALIASES = [
  {
    "canonical": "init.execute-phase",
    "aliases": [
      "init execute-phase"
    ],
    "subcommand": "execute-phase",
    "mutation": false
  },
  {
    "canonical": "init.plan-phase",
    "aliases": [
      "init plan-phase"
    ],
    "subcommand": "plan-phase",
    "mutation": false
  },
  {
    "canonical": "init.new-project",
    "aliases": [
      "init new-project"
    ],
    "subcommand": "new-project",
    "mutation": false
  },
  {
    "canonical": "init.new-milestone",
    "aliases": [
      "init new-milestone"
    ],
    "subcommand": "new-milestone",
    "mutation": false
  },
  {
    "canonical": "init.quick",
    "aliases": [
      "init quick"
    ],
    "subcommand": "quick",
    "mutation": false
  },
  {
    "canonical": "init.ingest-docs",
    "aliases": [
      "init ingest-docs"
    ],
    "subcommand": "ingest-docs",
    "mutation": false
  },
  {
    "canonical": "init.resume",
    "aliases": [
      "init resume"
    ],
    "subcommand": "resume",
    "mutation": false
  },
  {
    "canonical": "init.verify-work",
    "aliases": [
      "init verify-work"
    ],
    "subcommand": "verify-work",
    "mutation": false
  },
  {
    "canonical": "init.phase-op",
    "aliases": [
      "init phase-op"
    ],
    "subcommand": "phase-op",
    "mutation": false
  },
  {
    "canonical": "init.todos",
    "aliases": [
      "init todos"
    ],
    "subcommand": "todos",
    "mutation": false
  },
  {
    "canonical": "init.milestone-op",
    "aliases": [
      "init milestone-op"
    ],
    "subcommand": "milestone-op",
    "mutation": false
  },
  {
    "canonical": "init.map-codebase",
    "aliases": [
      "init map-codebase"
    ],
    "subcommand": "map-codebase",
    "mutation": false
  },
  {
    "canonical": "init.progress",
    "aliases": [
      "init progress"
    ],
    "subcommand": "progress",
    "mutation": false
  },
  {
    "canonical": "init.manager",
    "aliases": [
      "init manager"
    ],
    "subcommand": "manager",
    "mutation": false
  },
  {
    "canonical": "init.new-workspace",
    "aliases": [
      "init new-workspace"
    ],
    "subcommand": "new-workspace",
    "mutation": false
  },
  {
    "canonical": "init.list-workspaces",
    "aliases": [
      "init list-workspaces"
    ],
    "subcommand": "list-workspaces",
    "mutation": false
  },
  {
    "canonical": "init.remove-workspace",
    "aliases": [
      "init remove-workspace"
    ],
    "subcommand": "remove-workspace",
    "mutation": false
  }
];

const PHASE_COMMAND_ALIASES = [
  {
    "canonical": "phase.list-plans",
    "aliases": [
      "phase list-plans"
    ],
    "subcommand": "list-plans",
    "mutation": false
  },
  {
    "canonical": "phase.list-artifacts",
    "aliases": [
      "phase list-artifacts"
    ],
    "subcommand": "list-artifacts",
    "mutation": false
  },
  {
    "canonical": "phase.next-decimal",
    "aliases": [
      "phase next-decimal"
    ],
    "subcommand": "next-decimal",
    "mutation": false
  },
  {
    "canonical": "phase.add",
    "aliases": [
      "phase add"
    ],
    "subcommand": "add",
    "mutation": true
  },
  {
    "canonical": "phase.add-batch",
    "aliases": [
      "phase add-batch"
    ],
    "subcommand": "add-batch",
    "mutation": true
  },
  {
    "canonical": "phase.insert",
    "aliases": [
      "phase insert"
    ],
    "subcommand": "insert",
    "mutation": true
  },
  {
    "canonical": "phase.remove",
    "aliases": [
      "phase remove"
    ],
    "subcommand": "remove",
    "mutation": true
  },
  {
    "canonical": "phase.complete",
    "aliases": [
      "phase complete"
    ],
    "subcommand": "complete",
    "mutation": true
  },
  {
    "canonical": "phase.scaffold",
    "aliases": [
      "phase scaffold"
    ],
    "subcommand": "scaffold",
    "mutation": true
  }
];

const PHASES_COMMAND_ALIASES = [
  {
    "canonical": "phases.list",
    "aliases": [
      "phases list"
    ],
    "subcommand": "list",
    "mutation": false
  },
  {
    "canonical": "phases.clear",
    "aliases": [
      "phases clear"
    ],
    "subcommand": "clear",
    "mutation": true
  },
  {
    "canonical": "phases.archive",
    "aliases": [
      "phases archive"
    ],
    "subcommand": "archive",
    "mutation": true
  }
];

const VALIDATE_COMMAND_ALIASES = [
  {
    "canonical": "validate.consistency",
    "aliases": [
      "validate consistency"
    ],
    "subcommand": "consistency",
    "mutation": false
  },
  {
    "canonical": "validate.health",
    "aliases": [
      "validate health"
    ],
    "subcommand": "health",
    "mutation": false
  },
  {
    "canonical": "validate.agents",
    "aliases": [
      "validate agents"
    ],
    "subcommand": "agents",
    "mutation": false
  },
  {
    "canonical": "validate.context",
    "aliases": [
      "validate context"
    ],
    "subcommand": "context",
    "mutation": false
  }
];

const ROADMAP_COMMAND_ALIASES = [
  {
    "canonical": "roadmap.analyze",
    "aliases": [
      "roadmap analyze"
    ],
    "subcommand": "analyze",
    "mutation": false
  },
  {
    "canonical": "roadmap.get-phase",
    "aliases": [
      "roadmap get-phase"
    ],
    "subcommand": "get-phase",
    "mutation": false
  },
  {
    "canonical": "roadmap.update-plan-progress",
    "aliases": [
      "roadmap update-plan-progress"
    ],
    "subcommand": "update-plan-progress",
    "mutation": true
  },
  {
    "canonical": "roadmap.annotate-dependencies",
    "aliases": [
      "roadmap annotate-dependencies"
    ],
    "subcommand": "annotate-dependencies",
    "mutation": true
  }
];

const NON_FAMILY_COMMAND_ALIASES = [
  {
    "canonical": "agent.classify-failure",
    "aliases": [
      "agent classify-failure"
    ],
    "mutation": false
  },
  {
    "canonical": "check-commit",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "check.decision-coverage-plan",
    "aliases": [
      "check decision-coverage-plan"
    ],
    "mutation": false
  },
  {
    "canonical": "check.decision-coverage-verify",
    "aliases": [
      "check decision-coverage-verify"
    ],
    "mutation": false
  },
  {
    "canonical": "commit",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "commit-to-subrepo",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "config-ensure-section",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "config-new-project",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "config-set",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "config-set-model-profile",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "docs-init",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "frontmatter.get",
    "aliases": [],
    "mutation": false
  },
  {
    "canonical": "frontmatter.merge",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "frontmatter.set",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "frontmatter.validate",
    "aliases": [
      "frontmatter validate"
    ],
    "mutation": true
  },
  {
    "canonical": "generate-claude-md",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "generate-claude-profile",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "generate-dev-preferences",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "intel.patch-meta",
    "aliases": [
      "intel patch-meta"
    ],
    "mutation": true
  },
  {
    "canonical": "intel.snapshot",
    "aliases": [
      "intel snapshot"
    ],
    "mutation": true
  },
  {
    "canonical": "learnings.copy",
    "aliases": [
      "learnings copy"
    ],
    "mutation": true
  },
  {
    "canonical": "learnings.delete",
    "aliases": [
      "learnings delete"
    ],
    "mutation": true
  },
  {
    "canonical": "learnings.prune",
    "aliases": [
      "learnings prune"
    ],
    "mutation": true
  },
  {
    "canonical": "milestone.complete",
    "aliases": [
      "milestone complete"
    ],
    "mutation": true
  },
  {
    "canonical": "phase.mvp-mode",
    "aliases": [
      "phase mvp-mode"
    ],
    "mutation": false
  },
  {
    "canonical": "progress.bar",
    "aliases": [
      "progress bar"
    ],
    "mutation": false
  },
  {
    "canonical": "requirements.mark-complete",
    "aliases": [
      "requirements mark-complete"
    ],
    "mutation": true
  },
  {
    "canonical": "stats.json",
    "aliases": [
      "stats json"
    ],
    "mutation": false
  },
  {
    "canonical": "task.is-behavior-adding",
    "aliases": [
      "task is-behavior-adding"
    ],
    "mutation": false
  },
  {
    "canonical": "template.fill",
    "aliases": [],
    "mutation": true
  },
  {
    "canonical": "template.select",
    "aliases": [
      "template select"
    ],
    "mutation": true
  },
  {
    "canonical": "todo.complete",
    "aliases": [
      "todo complete"
    ],
    "mutation": true
  },
  {
    "canonical": "todo.match-phase",
    "aliases": [
      "todo match-phase"
    ],
    "mutation": false
  },
  {
    "canonical": "uat.render-checkpoint",
    "aliases": [
      "uat render-checkpoint"
    ],
    "mutation": false
  },
  {
    "canonical": "verify-summary",
    "aliases": [
      "verify.summary",
      "verify summary"
    ],
    "mutation": false
  },
  {
    "canonical": "workstream.complete",
    "aliases": [
      "workstream complete"
    ],
    "mutation": true
  },
  {
    "canonical": "workstream.create",
    "aliases": [
      "workstream create"
    ],
    "mutation": true
  },
  {
    "canonical": "workstream.list",
    "aliases": [
      "workstream list"
    ],
    "mutation": false
  },
  {
    "canonical": "workstream.progress",
    "aliases": [
      "workstream progress"
    ],
    "mutation": true
  },
  {
    "canonical": "workstream.set",
    "aliases": [
      "workstream set"
    ],
    "mutation": true
  },
  {
    "canonical": "write-profile",
    "aliases": [],
    "mutation": true
  }
];

const STATE_SUBCOMMANDS = STATE_COMMAND_ALIASES.map((entry) => entry.subcommand);
const VERIFY_SUBCOMMANDS = VERIFY_COMMAND_ALIASES.map((entry) => entry.subcommand);
const INIT_SUBCOMMANDS = INIT_COMMAND_ALIASES.map((entry) => entry.subcommand);
const PHASE_SUBCOMMANDS = PHASE_COMMAND_ALIASES.map((entry) => entry.subcommand);
const PHASES_SUBCOMMANDS = PHASES_COMMAND_ALIASES.map((entry) => entry.subcommand);
const VALIDATE_SUBCOMMANDS = VALIDATE_COMMAND_ALIASES.map((entry) => entry.subcommand);
const ROADMAP_SUBCOMMANDS = ROADMAP_COMMAND_ALIASES.map((entry) => entry.subcommand);

module.exports = {
  STATE_COMMAND_ALIASES,
  VERIFY_COMMAND_ALIASES,
  INIT_COMMAND_ALIASES,
  PHASE_COMMAND_ALIASES,
  PHASES_COMMAND_ALIASES,
  VALIDATE_COMMAND_ALIASES,
  ROADMAP_COMMAND_ALIASES,
  NON_FAMILY_COMMAND_ALIASES,
  STATE_SUBCOMMANDS,
  VERIFY_SUBCOMMANDS,
  INIT_SUBCOMMANDS,
  PHASE_SUBCOMMANDS,
  PHASES_SUBCOMMANDS,
  VALIDATE_SUBCOMMANDS,
  ROADMAP_SUBCOMMANDS,
};
