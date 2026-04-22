/**
 * Canonical commands exercised by `golden.integration.test.ts` (SDK dispatch vs
 * `gsd-tools.cjs` where applicable). Update when adding `describe` blocks there.
 */

export const GOLDEN_INTEGRATION_MAIN_FILE_CANONICALS: readonly string[] = [
  'config-get',
  'config-set',
  'current-timestamp',
  'detect-custom-files',
  'docs-init',
  'find-phase',
  'frontmatter.get',
  'frontmatter.validate',
  'generate-slug',
  'init.execute-phase',
  'init.plan-phase',
  'init.quick',
  'init.resume',
  'init.verify-work',
  'intel.update',
  'progress.json',
  'roadmap.analyze',
  'state.sync',
  'state.validate',
  'template.select',
  'validate.consistency',
  'verify.phase-completeness',
  'verify.plan-structure',
].sort((a, b) => a.localeCompare(b));
