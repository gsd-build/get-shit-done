const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('package publish files include hooks directory so shell hooks are shipped (#1852)', () => {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const files = Array.isArray(pkg.files) ? pkg.files : [];

  assert.ok(
    files.includes('hooks') || files.includes('hooks/'),
    'package.json files must include hooks/ so .sh scripts are published'
  );
});
