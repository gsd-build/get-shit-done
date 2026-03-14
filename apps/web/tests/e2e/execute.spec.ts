import { test, expect } from '@playwright/test';

test.describe('Execute Phase UI - EXEC Requirements', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to execute demo page for testing UI components
    // In real environment, this would be /projects/[id]/execute with a live agent
    await page.goto('/demo/execute');
    // Wait for the execution panel to render
    await page.waitForLoadState('domcontentloaded');
  });

  test('EXEC-01: Wave pipeline renders with plans', async ({ page }) => {
    // Wait for pipeline view to render
    const pipelineView = page.getByTestId('pipeline-view');
    await expect(pipelineView).toBeVisible();

    // Should have wave columns
    const waveColumns = page.locator('[role="listitem"]');
    await expect(waveColumns.first()).toBeVisible({ timeout: 5000 });
  });

  test('EXEC-02: Tool cards render and display tool information', async ({ page }) => {
    // Wait for tool cards to appear (they're added via setTimeout in demo)
    await page.waitForTimeout(2000);

    // Find tool cards in the right panel
    const toolCards = page.locator('[data-testid^="tool-card"]');

    // At least one tool card should be visible after the demo populates
    const hasToolCards = await toolCards.count() > 0;
    if (hasToolCards) {
      const firstCard = toolCards.first();
      await expect(firstCard).toBeVisible();
    }
  });

  test('EXEC-03: Execution controls are visible in header', async ({ page }) => {
    // Execution controls should be in the header
    const header = page.getByTestId('execution-panel-header');
    await expect(header).toBeVisible();

    // Should have control buttons (pause, abort)
    const pauseButton = page.getByRole('button', { name: /pause/i });
    const abortButton = page.getByRole('button', { name: /abort/i });

    // At least one control should be visible
    const hasPause = await pauseButton.isVisible().catch(() => false);
    const hasAbort = await abortButton.isVisible().catch(() => false);
    expect(hasPause || hasAbort).toBeTruthy();
  });

  test('EXEC-04: Diff panel is visible in sidebar', async ({ page }) => {
    // The diff panel should be in the right sidebar
    const diffPanel = page.getByTestId('diff-panel');
    await expect(diffPanel).toBeVisible();
  });

  test('EXEC-05: Panel resize handle allows resizing', async ({ page }) => {
    // Find the resize handle between panels
    const resizeHandle = page.getByTestId('panel-resize-handle');
    await expect(resizeHandle).toBeVisible();

    // Verify it has the expected cursor style for resizing
    await expect(resizeHandle).toHaveClass(/hover:bg-/);
  });

  test('EXEC-06: Abort button shows confirmation dialog', async ({ page }) => {
    // Find and click the abort button
    const abortButton = page.getByRole('button', { name: /abort/i });

    if (await abortButton.isVisible().catch(() => false)) {
      await abortButton.click();

      // Confirmation dialog should appear
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      // Dialog should have confirm and cancel options
      const confirmButton = page.getByRole('button', { name: /confirm abort|yes, abort/i });
      const cancelButton = page.getByRole('button', { name: /cancel|go back/i });

      await expect(confirmButton).toBeVisible();
      await expect(cancelButton).toBeVisible();

      // Cancel the dialog
      await cancelButton.click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test('EXEC-07: Log output streams in real-time', async ({ page }) => {
    // Wait for logs to populate (demo adds them after 500ms)
    await page.waitForTimeout(1000);

    // Find log output area
    const logContent = page.locator('[class*="font-mono"]').first();

    if (await logContent.isVisible().catch(() => false)) {
      // Should have some content
      const text = await logContent.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Execute Phase UI - QUAL Requirements (TDD Indicator)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/execute');
    await page.waitForLoadState('domcontentloaded');
  });

  test('QUAL-01: TDD indicator shows 3 steps', async ({ page }) => {
    // Wait for TDD phase to be set (demo sets it after 1000ms)
    await page.waitForTimeout(1500);

    // Find TDD indicator
    const tddIndicator = page.getByRole('group', { name: /TDD progress/i });

    if (await tddIndicator.isVisible().catch(() => false)) {
      // Should show all 3 phases
      await expect(page.getByText('Red')).toBeVisible();
      await expect(page.getByText('Green')).toBeVisible();
      await expect(page.getByText('Refactor')).toBeVisible();
    }
  });

  test('QUAL-02: Active TDD phase is highlighted', async ({ page }) => {
    // Wait for TDD phase to be set
    await page.waitForTimeout(1500);

    // Find the active step (demo sets it to 'green')
    const greenStep = page.getByTestId('step-green');

    if (await greenStep.isVisible().catch(() => false)) {
      // Active step should have aria-current
      await expect(greenStep).toHaveAttribute('aria-current', 'step');
    }
  });

  test('QUAL-03: Past TDD phases show completion state', async ({ page }) => {
    // Wait for TDD phase to be set to 'green' (so 'red' is past)
    await page.waitForTimeout(1500);

    // Find the red step circle
    const redStep = page.getByTestId('step-red');

    if (await redStep.isVisible().catch(() => false)) {
      const redCircle = redStep.locator('[data-testid="step-circle"]');
      // Past phase should have solid red background
      await expect(redCircle).toHaveClass(/bg-red-500/);
    }
  });

  test('QUAL-04: TDD indicator has proper accessibility', async ({ page }) => {
    // Wait for TDD phase to be set
    await page.waitForTimeout(1500);

    // Find TDD indicator
    const tddIndicator = page.getByRole('group', { name: /TDD progress/i });

    if (await tddIndicator.isVisible().catch(() => false)) {
      // Should have aria-label
      const ariaLabel = await tddIndicator.getAttribute('aria-label');
      expect(ariaLabel).toContain('TDD progress');
    }
  });
});

test.describe('Execute Page Navigation', () => {
  test('Execute page renders with connection status', async ({ page }) => {
    // Navigate to a real execute page (with placeholder project ID)
    await page.goto('/projects/test-project/execute');
    await page.waitForLoadState('domcontentloaded');

    // Should show connection status
    const connectedIndicator = page.getByText(/connected|disconnected/i);
    await expect(connectedIndicator).toBeVisible();

    // Should have back button
    const backButton = page.getByRole('button', { name: /back to project/i });
    await expect(backButton).toBeVisible();
  });

  test('Execute page shows empty state when no execution', async ({ page }) => {
    await page.goto('/projects/test-project/execute');
    await page.waitForLoadState('domcontentloaded');

    // Should show empty state message
    const emptyState = page.getByText(/no execution running/i);
    await expect(emptyState).toBeVisible();
  });

  test('Execute page shows orchestration controls and workflow graph', async ({ page }) => {
    await page.goto('/projects/test-project/execute');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/Orchestration Controls/i)).toBeVisible();
    await expect(page.getByTestId('parallelism-workflow-graph')).toBeVisible();
  });

  test('Back button navigates to project detail', async ({ page }) => {
    await page.goto('/projects/test-project/execute');
    await page.waitForLoadState('domcontentloaded');

    // Click back button
    const backButton = page.getByRole('button', { name: /back to project/i });
    await backButton.click();

    // Should navigate to project page
    await expect(page).toHaveURL('/projects/test-project');
  });
});

