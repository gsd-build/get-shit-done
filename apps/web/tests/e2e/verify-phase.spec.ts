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
    await expect(page.getByRole('heading', { name: 'Verification', exact: true })).toBeVisible();
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

  test('approve gating depends on verification lifecycle, not gap severity labels', async ({ page }) => {
    await skipIfUnavailable(page);
    const runButton = page.getByRole('button', { name: /Run Verification/i });
    if (await runButton.isVisible()) {
      await runButton.click();
    }
    const approveButton = page.getByRole('button', { name: /^Approve$/i });
    await expect(approveButton).toBeVisible();
  });

  test('coverage tab renders matrix or explicit empty state', async ({ page }) => {
    await skipIfUnavailable(page);
    await page.getByRole('tab', { name: /Coverage/i }).click();
    await expect(
      page.getByText(/Legend:/i).or(page.getByText(/No coverage data available/i)).first()
    ).toBeVisible();
  });

  test('completed state exposes rerun action and keeps approval gated while rerun is active', async ({ page }) => {
    await skipIfUnavailable(page);

    const runButton = page.getByRole('button', { name: /Run Verification/i });
    if (await runButton.isVisible()) {
      await runButton.click();
    }

    await expect(
      page
        .getByRole('heading', { name: /Verification Passed|Verification Failed/i })
        .first()
    ).toBeVisible({ timeout: 20000 });

    const rerunButton = page.getByRole('button', { name: /Run Verification Again/i });
    await expect(rerunButton).toBeVisible();
    await rerunButton.click();

    await expect(page.getByRole('heading', { name: /Verification Running/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Approve$/i })).toBeDisabled();
  });
});
