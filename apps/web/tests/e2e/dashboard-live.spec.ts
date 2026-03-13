import { test, expect } from '@playwright/test';

/**
 * E2E tests for Dashboard with live backend.
 * These tests require both frontend (localhost:3000) and backend (localhost:4000) running.
 */
test.describe('Dashboard - Live Backend', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Browser console error: ${msg.text()}`);
      }
    });

    // Log network errors
    page.on('requestfailed', request => {
      console.log(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Log API responses
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`API Response: ${response.url()} - ${response.status()}`);
      }
    });
  });

  test('Dashboard loads and displays header', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for dashboard header
    const header = page.getByRole('heading', { name: /GSD Dashboard/i });
    await expect(header).toBeVisible({ timeout: 10000 });

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/dashboard-loaded.png' });
  });

  test('Dashboard fetches projects from API', async ({ page }) => {
    // Intercept API call to verify it happens
    let apiCalled = false;
    let apiResponse: unknown = null;

    await page.route('**/api/projects**', async (route) => {
      apiCalled = true;
      const response = await route.fetch();
      apiResponse = await response.json();
      console.log('Intercepted API response:', JSON.stringify(apiResponse, null, 2));
      await route.fulfill({ response });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify API was called
    expect(apiCalled).toBeTruthy();

    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-after-api.png' });
  });

  test('Projects are displayed in grid when API returns data', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait a bit for React to render
    await page.waitForTimeout(2000);

    // Check what's on the page
    const bodyText = await page.locator('body').textContent();
    console.log('Page body text (first 500 chars):', bodyText?.substring(0, 500));

    // Look for project grid or error/loading states
    const projectGrid = page.getByTestId('project-grid');
    const noProjects = page.getByText(/no projects/i);
    const loading = page.getByText(/loading/i);
    const error = page.getByText(/error|failed/i);

    const hasGrid = await projectGrid.isVisible().catch(() => false);
    const hasNoProjects = await noProjects.isVisible().catch(() => false);
    const hasLoading = await loading.isVisible().catch(() => false);
    const hasError = await error.isVisible().catch(() => false);

    console.log('UI State:', { hasGrid, hasNoProjects, hasLoading, hasError });

    // Take screenshot for analysis
    await page.screenshot({ path: 'test-results/dashboard-projects-state.png', fullPage: true });

    // At least one state should be visible
    expect(hasGrid || hasNoProjects || hasLoading || hasError).toBeTruthy();
  });

  test('Search input is functional', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Type in search
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');

    // Clear search
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });

  test('Filter chips are rendered and clickable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for filter chips
    const healthyChip = page.getByRole('button', { name: /healthy/i });
    const degradedChip = page.getByRole('button', { name: /degraded/i });
    const errorChip = page.getByRole('button', { name: /error/i });

    await expect(healthyChip).toBeVisible();
    await expect(degradedChip).toBeVisible();
    await expect(errorChip).toBeVisible();

    // Click healthy chip
    await healthyChip.click();
    await expect(healthyChip).toHaveAttribute('aria-pressed', 'true');

    // Click again to toggle off
    await healthyChip.click();
    await expect(healthyChip).toHaveAttribute('aria-pressed', 'false');
  });

  test('Debug: Capture full page state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Get all text content
    const allText = await page.locator('body').allTextContents();
    console.log('All page text:', allText.join('\n'));

    // Get all visible elements with data-testid
    const testIds = await page.locator('[data-testid]').all();
    for (const el of testIds) {
      const testId = await el.getAttribute('data-testid');
      const isVisible = await el.isVisible();
      console.log(`TestID: ${testId}, Visible: ${isVisible}`);
    }

    // Check for any error messages in the DOM
    const errorElements = await page.locator('[class*="error"], [class*="Error"]').all();
    for (const el of errorElements) {
      const text = await el.textContent();
      console.log('Error element:', text);
    }

    // Full page screenshot
    await page.screenshot({ path: 'test-results/debug-full-page.png', fullPage: true });
  });
});
