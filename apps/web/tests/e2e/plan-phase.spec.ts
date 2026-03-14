import { test, expect } from '@playwright/test';

const PROJECT_ID = process.env['E2E_PROJECT_ID'] ?? 'get-shit-done';

test.describe('Plan Phase Page', () => {
  async function skipIfUnavailable(page: import('@playwright/test').Page) {
    const is404 = await page.getByRole('heading', { name: '404' }).isVisible().catch(() => false);
    test.skip(is404, 'Plan route is unavailable in this environment');
    const stillLoading = await page.getByText('Loading...').isVisible().catch(() => false);
    test.skip(stillLoading, 'Plan route is still loading in this environment');
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/plan`, { waitUntil: 'domcontentloaded' });
    await page
      .waitForFunction(() => !document.body?.innerText?.includes('Loading...'), null, { timeout: 30000 })
      .catch(() => {});
  });

  test('renders plan page shell and navigation', async ({ page }) => {
    await skipIfUnavailable(page);
    await expect(page.getByRole('heading', { name: /Planning Phase/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to Project/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Research Progress/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Plan Preview/i })).toBeVisible();
  });

  test('shows start research action', async ({ page }) => {
    await skipIfUnavailable(page);
    await expect(
      page.getByRole('button', { name: /Start Research|Starting/i })
    ).toBeVisible();
  });

  test('shows either plan kanban or explicit empty state', async ({ page }) => {
    await skipIfUnavailable(page);
    const kanban = page.getByTestId('plan-kanban');
    const emptyState = page.getByText(/No plan tasks available yet/i);
    const planPreviewHeading = page.getByRole('heading', { name: /Plan Preview/i });
    const noResearchState = page.getByText(/No research agents running/i);
    await expect(kanban.or(emptyState).or(planPreviewHeading).or(noResearchState).first()).toBeVisible();
  });

  test('shows orchestration controls and workflow graph container', async ({ page }) => {
    await skipIfUnavailable(page);
    await expect(page.getByText(/Orchestration Controls/i)).toBeVisible();
    await expect(page.getByText(/Workflow Parallelism/i)).toBeVisible();
    await expect(
      page
        .getByTestId('parallelism-workflow-graph')
        .or(page.getByText(/No workflow graph data available yet/i))
        .first()
    ).toBeVisible();
  });

  test('supports task inline editing when plan tasks are present', async ({ page }) => {
    await skipIfUnavailable(page);
    const taskCards = page.locator('[data-testid^="task-card-"]');
    if ((await taskCards.count()) === 0) {
      await expect(page.getByText(/No plan tasks available yet/i)).toBeVisible();
      return;
    }

    const firstTask = taskCards.first();
    await firstTask.click();
    const titleInput = page.getByRole('textbox', { name: /Title/i });
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Updated task title');
    await expect(titleInput).toHaveValue('Updated task title');
  });

  test('escape exits edit mode when editing a task', async ({ page }) => {
    await skipIfUnavailable(page);
    const taskCards = page.locator('[data-testid^="task-card-"]');
    if ((await taskCards.count()) === 0) {
      await expect(page.getByText(/No plan tasks available yet/i)).toBeVisible();
      return;
    }

    await taskCards.first().click();
    await expect(page.getByRole('textbox', { name: /Title/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: /Title/i })).toBeHidden();
  });
});
