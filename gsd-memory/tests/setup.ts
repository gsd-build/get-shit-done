import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Read a test fixture file
 */
export function readFixture(filename: string): string {
  const fixturePath = join(__dirname, 'fixtures', filename);
  return readFileSync(fixturePath, 'utf-8');
}

/**
 * Get the path to the mock planning directory
 */
export function getMockPlanningPath(): string {
  return join(__dirname, 'fixtures', 'mock-planning');
}

/**
 * Get path to a specific fixture file
 */
export function getFixturePath(filename: string): string {
  return join(__dirname, 'fixtures', filename);
}
