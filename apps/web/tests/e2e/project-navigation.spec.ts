/**
 * Project Navigation Tests - TDD for navigation bug
 *
 * Bug: Clicking a project from dashboard leads to "Loading session..." stuck state.
 * Refreshing the page fixes it.
 *
 * This test uses TDD red-green methodology:
 * 1. RED: Write failing test that reproduces the bug
 * 2. GREEN: Fix the bug to make the test pass
 */

import { test, expect } from '@playwright/test';

const baseUrl = process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:3000';
const PROJECT_ID = process.env['E2E_PROJECT_ID'] ?? 'get-shit-done';

test.describe('Project Navigation - Dashboard to Discuss', () => {
  test('should load discuss page via project detail without getting stuck', async ({ page }) => {
    // Start from the dashboard
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Find a project card and click it
    const projectCard = page.locator('[role="button"][aria-label]').first();
    const hasProjects = await projectCard.isVisible().catch(() => false);

    if (!hasProjects) {
      console.log('No projects on dashboard, skipping navigation test');
      return;
    }

    // Get the project name for logging
    const projectName = await projectCard.getAttribute('aria-label');
    console.log('Clicking project:', projectName);

    // Click the project card
    await projectCard.click();

    // First step lands on project detail page
    await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 10000 });

    // Navigate to discuss from detail tile
    await page.getByRole('link', { name: /Discuss/i }).click();
    await page.waitForURL(/\/projects\/.*\/discuss/, { timeout: 10000 });
    console.log('Navigated to:', page.url());

    // Verify the chat interface loaded
    const chatInput = page.getByPlaceholder(/Ask about goals, constraints/i);
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // On desktop, also verify it's visible
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) {
      await expect(chatInput).toBeVisible();
    }

    console.log('PASS: Discuss page loaded successfully without refresh');

    await page.screenshot({ path: 'test-results/navigation-discuss-loaded.png', fullPage: true }).catch(() => {
      // Screenshot capture can intermittently stall in CI/dev runners; non-blocking for navigation assertion.
    });
  });

  test('should load discuss page on direct navigation', async ({ page }) => {
    // This test verifies direct navigation works (baseline - should pass)
    await page.goto(`${baseUrl}/projects/${PROJECT_ID}/discuss`);
    await page.waitForLoadState('networkidle');

    // Wait for hydration
    await page.waitForTimeout(2000);

    const chatInput = page.getByPlaceholder(/Ask about goals, constraints/i);
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    console.log('PASS: Direct navigation works');
  });

  test('should load project detail and allow discuss navigation', async ({ page }) => {
    await page.goto(`${baseUrl}/projects/${PROJECT_ID}`);

    await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: /Discuss/i })).toBeVisible();
    await page.getByRole('link', { name: /Discuss/i }).click();
    await page.waitForURL(/\/projects\/.*\/discuss/, { timeout: 10000 });
    await expect(
      page.getByPlaceholder(/Ask about goals, constraints/i)
    ).toBeVisible({ timeout: 10000 });

    console.log('PASS: Redirect navigation works');

    await page.screenshot({ path: 'test-results/navigation-redirect-loaded.png', fullPage: true }).catch(() => {
      // Screenshot capture can intermittently stall in CI/dev runners; non-blocking for navigation assertion.
    });
  });
});
