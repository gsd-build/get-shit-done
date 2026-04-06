const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('package files include shell hooks', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  const files = pkg.files || [];

  assert.ok(
    files.some((entry) => entry === 'hooks' || entry === 'hooks/'),
    'package.json files must include hooks/ so .sh scripts are published'
  );
});
