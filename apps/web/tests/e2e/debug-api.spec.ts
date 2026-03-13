import { test, expect } from '@playwright/test';

test('Debug: Capture console logs from projects loading', async ({ page }) => {
  const consoleLogs: string[] = [];

  // Capture ALL console messages
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    console.log(`Browser console [${msg.type()}]: ${text}`);
  });

  page.on('pageerror', error => {
    consoleLogs.push(`[pageerror] ${error.message}`);
    console.log(`Page error: ${error.message}`);
  });

  // Navigate to the page
  await page.goto('/');

  // Wait for initial render
  await page.waitForLoadState('networkidle');

  // Wait a bit for any async operations
  await page.waitForTimeout(3000);

  // Output all captured logs
  console.log('\n=== ALL CAPTURED CONSOLE LOGS ===');
  consoleLogs.forEach(log => console.log(log));
  console.log('=== END LOGS ===\n');

  // Check for useProjects logs
  const useProjectsLogs = consoleLogs.filter(l => l.includes('[useProjects]'));
  console.log('useProjects logs:', useProjectsLogs);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-api.png', fullPage: true });

  // If no useProjects logs, something is wrong with the hook loading
  if (useProjectsLogs.length === 0) {
    console.log('WARNING: No useProjects logs found - hook may not be executing');
  }
});

test('Debug: Direct fetch from browser context', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Execute fetch directly in browser context
  const result = await page.evaluate(async () => {
    try {
      const response = await fetch('http://localhost:4000/api/projects');
      const json = await response.json();
      return {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        body: json,
      };
    } catch (err) {
      return { error: String(err) };
    }
  });

  console.log('Direct fetch result:', JSON.stringify(result, null, 2));

  // Verify fetch works in browser context
  expect(result).not.toHaveProperty('error');
  expect(result.ok).toBeTruthy();
  expect(result.body?.data?.items?.length).toBeGreaterThan(0);
});
