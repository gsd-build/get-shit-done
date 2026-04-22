/**
 * Docs-init — context bundle for the docs-update workflow.
 *
 * Full port of `cmdDocsInit` and helpers from `get-shit-done/bin/lib/docs.cjs`.
 */

import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  type Dirent,
} from 'node:fs';
import { join, relative } from 'node:path';

import { loadConfig } from '../config.js';
import { MODEL_PROFILES, resolveModel } from './config-query.js';
import { detectRuntime, resolveAgentsDir, toPosixPath } from './helpers.js';
import type { QueryHandler } from './utils.js';

const GSD_MARKER = '<!-- generated-by: gsd-doc-writer -->';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.planning', '.claude', '__pycache__',
  'target', 'dist', 'build', '.next', '.nuxt', 'coverage',
  '.vscode', '.idea',
]);

function pathExistsInternal(cwd: string, rel: string): boolean {
  try {
    return existsSync(join(cwd, rel));
  } catch {
    return false;
  }
}

function hasGsdMarker(filePath: string): boolean {
  try {
    const buf = Buffer.alloc(500);
    const fd = openSync(filePath, 'r');
    const bytesRead = readSync(fd, buf, 0, 500, 0);
    closeSync(fd);
    return buf.subarray(0, bytesRead).toString('utf-8').includes(GSD_MARKER);
  } catch {
    return false;
  }
}

/**
 * Recursively scan project root `.md` files and `docs/` (or fallbacks) up to depth 4.
 * Port of `scanExistingDocs` from docs.cjs.
 */
export function scanExistingDocs(cwd: string): Array<{ path: string; has_gsd_marker: boolean }> {
  const MAX_DEPTH = 4;
  const results: Array<{ path: string; has_gsd_marker: boolean }> = [];

  function walkDir(dir: string, depth: number): void {
    if (depth > MAX_DEPTH) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const abs = join(dir, entry.name);
        const nameStr = entry.name.toString();
        if (entry.isDirectory()) {
          walkDir(abs, depth + 1);
        } else if (entry.isFile() && nameStr.toLowerCase().endsWith('.md')) {
          const rel = toPosixPath(relative(cwd, abs));
          results.push({ path: rel, has_gsd_marker: hasGsdMarker(abs) });
        }
      }
    } catch { /* directory may not exist */ }
  }

  try {
    const rootEntries = readdirSync(cwd, { withFileTypes: true }) as Dirent[];
    for (const entry of rootEntries) {
      const nameStr = entry.name.toString();
      if (entry.isFile() && nameStr.toLowerCase().endsWith('.md')) {
        const abs = join(cwd, nameStr);
        const rel = toPosixPath(relative(cwd, abs));
        results.push({ path: rel, has_gsd_marker: hasGsdMarker(abs) });
      }
    }
  } catch { /* best-effort */ }

  const docsDir = join(cwd, 'docs');
  walkDir(docsDir, 1);

  try {
    statSync(docsDir);
  } catch {
    for (const alt of ['documentation', 'doc']) {
      const altDir = join(cwd, alt);
      try {
        const st = statSync(altDir);
        if (st.isDirectory()) {
          walkDir(altDir, 1);
          break;
        }
      } catch { /* not present */ }
    }
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

/** Port of `detectProjectType` from docs.cjs. */
export function detectProjectType(cwd: string): Record<string, boolean> {
  const exists = (rel: string): boolean => pathExistsInternal(cwd, rel);

  let has_cli_bin = false;
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as Record<string, unknown>;
    const bin = pkg.bin;
    has_cli_bin = !!(bin && (typeof bin === 'string' || Object.keys(bin as object).length > 0));
  } catch { /* no package.json */ }

  let is_monorepo = exists('pnpm-workspace.yaml') || exists('lerna.json');
  if (!is_monorepo) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as Record<string, unknown>;
      is_monorepo = Array.isArray(pkg.workspaces) && (pkg.workspaces as unknown[]).length > 0;
    } catch { /* ignore */ }
  }

  let has_tests = exists('test') || exists('tests') || exists('__tests__') || exists('spec');
  if (!has_tests) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as Record<string, unknown>;
      const devDeps = Object.keys((pkg.devDependencies as Record<string, unknown>) || {});
      has_tests = devDeps.some(d => ['vitest', 'jest', 'mocha', 'jasmine', 'ava'].includes(d));
    } catch { /* ignore */ }
  }

  const deployFiles = [
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    'fly.toml', 'render.yaml', 'vercel.json', 'netlify.toml', 'railway.json',
    '.github/workflows/deploy.yml', '.github/workflows/deploy.yaml',
  ];
  const has_deploy_config = deployFiles.some(f => exists(f));

  return {
    has_package_json: exists('package.json'),
    has_api_routes: (
      exists('src/app/api') || exists('routes') || exists('src/routes') ||
      exists('api') || exists('server')
    ),
    has_cli_bin,
    is_open_source: exists('LICENSE') || exists('LICENSE.md'),
    has_deploy_config,
    is_monorepo,
    has_tests,
  };
}

