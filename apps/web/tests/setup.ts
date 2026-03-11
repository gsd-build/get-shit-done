import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server.js';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Mock ResizeObserver for Radix UI components (not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset any request handlers that we may add during the tests
// Also cleanup React Testing Library renders
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Clean up after the tests are finished
afterAll(() => {
  server.close();
});
