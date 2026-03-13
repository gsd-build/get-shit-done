import { test, expect } from '@playwright/test';

/**
 * E2E tests for Projects API integration.
 * Tests the full flow from frontend to backend API.
 */
test.describe('Projects API Integration', () => {
  test('API returns projects with correct structure', async ({ request }) => {
    const response = await request.get('http://localhost:4000/api/projects');

    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    console.log('API Response:', JSON.stringify(json, null, 2));

    // Check response structure
    expect(json).toHaveProperty('data');
    expect(json).toHaveProperty('meta');
    expect(json.data).toHaveProperty('items');
    expect(json.data).toHaveProperty('pagination');
    expect(Array.isArray(json.data.items)).toBeTruthy();

    // Check pagination structure
    expect(json.data.pagination).toHaveProperty('total');
    expect(json.data.pagination).toHaveProperty('hasNextPage');

    // If there are projects, check their structure
    if (json.data.items.length > 0) {
      const project = json.data.items[0];
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('path');
      expect(project).toHaveProperty('status');
      expect(project).toHaveProperty('health');
      expect(project).toHaveProperty('progress');

      // Check health structure
      expect(project.health).toHaveProperty('status');
      expect(['healthy', 'degraded', 'error']).toContain(project.health.status);

      // Check progress structure
      expect(project.progress).toHaveProperty('percentage');
      expect(typeof project.progress.percentage).toBe('number');
    }
  });

  test('CORS headers are present', async ({ request }) => {
    const response = await request.get('http://localhost:4000/api/projects', {
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    expect(response.ok()).toBeTruthy();

    const headers = response.headers();
    console.log('Response headers:', headers);

    expect(headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(headers['access-control-allow-credentials']).toBe('true');
  });

  test('Health endpoint returns valid data', async ({ request }) => {
    const response = await request.get('http://localhost:4000/api/health/summary');

    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    console.log('Health Response:', JSON.stringify(json, null, 2));

    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('socket');
    expect(json.data).toHaveProperty('server');
  });
});