/** Port of `detectDocTooling` from docs.cjs. */
export function detectDocTooling(cwd: string): Record<string, boolean> {
  const exists = (rel: string): boolean => pathExistsInternal(cwd, rel);
  return {
    docusaurus: exists('docusaurus.config.js') || exists('docusaurus.config.ts'),
    vitepress: (
      exists('.vitepress/config.js') ||
      exists('.vitepress/config.ts') ||
      exists('.vitepress/config.mts')
    ),
    mkdocs: exists('mkdocs.yml'),
    storybook: exists('.storybook'),
  };
}

/** Port of `detectMonorepoWorkspaces` from docs.cjs. */
export function detectMonorepoWorkspaces(cwd: string): string[] {
  try {
    const content = readFileSync(join(cwd, 'pnpm-workspace.yaml'), 'utf-8');
    const workspaces: string[] = [];
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*-\s+['"]?(.+?)['"]?\s*$/);
      if (m) workspaces.push(m[1].trim());
    }
    if (workspaces.length > 0) return workspaces;
  } catch { /* not present */ }

  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as Record<string, unknown>;
    if (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
      return pkg.workspaces as string[];
    }
  } catch { /* not present */ }

  try {
    const lerna = JSON.parse(readFileSync(join(cwd, 'lerna.json'), 'utf-8')) as { packages?: string[] };
    if (Array.isArray(lerna.packages) && lerna.packages.length > 0) {
      return lerna.packages;
    }
  } catch { /* not present */ }

  return [];
}

/**
 * Port of `checkAgentsInstalled` from core.cjs (same logic as init.ts).
 */
function checkAgentsInstalled(config?: { runtime?: unknown }): { agents_installed: boolean; missing_agents: string[] } {
  const runtime = detectRuntime(config);
  const agentsDir = resolveAgentsDir(runtime);
  const expectedAgents = Object.keys(MODEL_PROFILES);

  if (!existsSync(agentsDir)) {
    return { agents_installed: false, missing_agents: expectedAgents };
  }

  const missing: string[] = [];
  for (const agent of expectedAgents) {
    const agentFile = join(agentsDir, `${agent}.md`);
    const agentFileCopilot = join(agentsDir, `${agent}.agent.md`);
    if (!existsSync(agentFile) && !existsSync(agentFileCopilot)) {
      missing.push(agent);
    }
  }

  return {
    agents_installed: missing.length === 0,
    missing_agents: missing,
  };
}

/**
 * Init payload for docs-update workflow — matches `gsd-tools docs-init` JSON.
 * Port of `cmdDocsInit` from docs.cjs.
 */
export const docsInit: QueryHandler = async (_args, projectDir) => {
  const config = await loadConfig(projectDir);
  const docModelResult = await resolveModel(['gsd-doc-writer'], projectDir);
  const docWriterData = docModelResult.data as Record<string, unknown>;
  const doc_writer_model = (docWriterData?.model as string) || 'sonnet';

  const agentStatus = checkAgentsInstalled(config as { runtime?: unknown });

  const data: Record<string, unknown> = {
    doc_writer_model,
    commit_docs: config.commit_docs,
    existing_docs: scanExistingDocs(projectDir),
    project_type: detectProjectType(projectDir),
    doc_tooling: detectDocTooling(projectDir),
    monorepo_workspaces: detectMonorepoWorkspaces(projectDir),
    planning_exists: pathExistsInternal(projectDir, '.planning'),
    project_root: projectDir,
    agents_installed: agentStatus.agents_installed,
    missing_agents: agentStatus.missing_agents,
  };

  return { data };
};
