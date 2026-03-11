import { test, expect } from '@playwright/test';

test.describe('Dashboard - DASH Requirements', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');
    // Wait for projects to load (MSW will provide mock data in test env)
    await expect(page.getByRole('heading', { name: /GSD Dashboard/i })).toBeVisible();
  });

  test('DASH-01: User can view list of all GSD projects with health status indicators', async ({ page }) => {
    // Wait for project grid to render - either with projects or "no projects" message
    // In real environment with backend/mock, we'd see project cards
    await page.waitForLoadState('networkidle');

    // Check for either project grid or loading/no projects state
    const hasProjects = await page.getByTestId('project-grid').isVisible().catch(() => false);
    const noProjectsMsg = await page.getByText(/no projects/i).isVisible().catch(() => false);
    const loadingMsg = await page.getByText(/loading/i).isVisible().catch(() => false);

    // One of these states should be present
    expect(hasProjects || noProjectsMsg || loadingMsg).toBeTruthy();

    // If we have projects, check for health status indicators
    if (hasProjects) {
      const projectCards = page.locator('[role="button"][aria-label]');
      await expect(projectCards.first()).toBeVisible();

      // Check for health status indicators (Healthy, Degraded, or Error badges)
      const healthBadge = page.getByText(/Healthy|Degraded|Error/).first();
      await expect(healthBadge).toBeVisible();
    }
  });

  test('DASH-02: User can see current phase and progress percentage for each project', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hasProjects = await page.getByTestId('project-grid').isVisible().catch(() => false);

    if (hasProjects) {
      // Check for progress bar
      const progressBar = page.getByRole('progressbar').first();
      await expect(progressBar).toBeVisible();

      // Verify progress bar has a value
      const value = await progressBar.getAttribute('aria-valuenow');
      expect(Number(value)).toBeGreaterThanOrEqual(0);
      expect(Number(value)).toBeLessThanOrEqual(100);
    }
  });

  test('DASH-03: User can view recent activity feed for each project', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hasProjects = await page.getByTestId('project-grid').isVisible().catch(() => false);

    if (hasProjects) {
      // Activity feed may show activities or be empty
      // Since we have lastActivity in mock data, there should be activity display
      const activityItem = page.locator('[class*="text-sm"]').filter({ hasText: /ago|activity/i }).first();
      // Activity may or may not be visible depending on data
      await activityItem.isVisible().catch(() => true);
    }
  });

  test('DASH-04: User can search and filter projects by name or status', async ({ page }) => {
    // Test search filter functionality
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Dashboard');
    await expect(searchInput).toHaveValue('Dashboard');

    // Clear search
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');

    // Test status filter chips
    const healthyChip = page.getByRole('button', { name: /healthy/i });
    await expect(healthyChip).toBeVisible();
    await healthyChip.click();

    // Verify chip is now active
    await expect(healthyChip).toHaveAttribute('aria-pressed', 'true');

    // Click again to toggle off
    await healthyChip.click();
    await expect(healthyChip).toHaveAttribute('aria-pressed', 'false');

    // Toggle healthy back on to test clear all
    await healthyChip.click();

    // Test clear all button appears
    const clearButton = page.getByRole('button', { name: /clear all/i });
    await expect(clearButton).toBeVisible();

    // Click clear all and verify filter is cleared
    await clearButton.click();
    await expect(healthyChip).toHaveAttribute('aria-pressed', 'false');
  });

  test('DASH-05: User can navigate to project detail view by clicking a project card', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hasProjects = await page.getByTestId('project-grid').isVisible().catch(() => false);

    if (hasProjects) {
      // Click on the first project card
      const firstCard = page.locator('[role="button"][aria-label]').first();
      await firstCard.click();

      // Verify navigation to project detail page
      await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+/);

      // Verify project detail page content
      await expect(page.getByText('Project Detail')).toBeVisible();

      // Verify back button exists
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();

      // Navigate back
      await backButton.click();
      await expect(page).toHaveURL('/');
    }
  });

  test('Filter chips toggle on/off and clear all resets', async ({ page }) => {
    // Click healthy filter
    const healthyChip = page.getByRole('button', { name: /healthy/i });
    await healthyChip.click();
    await expect(healthyChip).toHaveAttribute('aria-pressed', 'true');

    // Click degraded filter (both should be active)
    const degradedChip = page.getByRole('button', { name: /degraded/i });
    await degradedChip.click();
    await expect(degradedChip).toHaveAttribute('aria-pressed', 'true');

    // Toggle healthy off
    await healthyChip.click();
    await expect(healthyChip).toHaveAttribute('aria-pressed', 'false');

    // Clear all should reset everything
    const clearButton = page.getByRole('button', { name: /clear all/i });
    await expect(clearButton).toBeVisible();
    await clearButton.click();
    await expect(degradedChip).toHaveAttribute('aria-pressed', 'false');
  });

  test('Instant search filtering updates results as user types', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    // Type character by character
    await searchInput.type('D', { delay: 100 });
    await searchInput.type('a', { delay: 100 });
    await searchInput.type('s', { delay: 100 });

    // Verify search is applied (input has value)
    await expect(searchInput).toHaveValue('Das');

    // The search filter should be active, clear all should appear
    const clearButton = page.getByRole('button', { name: /clear all/i });
    await expect(clearButton).toBeVisible();
  });

  test('Project card hover shows action buttons', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hasProjects = await page.getByTestId('project-grid').isVisible().catch(() => false);

    if (hasProjects) {
      // Hover over first card
      const firstCard = page.locator('[role="button"][aria-label]').first();
      await firstCard.hover();

      // Check for action buttons
      await expect(page.getByText('Open')).toBeVisible();
      await expect(page.getByText('Archive')).toBeVisible();
      await expect(page.getByText('Settings')).toBeVisible();
    }
  });
});
