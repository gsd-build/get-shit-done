import { getProject, updateProjectIndexTime, getAllProjects } from '../registry.js';
import { qmd } from '../qmd.js';
import { existsSync } from 'fs';
import { join } from 'path';

export interface IndexOptions {
  path?: string;
  project?: string;
}

export interface IndexResult {
  success: boolean;
  project?: string;
  documentsIndexed?: number;
  error?: string;
  qmdUsed: boolean;
}

/**
 * Trigger indexing/update for a project
 */
export async function index(options: IndexOptions): Promise<IndexResult> {
  // Find the project
  let projectName: string | undefined;
  let projectPath: string | undefined;
  let qmdCollection: string | undefined;

  if (options.project) {
    const project = getProject(options.project);
    if (!project) {
      return {
        success: false,
        error: `Project not found: ${options.project}`,
        qmdUsed: false
      };
    }
    projectName = project.name;
    projectPath = project.path;
    qmdCollection = project.qmdCollection;
  } else if (options.path) {
    // Find project by path
    const projects = getAllProjects();
    const project = projects.find(p => p.path === options.path);

    if (!project) {
      return {
        success: false,
        error: `No project registered for path: ${options.path}`,
        qmdUsed: false
      };
    }

    projectName = project.name;
    projectPath = project.path;
    qmdCollection = project.qmdCollection;
  } else {
    return {
      success: false,
      error: 'Either project or path must be specified',
      qmdUsed: false
    };
  }

  // Verify planning directory exists
  const planningPath = join(projectPath, '.planning');
  if (!existsSync(planningPath)) {
    return {
      success: false,
      project: projectName,
      error: `No .planning directory found at: ${planningPath}`,
      qmdUsed: false
    };
  }

  // Check if QMD is available
  const qmdAvailable = await qmd.isAvailable();

  if (qmdAvailable && qmdCollection) {
    // Use QMD to update the collection
    const result = await qmd.index(qmdCollection);

    if (result.success) {
      updateProjectIndexTime(projectName);

      // Get document count
      const status = await qmd.status(qmdCollection);

      return {
        success: true,
        project: projectName,
        documentsIndexed: status.documentCount,
        qmdUsed: true
      };
    } else {
      return {
        success: false,
        project: projectName,
        error: `QMD indexing failed: ${result.reason}`,
        qmdUsed: true
      };
    }
  } else {
    // No QMD - just update the timestamp
    // Grep fallback will search files directly
    updateProjectIndexTime(projectName);

    return {
      success: true,
      project: projectName,
      qmdUsed: false
    };
  }
}

/**
 * Index all registered projects
 */
export async function indexAll(): Promise<{
  success: boolean;
  results: IndexResult[];
}> {
  const projects = getAllProjects();
  const results: IndexResult[] = [];

  for (const project of projects) {
    const result = await index({ project: project.name });
    results.push(result);
  }

  const success = results.every(r => r.success);

  return { success, results };
}
