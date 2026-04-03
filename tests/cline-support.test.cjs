const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Cline runtime support', () => {
  test('.clinerules file exists at repo root', () => {
    const p = path.join(__dirname, '..', '.clinerules');
    assert.ok(fs.existsSync(p), '.clinerules should exist at repo root');
  });

  test('.clinerules references GSD workflow enforcement', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', '.clinerules'), 'utf-8');
    assert.ok(
      content.includes('gsd') || content.includes('GSD') || content.includes('workflow'),
      '.clinerules should mention GSD workflows'
    );
  });

  test('.clinerules includes coding standards', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', '.clinerules'), 'utf-8');
    assert.ok(content.includes('CommonJS') || content.includes('require'),
      '.clinerules should mention CommonJS standard');
    assert.ok(content.includes('node:test') || content.includes('node:assert'),
      '.clinerules should mention test framework');
  });

  test('.clinerules includes architecture overview', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', '.clinerules'), 'utf-8');
    assert.ok(content.includes('bin/lib') || content.includes('workflows') || content.includes('agents'),
      '.clinerules should describe project architecture');
  });
});
