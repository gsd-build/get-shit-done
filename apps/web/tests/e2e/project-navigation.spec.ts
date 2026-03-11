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

test.describe('Project Navigation - Dashboard to Discuss', () => {
  test('should load discuss page without getting stuck on Loading session (RED)', async ({ page }) => {
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

    // Should navigate to /projects/{id}/discuss
    await page.waitForURL(/\/projects\/.*\/discuss/, { timeout: 10000 });
    console.log('Navigated to:', page.url());

    // THE BUG: Page gets stuck at "Loading session..."
    // This test should FAIL if the bug exists

    // Wait for "Loading session..." to disappear (should happen within 5 seconds)
    const loadingText = page.getByText('Loading session...');

    // First check if loading appears
    const loadingAppeared = await loadingText.isVisible().catch(() => false);
    console.log('Loading session... appeared:', loadingAppeared);

    if (loadingAppeared) {
      // Wait for it to disappear - this is where the bug manifests
      // The bug causes this to timeout because loading never goes away
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }

    // Verify the chat interface loaded (not stuck on loading)
    // On mobile, textarea may be off-screen but should exist in DOM
    const chatInput = page.locator('textarea').first();

    // First check it exists in DOM (works for both mobile and desktop)
    await expect(chatInput).toBeAttached({ timeout: 10000 });

    // On desktop, also verify it's visible
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) {
      await expect(chatInput).toBeVisible({ timeout: 5000 });
    }

    console.log('PASS: Discuss page loaded successfully without refresh');

    await page.screenshot({ path: 'test-results/navigation-discuss-loaded.png', fullPage: true });
  });

  test('should load discuss page on direct navigation', async ({ page }) => {
    // This test verifies direct navigation works (baseline - should pass)
    await page.goto(`${baseUrl}/projects/test-project/discuss`);
    await page.waitForLoadState('networkidle');

    // Wait for hydration
    await page.waitForTimeout(2000);

    // Check for loading state
    const loadingText = page.getByText('Loading session...');
    const isLoading = await loadingText.isVisible().catch(() => false);

    if (isLoading) {
      // Wait for loading to complete
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }

    // Verify chat interface loaded (attached to DOM)
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeAttached({ timeout: 10000 });

    console.log('PASS: Direct navigation works');
  });

  test('should load discuss page after redirect from project detail', async ({ page }) => {
    // Navigate to /projects/{id} which should redirect to /projects/{id}/discuss
    await page.goto(`${baseUrl}/projects/test-project`);

    // Should redirect to discuss
    await page.waitForURL(/\/projects\/.*\/discuss/, { timeout: 10000 });

    // Wait for loading to complete
    const loadingText = page.getByText('Loading session...');
    const isLoading = await loadingText.isVisible().catch(() => false);

    console.log('After redirect - Loading visible:', isLoading);

    if (isLoading) {
      // This is where the bug might manifest
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }

    // Verify chat loaded (attached to DOM)
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeAttached({ timeout: 10000 });

    console.log('PASS: Redirect navigation works');

    await page.screenshot({ path: 'test-results/navigation-redirect-loaded.png', fullPage: true });
  });
});
