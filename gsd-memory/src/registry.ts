import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export interface RegisteredProject {
  name: string;
  path: string;
  qmdCollection?: string;
  registeredAt: string;
  lastIndexed?: string;
}

export interface Registry {
  version: string;
  projects: RegisteredProject[];
}

const REGISTRY_DIR = join(homedir(), '.gsd');
const REGISTRY_PATH = join(REGISTRY_DIR, 'projects.json');

/**
 * Ensure the registry directory exists
 */
function ensureRegistryDir(): void {
  if (!existsSync(REGISTRY_DIR)) {
    mkdirSync(REGISTRY_DIR, { recursive: true });
  }
}

/**
 * Read the project registry
 */
export function readRegistry(): Registry {
  ensureRegistryDir();

  if (!existsSync(REGISTRY_PATH)) {
    return { version: '1.0.0', projects: [] };
  }

  try {
    const content = readFileSync(REGISTRY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { version: '1.0.0', projects: [] };
  }
}

/**
 * Write the project registry
 */
export function writeRegistry(registry: Registry): void {
  ensureRegistryDir();
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * Register a new project
 */
export function registerProject(project: Omit<RegisteredProject, 'registeredAt'>): RegisteredProject {
  const registry = readRegistry();

  // Check if project already exists
  const existingIndex = registry.projects.findIndex(
    p => p.path === project.path || p.name === project.name
  );

  const newProject: RegisteredProject = {
    ...project,
    registeredAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    // Update existing project
    registry.projects[existingIndex] = {
      ...registry.projects[existingIndex],
      ...newProject,
      registeredAt: registry.projects[existingIndex].registeredAt
    };
  } else {
    // Add new project
    registry.projects.push(newProject);
  }

  writeRegistry(registry);
  return newProject;
}

/**
 * Update a project's last indexed time
 */
export function updateProjectIndexTime(name: string): void {
  const registry = readRegistry();
  const project = registry.projects.find(p => p.name === name);

  if (project) {
    project.lastIndexed = new Date().toISOString();
    writeRegistry(registry);
  }
}

/**
 * Get a project by name
 */
export function getProject(name: string): RegisteredProject | undefined {
  const registry = readRegistry();
  return registry.projects.find(p => p.name === name);
}

/**
 * Get all registered projects
 */
export function getAllProjects(): RegisteredProject[] {
  return readRegistry().projects;
}

/**
 * Remove a project from the registry
 */
export function unregisterProject(name: string): boolean {
  const registry = readRegistry();
  const index = registry.projects.findIndex(p => p.name === name);

  if (index >= 0) {
    registry.projects.splice(index, 1);
    writeRegistry(registry);
    return true;
  }

  return false;
}

/**
 * Get the registry path (for testing)
 */
export function getRegistryPath(): string {
  return REGISTRY_PATH;
}
