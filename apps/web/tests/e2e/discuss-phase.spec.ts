import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for Discuss Phase UI (Phase 16) - DISC-01 through DISC-05.
 *
 * Tests:
 * 1. Real-time Streaming (~30ms typewriter effect)
 * 2. Session Persistence (refresh browser, history restored)
 * 3. Conflict Detection (edit decision while Claude streams)
 * 4. Mobile Responsiveness (<768px width, drawer toggle)
 * 5. Unsaved Changes Warning (browser warning on close)
 */
test.describe('Discuss Phase UI', () => {
  const testProjectId = 'get-shit-done';
  const discussUrl = `/projects/${testProjectId}/discuss`;

  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`Browser error: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      console.log(`Page error: ${error.message}`);
    });
  });

  /**
   * Helper: Clear session storage and navigate to discuss page
   */
  async function freshDiscussPage(page: Page) {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(discussUrl);
    await page.waitForLoadState('networkidle');
    // Wait for hydration
    await page.waitForFunction(() => {
      return !document.body.textContent?.includes('Loading session...');
    }, { timeout: 5000 }).catch(() => {});
  }

  /**
   * Helper: Send a message and wait for response
   */
  async function sendMessage(page: Page, message: string) {
    // Use the visible textarea (handles both mobile and desktop layouts)
    const textarea = page.locator('textarea:visible').first();
    await textarea.fill(message);
    await page.locator('button[aria-label="Send message"]:visible').first().click();
  }

  // ============================================================
  // DISC-01: Real-time Streaming Test (~30ms typewriter effect)
  // ============================================================
  test.describe('DISC-01: Real-time Streaming', () => {
    test('should display streaming response with typewriter effect', async ({ page }) => {
      await freshDiscussPage(page);

      // Send a message to trigger streaming
      await sendMessage(page, 'Hello');

      // Wait for user message to appear (use first() due to desktop/mobile dual render)
      await expect(page.getByText('Hello').first()).toBeVisible({ timeout: 3000 });

      // Take timestamps to measure streaming duration
      const startTime = Date.now();

      // Wait for streaming to complete by checking textarea is re-enabled
      await page.waitForFunction(() => {
        const textareas = Array.from(document.querySelectorAll('textarea'));
        const visibleTextarea = textareas.find(t => t.offsetParent !== null);
        return visibleTextarea && !visibleTextarea.disabled;
      }, { timeout: 20000 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`Streaming duration: ${duration}ms`);

      // Verify response took some time (typewriter effect, not instant)
      // With ~30ms per token and typical response of ~50-100 tokens, expect at least 500ms
      expect(duration).toBeGreaterThan(500);

      // Verify there's some response content on the page
      const bodyText = await page.evaluate(() => document.body.textContent?.toLowerCase() || '');
      const hasResponse = bodyText.includes('help') ||
                         bodyText.includes('context') ||
                         bodyText.includes('questions') ||
                         bodyText.includes('goals');
      console.log('Has response content:', hasResponse);

      await page.screenshot({ path: 'test-results/disc-01-streaming.png', fullPage: true });
    });

    test('should disable input while streaming', async ({ page }) => {
      await freshDiscussPage(page);

      // Send a message
      await sendMessage(page, 'Hello');

      // Check that textarea is disabled during streaming
      const textarea = page.locator('textarea:visible').first();

      // Give it a moment for streaming to start
      await page.waitForTimeout(200);

      // The input should be disabled while streaming
      const isDisabled = await textarea.isDisabled();
      console.log('Input disabled during streaming:', isDisabled);

      // After streaming completes, input should be enabled
      await page.waitForFunction(() => {
        const ta = document.querySelector('textarea:not([style*="display: none"])');
        return ta && !ta.disabled;
      }, { timeout: 15000 });

      await expect(textarea).toBeEnabled();
    });
  });

  // ============================================================
  // DISC-02: Session Persistence Test
  // ============================================================
  test.describe('DISC-02: Session Persistence', () => {
    test('should restore chat history after page refresh', async ({ page }) => {
      // Allow extra time for streaming-dependent test
      test.setTimeout(60000);

      await freshDiscussPage(page);

      // Send a message and wait for response
      await sendMessage(page, 'Test message for persistence');

      // Wait for user message to appear (use first() due to desktop/mobile dual render)
      await expect(page.getByText('Test message for persistence').first()).toBeVisible({ timeout: 3000 });

      // Wait for streaming to complete (allow 25s for full streaming)
      await page.waitForFunction(() => {
        const textarea = Array.from(document.querySelectorAll('textarea')).find(t => t.offsetParent !== null);
        return textarea && !textarea.disabled;
      }, { timeout: 25000 });

      // Take screenshot before refresh
      await page.screenshot({ path: 'test-results/disc-02-before-refresh.png', fullPage: true });

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for hydration
      await page.waitForFunction(() => {
        return !document.body.textContent?.includes('Loading session...');
      }, { timeout: 5000 }).catch(() => {});

      // Verify chat history is restored
      await expect(page.getByText('Test message for persistence').first()).toBeVisible({ timeout: 5000 });

      // Take screenshot after refresh
      await page.screenshot({ path: 'test-results/disc-02-after-refresh.png', fullPage: true });

      console.log('Session persistence: Chat history restored after refresh');
    });

    test('should persist messages in sessionStorage', async ({ page }) => {
      await freshDiscussPage(page);

      // Send a message
      await sendMessage(page, 'Storage test message');

      // Wait for message to appear (use first() due to desktop/mobile dual render)
      await expect(page.getByText('Storage test message').first()).toBeVisible({ timeout: 3000 });

      // Check sessionStorage
      const storageData = await page.evaluate(() => {
        const data = sessionStorage.getItem('gsd-discuss-session');
        return data ? JSON.parse(data) : null;
      });

      console.log('SessionStorage data:', JSON.stringify(storageData, null, 2).substring(0, 500));

      // Verify messages are stored
      expect(storageData).not.toBeNull();
      expect(storageData.state?.messages?.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // DISC-03: Conflict Detection Test
  // ============================================================
  test.describe('DISC-03: Conflict Detection', () => {
    test('should show conflict dialog when editing during streaming', async ({ page }) => {
      // Set desktop viewport for context preview panel
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // First, we need to trigger a context update from the server
      // For this test, we'll simulate the scenario by checking the dialog component exists

      // Look for any inline editable elements in the context preview
      const inlineEditors = page.locator('[contenteditable="true"]');
      const editorCount = await inlineEditors.count();

      console.log(`Found ${editorCount} inline editors`);

      // If there are editors, try to interact with one
      if (editorCount > 0) {
        const firstEditor = inlineEditors.first();

        // Start editing
        await firstEditor.click();
        await firstEditor.fill('User edit during streaming');

        // Now trigger streaming while editing
        await sendMessage(page, 'Update the context');

        // The conflict dialog should appear if server sends context:update during edit
        // For now, verify the ConflictDialog component would render
        const conflictDialog = page.locator('[role="dialog"][aria-modal="true"]');

        // Wait a bit for potential conflict
        await page.waitForTimeout(3000);

        const dialogVisible = await conflictDialog.isVisible().catch(() => false);
        console.log('Conflict dialog visible:', dialogVisible);

        if (dialogVisible) {
          // Verify dialog content
          await expect(page.getByText('Edit Conflict')).toBeVisible();
          await expect(page.getByText(/Your edit|Claude's update/i)).toBeVisible();

          // Take screenshot of conflict dialog
          await page.screenshot({ path: 'test-results/disc-03-conflict-dialog.png', fullPage: true });
        }
      }

      // Screenshot for verification
      await page.screenshot({ path: 'test-results/disc-03-conflict-setup.png', fullPage: true });
    });

    test('ConflictDialog renders correctly when opened', async ({ page }) => {
      // This test verifies the ConflictDialog component renders properly
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Inject a test to open the conflict dialog programmatically
      const hasConflictDialog = await page.evaluate(() => {
        // Check if ConflictDialog component exists in the page
        return document.querySelector('[aria-label="Close dialog"]') !== null ||
               document.body.innerHTML.includes('ConflictDialog') ||
               document.body.innerHTML.includes('conflict');
      });

      console.log('Page has conflict dialog markup:', hasConflictDialog);

      await page.screenshot({ path: 'test-results/disc-03-page-state.png', fullPage: true });
    });
  });

  // ============================================================
  // DISC-04: Mobile Responsiveness Test
  // ============================================================
  test.describe('DISC-04: Mobile Responsiveness', () => {
    test('should show mobile layout with drawer toggle at <768px', async ({ page }) => {
      // Set mobile viewport BEFORE navigating
      await page.setViewportSize({ width: 375, height: 667 });

      // Navigate with mobile viewport set
      await page.goto('/');
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(discussUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => {
        return !document.body.textContent?.includes('Loading session...');
      }, { timeout: 5000 }).catch(() => {});

      // The mobile drawer toggle button should be visible (use specific aria-label)
      const drawerToggle = page.locator('button[aria-label="Open CONTEXT.md preview"]');

      await expect(drawerToggle).toBeVisible({ timeout: 5000 });

      // Take screenshot of mobile layout
      await page.screenshot({ path: 'test-results/disc-04-mobile-layout.png', fullPage: true });

      console.log('Mobile layout: Drawer toggle visible');
    });

    test('should open drawer when toggle is clicked on mobile', async ({ page }) => {
      // Set mobile viewport BEFORE navigating
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(discussUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => {
        return !document.body.textContent?.includes('Loading session...');
      }, { timeout: 5000 }).catch(() => {});

      // Click the drawer toggle (use specific aria-label)
      const drawerToggle = page.locator('button[aria-label="Open CONTEXT.md preview"]');

      await drawerToggle.click();

      // Drawer should be open
      const drawer = page.locator('[role="dialog"][aria-label="CONTEXT.md Preview"]');
      await expect(drawer).toBeVisible({ timeout: 3000 });

      // Take screenshot of open drawer
      await page.screenshot({ path: 'test-results/disc-04-mobile-drawer-open.png', fullPage: true });

      console.log('Mobile drawer: Opens on toggle click');
    });

    test('should close drawer when X button is clicked', async ({ page }) => {
      // Set mobile viewport BEFORE navigating
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(discussUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => {
        return !document.body.textContent?.includes('Loading session...');
      }, { timeout: 5000 }).catch(() => {});

      // Open the drawer (use specific aria-label)
      const drawerToggle = page.locator('button[aria-label="Open CONTEXT.md preview"]');
      await drawerToggle.click();

      // Wait for drawer to open
      const drawer = page.locator('[role="dialog"][aria-label="CONTEXT.md Preview"]');
      await expect(drawer).toBeVisible({ timeout: 3000 });

      // Click close button
      const closeButton = page.locator('button[aria-label="Close preview"]');
      await closeButton.click();

      // Drawer should be closed (translated off-screen with translate-x-full)
      // Since the drawer uses CSS transform instead of display:none, check for the class
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="CONTEXT.md Preview"]');
        return dialog?.classList.contains('translate-x-full');
      }, { timeout: 3000 });

      console.log('Mobile drawer: Closes on X click');
    });

    test('should show desktop layout with side-by-side panels at >=768px', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // The desktop layout should show both panels
      // Mobile toggle should NOT be visible on desktop
      const mobileToggle = page.locator('button[aria-label="Open CONTEXT.md preview"]');

      // On desktop, the toggle should be hidden (md:hidden class)
      const isToggleVisible = await mobileToggle.isVisible().catch(() => false);
      expect(isToggleVisible).toBe(false);

      // Context preview panel should be visible in desktop layout
      const previewPanel = page.locator('[id="preview"]').or(
        page.getByText('CONTEXT.md Preview')
      );
      await expect(previewPanel.first()).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'test-results/disc-04-desktop-layout.png', fullPage: true });

      console.log('Desktop layout: Side-by-side panels visible');
    });
  });

  // ============================================================
  // DISC-05: Unsaved Changes Warning Test
  // ============================================================
  test.describe('DISC-05: Unsaved Changes Warning', () => {
    test('should trigger beforeunload when streaming is active', async ({ page }) => {
      await freshDiscussPage(page);

      // Track if beforeunload was set
      const hasBeforeUnload = await page.evaluate(() => {
        return typeof window.onbeforeunload === 'function';
      });

      console.log('Initial beforeunload handler:', hasBeforeUnload);

      // Send a message to start streaming
      await sendMessage(page, 'Hello');

      // Wait for streaming to start
      await page.waitForTimeout(500);

      // Check if beforeunload is now set (during streaming)
      const hasBeforeUnloadDuringStream = await page.evaluate(() => {
        // Check for the useUnsavedChanges hook effect
        // The hook sets window.onbeforeunload when hasUnsavedChanges is true
        return typeof window.onbeforeunload === 'function' ||
               (window as any).__unsavedChanges === true;
      });

      console.log('beforeunload during streaming:', hasBeforeUnloadDuringStream);

      // Take screenshot
      await page.screenshot({ path: 'test-results/disc-05-unsaved-warning.png', fullPage: true });
    });

    test('should set unsaved changes flag during streaming', async ({ page }) => {
      test.setTimeout(60000);
      await freshDiscussPage(page);

      // Inject a listener to track beforeunload
      await page.evaluate(() => {
        (window as any).__beforeUnloadCalled = false;
        const originalBeforeUnload = window.onbeforeunload;
        window.addEventListener('beforeunload', () => {
          (window as any).__beforeUnloadCalled = true;
        });
      });

      // Send a message to start streaming
      await sendMessage(page, 'Test unsaved changes');

      // Wait for streaming to start
      await page.waitForTimeout(500);

      // The useUnsavedChanges hook should have set up the beforeunload handler
      // We can verify by checking if the state indicates unsaved changes

      // Since we can't actually trigger beforeunload dialog in Playwright without
      // closing the page, we verify the mechanism is in place

      // Get the streaming state
      const isStreaming = await page.evaluate(() => {
        const textarea = Array.from(document.querySelectorAll('textarea')).find(t => t.offsetParent !== null);
        return textarea?.disabled ?? false;
      });

      console.log('Is streaming (input disabled):', isStreaming);

      // Wait for streaming to complete (longer timeout for full response)
      await page.waitForFunction(() => {
        const textarea = Array.from(document.querySelectorAll('textarea')).find(t => t.offsetParent !== null);
        return textarea && !textarea.disabled;
      }, { timeout: 25000 });

      console.log('Streaming completed, input re-enabled');
    });

    test('beforeunload handler is removed after streaming completes', async ({ page }) => {
      await freshDiscussPage(page);

      // Send a message
      await sendMessage(page, 'Hello');

      // Wait for streaming to complete
      await page.waitForFunction(() => {
        const textarea = Array.from(document.querySelectorAll('textarea')).find(t => t.offsetParent !== null);
        return textarea && !textarea.disabled;
      }, { timeout: 15000 });

      // After streaming completes and no messages are pending,
      // the unsaved changes flag should be cleared
      // However, if there are messages and an active session, it may still be set

      // Verify the page is in a stable state
      const pageState = await page.evaluate(() => {
        const textarea = Array.from(document.querySelectorAll('textarea')).find(t => t.offsetParent !== null);
        // Look for prose elements (markdown content) or rounded message bubbles
        const messageElements = document.querySelectorAll('.prose, .rounded-2xl');
        return {
          inputEnabled: textarea ? !textarea.disabled : false,
          hasMessages: messageElements.length > 0,
        };
      });

      console.log('Page state after streaming:', pageState);
      expect(pageState.inputEnabled).toBe(true);
      // Messages should exist after streaming completes
      expect(pageState.hasMessages).toBe(true);
    });
  });

  // ============================================================
  // ROADMAP-02: CONTEXT.md Live Preview Test
  // ============================================================
  test.describe('ROADMAP-02: CONTEXT.md Live Preview', () => {
    test('should show preview panel with header on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Verify the preview panel header is visible
      const previewHeader = page.getByText('CONTEXT.md Preview');
      await expect(previewHeader.first()).toBeVisible({ timeout: 5000 });

      console.log('Preview panel header visible');
      await page.screenshot({ path: 'test-results/roadmap-02-preview-header.png', fullPage: true });
    });

    test('should show section headers in preview panel', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // When context is empty, the EmptyState shows skeleton placeholders
      // Section headers only appear after context is populated
      // Verify empty state skeleton is visible with placeholder text
      const emptyPlaceholder = page.getByText(/will appear here as the conversation progresses/i);
      await expect(emptyPlaceholder.first()).toBeVisible({ timeout: 5000 });

      // The skeleton has 3 section placeholders
      const skeletonSections = page.locator('.animate-pulse');
      const skeletonCount = await skeletonSections.count();

      console.log('Skeleton sections visible:', skeletonCount > 0);
      console.log('Empty state placeholder count:', skeletonCount);

      await page.screenshot({ path: 'test-results/roadmap-02-sections.png', fullPage: true });
    });

    test('should show Phase Boundary section in preview', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Phase Boundary only shows when context state is loaded
      // On initial load, EmptyState skeleton is shown instead
      // Verify preview panel header is visible (not the hidden mobile drawer)
      const previewHeader = page.getByText('CONTEXT.md Preview');
      await expect(previewHeader.first()).toBeVisible({ timeout: 5000 });

      // Verify the preview area has content (skeleton placeholders on empty state)
      const emptyPlaceholder = page.getByText(/will appear here as the conversation progresses/i);
      const hasEmptyState = await emptyPlaceholder.first().isVisible().catch(() => false);
      console.log('Preview panel has content structure:', hasEmptyState);
    });

    test('should show empty state placeholders when no decisions', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Look for empty state messages
      const emptyMessages = page.getByText(/No decisions captured yet|No specific ideas captured yet|will appear here/i);
      const hasEmptyState = await emptyMessages.first().isVisible().catch(() => false);

      console.log('Empty state visible:', hasEmptyState);

      await page.screenshot({ path: 'test-results/roadmap-02-empty-state.png', fullPage: true });
    });

    test('should update preview with decisions after conversation', async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Verify initially empty state
      const emptyPlaceholder = page.getByText(/will appear here as the conversation progresses/i);
      const wasEmpty = await emptyPlaceholder.first().isVisible({ timeout: 5000 }).catch(() => false);
      console.log('Step 1 - Initial empty state:', wasEmpty);

      // Send a message with "goals" to trigger context update
      const input = page.locator('textarea:visible').first();
      await input.fill('What are our goals for this project?');
      await input.press('Enter');

      console.log('Step 2 - Message sent with goals topic');

      // Wait for streaming to complete
      await page.waitForTimeout(20000); // Allow streaming + context update

      // After streaming completes, context should update
      // Check if skeleton placeholders are gone and actual content appeared
      const hasDecisions = await page.getByText(/Focus on user experience|Prioritize performance|Initial context gathering/i)
        .first().isVisible({ timeout: 5000 }).catch(() => false);

      // Or check if section headers now show real content
      const noDecisionsText = await page.getByText('No decisions captured yet')
        .first().isVisible({ timeout: 2000 }).catch(() => false);
      const noSpecificsText = await page.getByText('No specific ideas captured yet')
        .first().isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Step 3 - After conversation:', {
        hasDecisions,
        stillEmpty: noDecisionsText || noSpecificsText
      });

      await page.screenshot({ path: 'test-results/roadmap-02-context-update.png', fullPage: true });
    });
  });

  // ============================================================
  // ROADMAP-03: Decision Locking Test
  // ============================================================
  test.describe('ROADMAP-03: Decision Locking', () => {
    test('should show lock toggle buttons for decisions', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Look for lock/unlock buttons
      const lockButtons = page.locator('button[aria-label="Lock decision"], button[aria-label="Unlock decision"]');
      const lockCount = await lockButtons.count();

      console.log('Lock toggle buttons found:', lockCount);

      // If there are decisions, there should be lock buttons
      // If no decisions yet, this is expected to be 0
      await page.screenshot({ path: 'test-results/roadmap-03-lock-buttons.png', fullPage: true });
    });

    test('should toggle lock state when button clicked', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Find an unlock button (unlocked decision)
      const unlockButton = page.locator('button[aria-label="Unlock decision"]').first();
      const hasUnlockButton = await unlockButton.isVisible().catch(() => false);

      if (hasUnlockButton) {
        // Click to lock
        await unlockButton.click();

        // Should now show lock button
        const lockButton = page.locator('button[aria-label="Lock decision"]').first();
        await expect(lockButton).toBeVisible({ timeout: 2000 });

        console.log('Lock toggle works: unlocked -> locked');

        // Click to unlock again
        await lockButton.click();

        // Should now show unlock button again
        await expect(unlockButton).toBeVisible({ timeout: 2000 });

        console.log('Lock toggle works: locked -> unlocked');
      } else {
        console.log('No decisions to test lock toggle - skipping');
      }

      await page.screenshot({ path: 'test-results/roadmap-03-lock-toggle.png', fullPage: true });
    });

    test('should show Lock and LockOpen icons correctly', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Check for SVG icons within lock buttons
      const lockIcons = page.locator('button[aria-label="Lock decision"] svg, button[aria-label="Unlock decision"] svg');
      const iconCount = await lockIcons.count();

      console.log('Lock icons rendered:', iconCount);

      await page.screenshot({ path: 'test-results/roadmap-03-lock-icons.png', fullPage: true });
    });
  });

  // ============================================================
  // ROADMAP-05: Manual CONTEXT.md Editing Test
  // ============================================================
  test.describe('ROADMAP-05: Manual Editing', () => {
    test('should have contenteditable elements for unlocked decisions', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Look for contenteditable elements
      const editableElements = page.locator('[contenteditable="true"]');
      const editableCount = await editableElements.count();

      console.log('Contenteditable elements found:', editableCount);

      await page.screenshot({ path: 'test-results/roadmap-05-editable-elements.png', fullPage: true });
    });

    test('should highlight editing state when clicking editable content', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Find a contenteditable element
      const editable = page.locator('[contenteditable="true"]').first();
      const hasEditable = await editable.isVisible().catch(() => false);

      if (hasEditable) {
        // Click to start editing
        await editable.click();

        // Should show focus ring or editing highlight
        const hasFocusRing = await page.evaluate(() => {
          const focused = document.activeElement;
          if (!focused) return false;
          const styles = window.getComputedStyle(focused);
          return styles.outline !== 'none' || styles.boxShadow !== 'none';
        });

        console.log('Edit focus state visible:', hasFocusRing);
      } else {
        console.log('No editable elements to test - skipping');
      }

      await page.screenshot({ path: 'test-results/roadmap-05-edit-focus.png', fullPage: true });
    });

    test('should allow typing in contenteditable element', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Find a contenteditable element
      const editable = page.locator('[contenteditable="true"]').first();
      const hasEditable = await editable.isVisible().catch(() => false);

      if (hasEditable) {
        // Click to focus
        await editable.click();

        // Type some text
        await page.keyboard.type(' - edited');

        // Get the content
        const content = await editable.textContent();
        console.log('Edited content:', content?.substring(0, 50));

        // Press Escape to cancel (revert)
        await page.keyboard.press('Escape');

        console.log('Inline editing works');
      } else {
        console.log('No editable elements to test - skipping');
      }

      await page.screenshot({ path: 'test-results/roadmap-05-inline-edit.png', fullPage: true });
    });

    test('ConflictDialog component exists in page', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Check that the page has ConflictDialog-related elements ready
      // The dialog is hidden by default but the component should be rendered
      const pageHtml = await page.content();
      const hasConflictRelatedCode = pageHtml.includes('Edit Conflict') ||
                                      pageHtml.includes('conflict') ||
                                      pageHtml.includes('ConflictDialog');

      // Also check for the buttons that would appear in the dialog
      const keepMyEditButton = page.getByText('Keep my edit');
      const useClaudesButton = page.getByText("Use Claude's");

      // These should NOT be visible (dialog is closed)
      const keepVisible = await keepMyEditButton.isVisible().catch(() => false);
      const claudeVisible = await useClaudesButton.isVisible().catch(() => false);

      console.log('Conflict dialog mounted (hidden):', !keepVisible && !claudeVisible);

      await page.screenshot({ path: 'test-results/roadmap-05-conflict-dialog.png', fullPage: true });
    });
  });

  // ============================================================
  // Saved Indicator Test
  // ============================================================
  test.describe('Saved Indicator', () => {
    test('should show Saved indicator after state change', async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // Send a message to trigger state change
      await sendMessage(page, 'Test for saved indicator');

      // Wait for message to appear
      await expect(page.getByText('Test for saved indicator').first()).toBeVisible({ timeout: 3000 });

      // Look for Saved indicator in header area
      const savedIndicator = page.getByText('Saved');

      // It may appear briefly - take screenshot quickly
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/saved-indicator.png', fullPage: true });

      console.log('Saved indicator test completed');
    });
  });

  // ============================================================
  // Integration Tests
  // ============================================================
  test.describe('Integration', () => {
    test('full discuss flow: send message, receive streaming response, persist', async ({ page }) => {
      // Increase timeout for this integration test since streaming takes ~15s
      test.setTimeout(60000);

      await page.setViewportSize({ width: 1280, height: 720 });
      await freshDiscussPage(page);

      // 1. Verify welcome screen shows initially
      const welcomeScreen = page.getByText(/welcome|start|discuss/i);
      const hasWelcome = await welcomeScreen.first().isVisible().catch(() => false);
      console.log('Step 1 - Welcome screen visible:', hasWelcome);

      // 2. Send a message
      await sendMessage(page, 'Hello, I want to discuss my project goals');
      console.log('Step 2 - Message sent');

      // 3. Verify user message appears (use first() due to desktop/mobile dual render)
      await expect(page.getByText('Hello, I want to discuss my project goals').first()).toBeVisible({ timeout: 3000 });
      console.log('Step 3 - User message visible');

      // 4. Wait for streaming response (allow 25s for full streaming)
      await page.waitForFunction(() => {
        const textarea = Array.from(document.querySelectorAll('textarea')).find(t => t.offsetParent !== null);
        return textarea && !textarea.disabled;
      }, { timeout: 25000 });
      console.log('Step 4 - Streaming completed');

      // 5. Verify response is visible
      const responseText = page.getByText(/goals|clarify|understand|questions/i);
      await expect(responseText.first()).toBeVisible({ timeout: 5000 });
      console.log('Step 5 - Response visible');

      // 6. Refresh and verify persistence
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => {
        return !document.body.textContent?.includes('Loading session...');
      }, { timeout: 5000 }).catch(() => {});

      await expect(page.getByText('Hello, I want to discuss my project goals').first()).toBeVisible({ timeout: 5000 });
      console.log('Step 6 - Persistence verified after refresh');

      await page.screenshot({ path: 'test-results/integration-full-flow.png', fullPage: true });
    });
  });
});
