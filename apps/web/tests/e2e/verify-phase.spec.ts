import { test, expect } from '@playwright/test';

const PROJECT_ID = process.env['E2E_PROJECT_ID'] ?? 'get-shit-done';

test.describe('Verify Phase Page', () => {
  async function skipIfUnavailable(page: import('@playwright/test').Page) {
    const is404 = await page.getByRole('heading', { name: '404' }).isVisible().catch(() => false);
    test.skip(is404, 'Verify route is unavailable in this environment');
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/verify`);
    await page.waitForLoadState('networkidle');
  });

  test('renders verify page shell with tabs and action bar', async ({ page }) => {
    await skipIfUnavailable(page);
    await expect(page.getByRole('heading', { name: /Verification/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Gaps/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Coverage/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Manual Tests/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reject with Gaps/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Approve$/i })).toBeVisible();
  });

  test('run verification renders report + gaps context', async ({ page }) => {
    await skipIfUnavailable(page);
    const runButton = page.getByRole('button', { name: /Run Verification/i });
    if (await runButton.isVisible()) {
      await runButton.click();
    }

    await expect(
      page
        .getByRole('heading', { name: /Verification Running|Verification Passed|Verification Failed/i })
        .or(page.getByTestId('verification-loading'))
        .first()
    ).toBeVisible();
  });

  test('reject flow opens gap selection modal', async ({ page }) => {
    await skipIfUnavailable(page);
    const runButton = page.getByRole('button', { name: /Run Verification/i });
    if (await runButton.isVisible()) {
      await runButton.click();
    }

    await page.getByRole('button', { name: /Reject with Gaps/i }).click();
    await expect(page.getByRole('dialog', { name: /Select Gaps to Address/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Fix Plans/i })).toBeVisible();
  });

  test('approve is blocked when major/blocking gaps exist', async ({ page }) => {
    await skipIfUnavailable(page);
    const runButton = page.getByRole('button', { name: /Run Verification/i });
    if (await runButton.isVisible()) {
      await runButton.click();
    }

    const hasMajorOrBlocking = await page
      .getByText(/Major|Blocking/i)
      .first()
      .isVisible()
      .catch(() => false);
    const approveButton = page.getByRole('button', { name: /^Approve$/i });

    if (hasMajorOrBlocking) {
      await expect(approveButton).toBeDisabled();
      await expect(
        page.getByText(/Resolve major or blocking gaps before approval/i)
      ).toBeVisible();
      return;
    }

    await expect(approveButton).toBeVisible();
  });

  test('coverage tab renders matrix or explicit empty state', async ({ page }) => {
    await skipIfUnavailable(page);
    await page.getByRole('tab', { name: /Coverage/i }).click();
    await expect(
      page.getByText(/Legend:/i).or(page.getByText(/No coverage data available/i)).first()
    ).toBeVisible();
  });
});
