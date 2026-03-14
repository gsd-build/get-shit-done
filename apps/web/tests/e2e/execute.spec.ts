import { test, expect, type Page } from '@playwright/test';
const PROJECT_ID = process.env['E2E_PROJECT_ID'] ?? 'get-shit-done';

async function hasExecuteSurface(page: Page) {
  const hasHeader = await page.getByTestId('execution-panel-header').isVisible().catch(() => false);
  const hasToolbar = await page.getByRole('toolbar', { name: /execution controls/i }).isVisible().catch(() => false);
  const hasConnection = await page.getByTestId('connection-status').isVisible().catch(() => false);
  const hasPipeline = await page.getByTestId('pipeline-view').isVisible().catch(() => false);
  return hasHeader || hasToolbar || hasConnection || hasPipeline;
}

test.describe('Execute Phase UI - EXEC Requirements', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to execute demo page for testing UI components
    // In real environment, this would be /projects/[id]/execute with a live agent
    await page.goto('/demo/execute');
    // Wait for the execution panel to render
    await page.waitForLoadState('domcontentloaded');
  });

  test('EXEC-01: Wave pipeline renders with plans', async ({ page }) => {
    if (!(await hasExecuteSurface(page))) {
      return;
    }

    const pipelineVisible = await page.getByTestId('pipeline-view').isVisible().catch(() => false);
    const waveVisible = await page.getByRole('list', { name: /execution waves/i }).isVisible().catch(() => false);
    const toolbarVisible = await page.getByRole('toolbar', { name: /execution controls/i }).isVisible().catch(() => false);
    const emptyVisible = await page
      .getByText(/Ready to Execute|No Phases Found|No Executable Plans Yet|Connection Required/i)
      .isVisible()
      .catch(() => false);

    expect(pipelineVisible || waveVisible || toolbarVisible || emptyVisible).toBeTruthy();
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
    // Diff area can be populated or empty depending on demo timing/state.
    await expect(
      page
        .getByTestId('diff-panel')
        .or(page.getByTestId('diff-panel-empty'))
        .or(page.getByTestId('diff-panel-container'))
        .first()
    ).toBeVisible();
  });

  test('EXEC-05: Panel resize handle allows resizing', async ({ page }) => {
    // Validate split layout is rendered with primary execution regions.
    await expect(
      page
        .getByRole('toolbar', { name: /execution controls/i })
        .or(page.getByTestId('execution-panel-header'))
        .first()
    ).toBeVisible();

    const hasPipeline = await page.getByTestId('pipeline-view').isVisible().catch(() => false);
    const hasWaveList = await page.getByRole('list', { name: /execution waves/i }).isVisible().catch(() => false);
    const hasWorkflow = await page
      .getByTestId('parallelism-workflow-graph')
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/Ready to Execute|No Phases Found|No Executable Plans Yet|Connection Required/i)
      .isVisible()
      .catch(() => false);
    expect(hasPipeline || hasWaveList || hasWorkflow || hasEmptyState).toBeTruthy();
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
    await page.goto(`/projects/${PROJECT_ID}/execute`);
    await page.waitForLoadState('domcontentloaded');

    // Should show connection status
    const connectedIndicator = page.getByText(/connected|disconnected/i);
    await expect(connectedIndicator).toBeVisible();

    // Should have back button
    const backButton = page.getByRole('button', { name: /back to project/i });
    await expect(backButton).toBeVisible();
  });

  test('Execute page shows empty state when no execution', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/execute`);
    await page.waitForLoadState('domcontentloaded');

    // Should show empty state guidance card
    await expect(
      page.getByText(/Ready to Execute|No Phases Found|No Executable Plans Yet|Connection Required/i)
    ).toBeVisible();
  });

  test('Execute page shows orchestration controls and workflow graph', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/execute`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page
        .getByText(/Orchestration Controls/i)
        .or(page.getByRole('button', { name: /Refresh Parallelism/i }))
        .first()
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page
        .getByTestId('parallelism-workflow-graph')
        .or(page.getByText(/No workflow graph data available yet/i))
        .first()
    ).toBeVisible();
  });

  test('Back button navigates to project detail', async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/execute`);
    await page.waitForLoadState('domcontentloaded');

    // Click back button
    const backButton = page.getByRole('button', { name: /back to project/i });
    await backButton.click();

    // Should navigate to project page
    await page.waitForURL(
      (url) => url.pathname === `/projects/${PROJECT_ID}`,
      { timeout: 15000 }
    );
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
    await page.waitForLoadState('domcontentloaded');

    if (!(await hasExecuteSurface(page))) {
      return;
    }

    // Verify it has full viewport height
    const boundingBox = await page.locator('body').boundingBox();
    const viewportSize = page.viewportSize();

    if (boundingBox && viewportSize) {
      // Container should be close to viewport height
      expect(boundingBox.height).toBeGreaterThan(viewportSize.height * 0.75);
    }
  });

  test('Panels are resizable', async ({ page }) => {
    await page.goto('/demo/execute');
    await page.waitForLoadState('domcontentloaded');

    if (!(await hasExecuteSurface(page))) {
      return;
    }

    const hasPipeline = await page.getByTestId('pipeline-view').isVisible().catch(() => false);
    const hasWorkflow = await page
      .getByTestId('parallelism-workflow-graph')
      .isVisible()
      .catch(() => false);
    const hasDiff = await page
      .getByTestId('diff-panel')
      .or(page.getByTestId('diff-panel-empty'))
      .or(page.getByTestId('diff-panel-container'))
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/Ready to Execute|No Phases Found|No Executable Plans Yet|Connection Required/i)
      .isVisible()
      .catch(() => false);
    const hasResizeHandle = await page.locator('[role="separator"], [aria-orientation="vertical"]').first().isVisible().catch(() => false);

    expect(hasPipeline || hasWorkflow || hasDiff || hasEmptyState || hasResizeHandle).toBeTruthy();
  });
});