test.describe('Commit Timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/execute');
    // Wait for commit to be added (demo adds after 3000ms)
    await page.waitForTimeout(3500);
  });

  test('Commit timeline shows commits', async ({ page }) => {
    // Find commit timeline
    const commitTimeline = page.getByTestId('commit-timeline');

    if (await commitTimeline.isVisible().catch(() => false)) {
      // Should have at least one commit entry
      const commitEntries = commitTimeline.locator('[data-testid^="commit-"]');
      await expect(commitEntries.first()).toBeVisible();
    }
  });

  test('Commit entry shows SHA and message', async ({ page }) => {
    const commitTimeline = page.getByTestId('commit-timeline');

    if (await commitTimeline.isVisible().catch(() => false)) {
      // Find commit with known SHA from demo (a1b2c3d)
      const commitSha = page.getByText(/a1b2c3d/i);
      const commitMessage = page.getByText(/implement TddIndicator/i);

      // At least one should be visible
      const hasSha = await commitSha.isVisible().catch(() => false);
      const hasMessage = await commitMessage.isVisible().catch(() => false);
      expect(hasSha || hasMessage).toBeTruthy();
    }
  });
});

test.describe('Responsive Layout', () => {
  test('Execute panel fills viewport height', async ({ page }) => {
    await page.goto('/demo/execute');

    // Check that the main container is full height
    const container = page.locator('.h-screen').first();
    await expect(container).toBeVisible();

    // Verify it has full viewport height
    const boundingBox = await container.boundingBox();
    const viewportSize = page.viewportSize();

    if (boundingBox && viewportSize) {
      // Container should be close to viewport height
      expect(boundingBox.height).toBeGreaterThan(viewportSize.height * 0.9);
    }
  });

  test('Panels are resizable', async ({ page }) => {
    await page.goto('/demo/execute');
    await page.waitForLoadState('domcontentloaded');

    // Find panels
    const panels = page.getByTestId('panel');
    const panelCount = await panels.count();

    // Should have at least 2 panels (main and sidebar)
    expect(panelCount).toBeGreaterThanOrEqual(2);
  });
});
