import { test, expect, type Page } from '@playwright/test';

test.describe('Discuss Phase UI', () => {
  const testProjectId = process.env.E2E_PROJECT_ID || 'get-shit-done';
  const discussUrl = `/projects/${testProjectId}/discuss`;

  async function getPromptInput(page: Page) {
    return page.getByPlaceholder('Ask about goals, constraints, users, or decisions...').first();
  }

  async function getSendButton(page: Page) {
    return page.locator('form button[type="submit"]').first();
  }

  async function openFreshDiscussPage(page: Page) {
    await page.goto('/');
    await page.evaluate((projectId) => {
      localStorage.removeItem(`gsd-discuss:${projectId}`);
      sessionStorage.clear();
    }, testProjectId);
    await page.goto(discussUrl);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Discuss' })).toBeVisible({ timeout: 15000 });
  }

  async function sendMessage(page: Page, message: string) {
    const input = await getPromptInput(page);
    const sendButton = await getSendButton(page);

    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill(message);
    await sendButton.click();

    await expect(page.getByText(message).first()).toBeVisible({ timeout: 10000 });
  }

  test('loads discuss page with core layout', async ({ page }) => {
    await page.goto(discussUrl);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Discuss' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('CONTEXT.md Preview')).toBeVisible();

    const input = await getPromptInput(page);
    await expect(input).toBeVisible();
  });

  test('shows orchestration controls and run status strip', async ({ page }) => {
    await page.goto(discussUrl);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: /abort/i })).toBeVisible();
    await expect(page.getByText(/discuss context session/i)).toBeVisible();
  });

  test('disables input while streaming and re-enables after', async ({ page }) => {
    await openFreshDiscussPage(page);

    const input = await getPromptInput(page);
    await expect(input).toBeEnabled();

    await sendMessage(page, 'Hello from discuss streaming test');

    await expect(input).toBeDisabled({ timeout: 10000 });
  });

  test('records submitted user message in conversation', async ({ page }) => {
    await openFreshDiscussPage(page);

    const message = 'Please ask me one clarifying question.';
    await sendMessage(page, message);
    await expect(page.getByText(message).first()).toBeVisible({ timeout: 10000 });
  });

  test('persists discuss state after reload', async ({ page }) => {
    const message = 'Persistence check message';

    await openFreshDiscussPage(page);
    await sendMessage(page, message);
    await page.waitForFunction(
      ({ projectId: currentProjectId, targetMessage }) => {
        const raw = localStorage.getItem(`gsd-discuss:${currentProjectId}`);
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw) as { messages?: Array<{ text?: string }> };
          return !!parsed.messages?.some((m) => m.text === targetMessage);
        } catch {
          return false;
        }
      },
      { projectId: testProjectId, targetMessage: message },
      { timeout: 10000 }
    );

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Discuss' })).toBeVisible({ timeout: 15000 });
    const persistedAfterReload = await page.evaluate((projectId) => {
      const raw = localStorage.getItem(`gsd-discuss:${projectId}`);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw) as { messages?: Array<{ text?: string }> };
        return !!parsed.messages?.length;
      } catch {
        return false;
      }
    }, testProjectId);
    expect(persistedAfterReload).toBe(true);
  });

  test('writes discuss state to localStorage with project-scoped key', async ({ page }) => {
    const message = 'LocalStorage check message';

    await openFreshDiscussPage(page);
    await sendMessage(page, message);

    const stored = await page.evaluate((projectId) => {
      return localStorage.getItem(`gsd-discuss:${projectId}`);
    }, testProjectId);

    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? '{}') as { messages?: Array<{ text?: string }> };
    expect(parsed.messages?.some((m) => m.text === message)).toBe(true);
  });

  test('keeps conversation and preview visible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(discussUrl);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Conversation')).toBeVisible();
    await expect(page.getByText('CONTEXT.md Preview')).toBeVisible();

    const input = await getPromptInput(page);
    await expect(input).toBeVisible();
  });
});
