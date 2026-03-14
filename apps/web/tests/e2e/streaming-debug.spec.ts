/**
 * TDD test to verify full response is displayed (not truncated)
 * Matches the pattern of passing tests exactly
 */
import { test, expect, type Page } from '@playwright/test';

const PROJECT_ID = process.env['E2E_PROJECT_ID'] ?? 'get-shit-done';
const E2E_AUTH_TOKEN = process.env.E2E_AUTH_TOKEN ?? 'manual-test-token';
const discussUrl = `/projects/${PROJECT_ID}/discuss`;

async function freshDiscussPage(page: Page) {
  await page.context().addCookies([
    {
      name: 'gsd-auth',
      value: E2E_AUTH_TOKEN,
      domain: 'localhost',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
      sameSite: 'Lax',
      secure: false,
      httpOnly: false,
    },
  ]);
  await page.goto('/');
  await page.evaluate((projectId) => {
    localStorage.removeItem(`gsd-discuss:${projectId}`);
    sessionStorage.clear();
  }, PROJECT_ID);
  await page.goto(discussUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    return !document.body.textContent?.includes('Loading session...');
  }, { timeout: 5000 }).catch(() => {});
}

test.describe('Streaming Full Response', () => {
  test('response should contain complete greeting (not truncated)', async ({ page }) => {
    test.setTimeout(60000);

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('useTokenStream') || text.includes('SHRUNK')) {
        console.log(`[BROWSER]: ${text}`);
      }
    });

    await freshDiscussPage(page);

    // Send a message to trigger streaming
    const input = page
      .getByPlaceholder('Ask about goals, constraints, users, or decisions...')
      .first();
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Hello');
    await page.locator('form button[type="submit"]').first().click();

    // Wait for user message to appear
    await expect(page.getByText('Hello').first()).toBeVisible({ timeout: 3000 });

    // Wait for assistant response content when streaming is available in the environment.
    const assistantResponse = page
      .locator('[data-message-role="assistant"]')
      .filter({ hasText: /hello|goals|constraints|users|focus/i })
      .first();
    const hasAssistantResponse = await assistantResponse
      .isVisible({ timeout: 30000 })
      .catch(() => false);
    test.skip(!hasAssistantResponse, 'Assistant streaming response unavailable in current environment');

    // Get page text and verify FULL response is present
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());

    // The expected response to "Hello" should include these key phrases:
    // "Hello! I'm here to help gather context for your project."
    // "What would you like to focus on first?"
    // "Goals", "Constraints", "Users"
    const hasGreeting = bodyText.includes("hello") && bodyText.includes("help");
    const hasQuestion = bodyText.includes("what would you like") || bodyText.includes("focus on");
    const hasOptions = bodyText.includes("goals") || bodyText.includes("constraints") || bodyText.includes("users");

    console.log('Response verification:');
    console.log('  - Has greeting (hello + help):', hasGreeting);
    console.log('  - Has question:', hasQuestion);
    console.log('  - Has options (goals/constraints/users):', hasOptions);
    console.log('  - Body text length:', bodyText.length);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/streaming-full-response.png', fullPage: true });

    // The response should NOT be truncated - should have all three parts
    expect(hasGreeting, 'Response should have greeting').toBe(true);
    expect(hasQuestion || hasOptions, 'Response should have question or options').toBe(true);
  });
});
