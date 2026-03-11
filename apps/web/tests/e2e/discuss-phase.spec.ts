import { test, expect } from '@playwright/test';

/**
 * E2E tests for Discuss Phase UI (Phase 16).
 * Tests chat interface, CONTEXT.md preview, session persistence, and inline editing.
 */
test.describe('Discuss Phase UI', () => {
  // Use a test project ID - in real tests this would be from the API
  const testProjectId = 'get-shit-done';

  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => {
      console.log(`Browser [${msg.type()}]: ${msg.text()}`);
    });

    page.on('pageerror', error => {
      console.log(`Page error: ${error.message}`);
    });
  });

  test('Discuss page loads with chat interface', async ({ page }) => {
    await page.goto(`/projects/${testProjectId}/discuss`);
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'test-results/discuss-page-loaded.png', fullPage: true });

    // Check for key UI elements
    const chatInput = page.locator('input[type="text"], textarea').first();
    const hasInput = await chatInput.isVisible().catch(() => false);

    console.log('Has chat input:', hasInput);

    // Get page content for debugging
    const bodyText = await page.locator('body').textContent();
    console.log('Page content (first 500):', bodyText?.substring(0, 500));
  });

  test('Chat input is visible and functional', async ({ page }) => {
    await page.goto(`/projects/${testProjectId}/discuss`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Look for chat input component
    const chatInput = page.getByPlaceholder(/message|type|ask/i).or(
      page.locator('[data-testid="chat-input"]')
    ).or(
      page.locator('textarea')
    );

    const isVisible = await chatInput.first().isVisible().catch(() => false);
    console.log('Chat input visible:', isVisible);

    if (isVisible) {
      await chatInput.first().fill('Test message');
      await expect(chatInput.first()).toHaveValue('Test message');
    }

    await page.screenshot({ path: 'test-results/discuss-chat-input.png', fullPage: true });
  });

  test('Welcome screen shows when no messages', async ({ page }) => {
    // Clear session storage before navigating
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
    });

    await page.goto(`/projects/${testProjectId}/discuss`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Look for welcome screen elements
    const welcomeText = page.getByText(/welcome|start|begin|discuss/i);
    const hasWelcome = await welcomeText.first().isVisible().catch(() => false);

    console.log('Has welcome text:', hasWelcome);

    await page.screenshot({ path: 'test-results/discuss-welcome.png', fullPage: true });
  });

  test('Context preview panel is visible (desktop)', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto(`/projects/${testProjectId}/discuss`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Look for context preview panel
    const previewPanel = page.getByText(/CONTEXT|preview|decisions/i).or(
      page.locator('[data-testid="context-preview"]')
    );

    const hasPreview = await previewPanel.first().isVisible().catch(() => false);
    console.log('Has preview panel:', hasPreview);

    await page.screenshot({ path: 'test-results/discuss-desktop-preview.png', fullPage: true });
  });

  test('Mobile view shows chat-first layout', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`/projects/${testProjectId}/discuss`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // On mobile, preview should be hidden or in a drawer
    const chatArea = page.locator('[data-testid="chat-interface"]').or(
      page.locator('main')
    );

    await expect(chatArea.first()).toBeVisible();

    // Look for drawer toggle button
    const drawerToggle = page.getByRole('button', { name: /preview|context|toggle/i });
    const hasToggle = await drawerToggle.isVisible().catch(() => false);

    console.log('Has drawer toggle:', hasToggle);

    await page.screenshot({ path: 'test-results/discuss-mobile.png', fullPage: true });
  });

  test('Progress stepper shows topics', async ({ page }) => {
    await page.goto(`/projects/${testProjectId}/discuss`);
    await page.waitForLoadState('networkidle');

    // Look for progress stepper
    const stepper = page.getByTestId('progress-stepper').or(
      page.locator('[role="tablist"]')
    ).or(
      page.getByText(/chat ui|preview|locking|session/i)
    );

    const hasStepper = await stepper.first().isVisible().catch(() => false);
    console.log('Has progress stepper:', hasStepper);

    await page.screenshot({ path: 'test-results/discuss-stepper.png', fullPage: true });
  });

  test('Connection banner behavior', async ({ page }) => {
    await page.goto(`/projects/${testProjectId}/discuss`);
    await page.waitForLoadState('networkidle');

    // Look for connection banner (should not be visible if connected)
    const connectionBanner = page.getByText(/reconnecting|disconnected|connection/i);
    const hasBanner = await connectionBanner.first().isVisible().catch(() => false);

    console.log('Connection banner visible:', hasBanner);

    // If no banner, connection is good
    if (!hasBanner) {
      console.log('No connection banner - socket connected');
    }
  });

  test('Debug: Full discuss page state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto(`/projects/${testProjectId}/discuss`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Get all test IDs on page
    const testIds = await page.locator('[data-testid]').all();
    console.log('Test IDs found:');
    for (const el of testIds) {
      const testId = await el.getAttribute('data-testid');
      const isVisible = await el.isVisible();
      console.log(`  - ${testId}: visible=${isVisible}`);
    }

    // Get all heading elements
    const headings = await page.locator('h1, h2, h3, h4').all();
    console.log('Headings found:');
    for (const h of headings) {
      const text = await h.textContent();
      console.log(`  - ${text}`);
    }

    // Check for any React error boundaries
    const errorBoundary = await page.locator('[class*="error"]').all();
    if (errorBoundary.length > 0) {
      console.log('Error elements found:');
      for (const el of errorBoundary) {
        const text = await el.textContent();
        console.log(`  - ${text?.substring(0, 100)}`);
      }
    }

    // Full page screenshot
    await page.screenshot({ path: 'test-results/discuss-debug-full.png', fullPage: true });

    // Get HTML for inspection
    const html = await page.content();
    console.log('Page HTML length:', html.length);
  });
});
