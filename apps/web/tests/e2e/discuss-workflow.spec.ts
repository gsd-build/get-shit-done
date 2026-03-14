import { test, expect, type Page } from '@playwright/test';

test.describe('Discuss Phase Full Workflow', () => {
  const projectId = process.env['E2E_PROJECT_ID'] || 'get-shit-done';

  async function chatInput(page: Page) {
    return page.getByPlaceholder('Ask about goals, constraints, users, or decisions...').first();
  }

  async function sendButton(page: Page) {
    return page.locator('form button[type="submit"]').first();
  }

  test('dashboard lists projects and navigates to project detail', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const projectCard = page.locator('[role="button"][aria-label]').first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();

    await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 10000 });
  });

  test('project detail links to discuss phase', async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');

    const discussLink = page.locator('a[href$="/discuss"]').first();
    await expect(discussLink).toBeVisible({ timeout: 10000 });

    await discussLink.click();
    await page.waitForURL(`**/projects/${projectId}/discuss`, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Discuss' })).toBeVisible();
  });

  test('discuss page shows conversation + preview panels', async ({ page }) => {
    await page.goto(`/projects/${projectId}/discuss`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Conversation')).toBeVisible();
    await expect(page.getByText('CONTEXT.md Preview')).toBeVisible();

    const input = await chatInput(page);
    await expect(input).toBeVisible();
  });

  test('chat flow sends message and receives assistant response', async ({ page }) => {
    const message = 'Workflow test message';

    await page.goto(`/projects/${projectId}/discuss`);
    await page.waitForLoadState('networkidle');

    const input = await chatInput(page);
    const send = await sendButton(page);

    await input.fill(message);
    await send.click();

    await expect(page.getByText(message).first()).toBeVisible({ timeout: 10000 });
    await expect(input).toBeDisabled({ timeout: 10000 });
  });

  test('back navigation returns to project detail', async ({ page }) => {
    await page.goto(`/projects/${projectId}/discuss`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /back to project/i }).click();
    await page.waitForURL(`**/projects/${projectId}`, { timeout: 10000 });
  });
});
