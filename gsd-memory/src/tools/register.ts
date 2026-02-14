import { registerProject, getProject, getAllProjects, unregisterProject, type RegisteredProject } from '../registry.js';
import { qmd } from '../qmd.js';
import { existsSync } from 'fs';
import { join, basename } from 'path';

export interface RegisterOptions {
  path: string;
  name?: string;
}

export interface RegisterResult {
  success: boolean;
  project?: RegisteredProject;
  qmdCollection?: string;
  error?: string;
}

/**
 * Register a project with GSD memory
 */
export async function register(options: RegisterOptions): Promise<RegisterResult> {
  // Validate path exists
  if (!existsSync(options.path)) {
    return {
      success: false,
      error: `Path does not exist: ${options.path}`
    };
  }

  // Validate .planning directory exists
  const planningPath = join(options.path, '.planning');
  if (!existsSync(planningPath)) {
    return {
      success: false,
      error: `No .planning directory found at: ${planningPath}`
    };
  }

  // Determine project name
  const name = options.name || basename(options.path);

  // Check if QMD is available for semantic search
  const qmdAvailable = await qmd.isAvailable();
  let qmdCollection: string | undefined;

  if (qmdAvailable) {
    // Create QMD collection
    qmdCollection = `gsd-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const qmdResult = await qmd.createCollection({
      name: qmdCollection,
      paths: [planningPath],
      context: `GSD project: ${name}`
    });

    if (!qmdResult.success) {
      // QMD collection creation failed, but we can still register
      qmdCollection = undefined;
    }
  }

  // Register in local registry
  const project = registerProject({
    name,
    path: options.path,
    qmdCollection
  });

  return {
    success: true,
    project,
    qmdCollection
  };
}

/**
 * Get status of all registered projects
 */
export async function status(): Promise<{
  qmdAvailable: boolean;
  projects: Array<{
    name: string;
    path: string;
    qmdCollection?: string;
    registeredAt: string;
    lastIndexed?: string;
    documentCount?: number;
  }>;
}> {
  const qmdAvailable = await qmd.isAvailable();
  const projects = getAllProjects();

  const enrichedProjects = await Promise.all(
    projects.map(async (project) => {
      let documentCount: number | undefined;

      if (qmdAvailable && project.qmdCollection) {
        const qmdStatus = await qmd.status(project.qmdCollection);
        documentCount = qmdStatus.documentCount;
      }

      return {
        name: project.name,
        path: project.path,
        qmdCollection: project.qmdCollection,
        registeredAt: project.registeredAt,
        lastIndexed: project.lastIndexed,
        documentCount
      };
    })
  );

  return {
    qmdAvailable,
    projects: enrichedProjects
  };
}

/**
 * Unregister a project
 */
export async function unregister(name: string): Promise<{ success: boolean; error?: string }> {
  const project = getProject(name);

  if (!project) {
    return {
      success: false,
      error: `Project not found: ${name}`
    };
  }

  // Remove from QMD if it has a collection
  if (project.qmdCollection && await qmd.isAvailable()) {
    try {
      // QMD doesn't have a direct remove command, so we just skip
      // The collection will be orphaned but harmless
    } catch {
      // Ignore QMD errors
    }
  }

  // Remove from registry
  unregisterProject(name);

  return { success: true };
}
