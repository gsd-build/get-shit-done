const { test, describe } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');

process.env.GSD_TEST_MODE = '1';
const { toTildePrefix, toHomePrefix, getPathPrefix } = require('../bin/install.js');

const home = os.homedir().replace(/\\/g, '/');

describe('installer path privacy helpers', () => {
  test('toTildePrefix collapses in-home absolute paths', () => {
    assert.equal(toTildePrefix(`${home}/.claude/`), '~/.claude/');
    assert.equal(toTildePrefix(`${home}/custom/gsd/`), '~/custom/gsd/');
  });

  test('toHomePrefix preserves tilde-based paths as $HOME references', () => {
    assert.equal(toHomePrefix('~/.claude/'), '$HOME/.claude/');
    assert.equal(toHomePrefix('~/custom/gsd/'), '$HOME/custom/gsd/');
  });

  test('getPathPrefix keeps global Claude installs home-relative', () => {
    assert.equal(getPathPrefix('claude', true, `${home}/.claude`), '~/.claude/');
  });

  test('getPathPrefix keeps non-Claude global installs concrete', () => {
    assert.equal(getPathPrefix('codex', true, `${home}/.codex`), `${home}/.codex/`);
  });

  test('getPathPrefix keeps local installs runtime-relative', () => {
    assert.equal(getPathPrefix('claude', false, '/ignored'), './.claude/');
    assert.equal(getPathPrefix('codex', false, '/ignored'), './.codex/');
  });

  test('getPathPrefix leaves out-of-home Claude installs absolute', () => {
    assert.equal(getPathPrefix('claude', true, '/opt/shared/claude'), '/opt/shared/claude/');
  });

  test('Windows-style home paths also collapse to tilde/$HOME forms', () => {
    const originalHomedir = os.homedir;
    os.homedir = () => 'C:\\Users\\Nicole';
    try {
      assert.equal(toTildePrefix('C:\\Users\\Nicole\\.claude\\'), '~/.claude/');
      assert.equal(toHomePrefix('~/.claude/'), '$HOME/.claude/');
      assert.equal(getPathPrefix('claude', true, 'C:\\Users\\Nicole\\.claude'), '~/.claude/');
    } finally {
      os.homedir = originalHomedir;
    }
  });
});
