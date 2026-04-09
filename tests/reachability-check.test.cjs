const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('gsd-planner reachability_check step', () => {
  const plannerPath = path.join(__dirname, '..', 'agents', 'gsd-planner.md');
  let content;

  test('planner file exists', () => {
    assert.ok(fs.existsSync(plannerPath));
    content = fs.readFileSync(plannerPath, 'utf-8');
  });

  test('contains reachability_check step', () => {
    content = content || fs.readFileSync(plannerPath, 'utf-8');
    assert.ok(content.includes('<step name="reachability_check">'), 'Missing reachability_check step');
  });

  test('reachability_check appears after derive_must_haves', () => {
    content = content || fs.readFileSync(plannerPath, 'utf-8');
    const mustHavesIdx = content.indexOf('derive_must_haves');
    const reachabilityIdx = content.indexOf('reachability_check');
    assert.ok(mustHavesIdx > -1, 'derive_must_haves step not found');
    assert.ok(reachabilityIdx > -1, 'reachability_check step not found');
    assert.ok(reachabilityIdx > mustHavesIdx, 'reachability_check must come after derive_must_haves');
  });

  test('reachability_check appears before estimate_scope', () => {
    content = content || fs.readFileSync(plannerPath, 'utf-8');
    const reachabilityIdx = content.indexOf('reachability_check');
    const estimateIdx = content.indexOf('estimate_scope');
    assert.ok(estimateIdx > -1, 'estimate_scope step not found');
    assert.ok(reachabilityIdx < estimateIdx, 'reachability_check must come before estimate_scope');
  });

  test('reachability_check includes creation path check', () => {
    content = content || fs.readFileSync(plannerPath, 'utf-8');
    assert.ok(content.includes('creation path') || content.includes('creation_path') || content.includes('reachable'),
      'Missing creation path verification logic');
  });

  test('reachability_check includes UNREACHABLE marker', () => {
    content = content || fs.readFileSync(plannerPath, 'utf-8');
    assert.ok(content.includes('UNREACHABLE'), 'Missing UNREACHABLE marker for failed checks');
  });

  test('file stays under 50000 char limit (CRLF-normalized)', () => {
    content = content || fs.readFileSync(plannerPath, 'utf-8');
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    assert.ok(normalized.length < 50000, `File is ${normalized.length} chars, over the 50000 limit`);
  });
});
