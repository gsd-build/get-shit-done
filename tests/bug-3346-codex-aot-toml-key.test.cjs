/**
 * Regression: issue #3346 — Codex install fails on Windows when the legacy
 * Codex `[hooks]` config uses a `<file>:<event>:<line>:<col>` location tuple
 * as the table key (with the actual event name carried in an `event = "..."`
 * body field). `migrateCodexHooksMapFormat` re-emitted the location tuple
 * verbatim as the leaf TOML key, producing a header like
 *
 *   [[hooks."C:\Users\helen\.codex\config.toml:session_start:0:0"]]
 *
 * which Codex 0.124.0+ refuses to load (the leaf key segment is supposed to
 * be the event name, not a diagnostic location identifier).
 *
 * Expected behaviour: when the legacy `[hooks.<X>]` body declares an
 * `event = "..."` field, the migrator must use that event name as the leaf
 * TOML key for the emitted `[[hooks.<EVENT>]]` two-level nested AoT block.
 *
 * Test discipline: parse the migrated TOML with the project's own
 * `parseTomlToObject` and assert on the resulting object shape — never
 * grep the raw string.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  migrateCodexHooksMapFormat,
  parseTomlToObject,
} = require('../bin/install.js');

describe('#3346 — Codex AoT hooks migration emits event-name leaf key, not location tuple', () => {
  test('legacy [hooks."<location-tuple>"] with event="..." body migrates to [[hooks.<event>]]', () => {
    // Pre-install fixture: a legacy `[hooks.<quoted-key>]` block whose key is
    // a `<config-path>:<event>:<line>:<col>` location identifier. The actual
    // event name lives in the body as `event = "session_start"`.
    const legacy = [
      '[hooks."C:\\\\Users\\\\helen\\\\.codex\\\\config.toml:session_start:0:0"]',
      'event = "session_start"',
      'command = "echo hi"',
      '',
    ].join('\n');

    const migrated = migrateCodexHooksMapFormat(legacy);
    const parsed = parseTomlToObject(migrated);

    // The migrated hooks object must be keyed by the event name, not by the
    // location tuple. This is the core assertion of #3346.
    assert.ok(parsed.hooks, 'migrated TOML must define a hooks table');
    assert.deepEqual(
      Object.keys(parsed.hooks),
      ['session_start'],
      `migrated hooks must be keyed by event name only; got: ${JSON.stringify(Object.keys(parsed.hooks))}`
    );

    // The handler body must survive the migration and live under the two-level
    // nested AoT shape (hooks.<event>[0].hooks[0].command).
    const eventEntries = parsed.hooks.session_start;
    assert.ok(Array.isArray(eventEntries) && eventEntries.length >= 1,
      'hooks.session_start must be an array of tables');
    const handlers = eventEntries[0].hooks;
    assert.ok(Array.isArray(handlers) && handlers.length >= 1,
      'hooks.session_start[0].hooks must be an array of handler tables');
    assert.equal(handlers[0].command, 'echo hi',
      'handler command must be preserved through migration');
    assert.equal(handlers[0].type, 'command',
      'handler type must default to "command" when no explicit type given');
    assert.equal(handlers[0].event, undefined,
      'handler body must not retain legacy `event` field after migration');
  });

  test('legacy [hooks."<location>"] with explicit type and event survives migration cleanly', () => {
    // Same as above but with an explicit `type` field — the migrator must not
    // duplicate it when re-emitting the handler.
    const legacy = [
      '[hooks."/home/user/.codex/config.toml:tool_call_pre:5:0"]',
      'event = "tool_call_pre"',
      'type = "command"',
      'command = "node /path/to/hook.js"',
      '',
    ].join('\n');

    const migrated = migrateCodexHooksMapFormat(legacy);
    const parsed = parseTomlToObject(migrated);

    assert.deepEqual(
      Object.keys(parsed.hooks),
      ['tool_call_pre'],
      'leaf key must be the event name from the `event = "..."` body field'
    );
    const handler = parsed.hooks.tool_call_pre[0].hooks[0];
    assert.equal(handler.command, 'node /path/to/hook.js');
    assert.equal(handler.type, 'command');
    assert.equal(handler.event, undefined,
      'handler body must not retain legacy `event` field after migration');
  });

  test('legacy [hooks.<bare-event>] without location-tuple key continues to work unchanged', () => {
    // Regression guard: the fix must not break the canonical legacy-map case
    // ([hooks.<event-name>] with handler-fields-only body, no `event` key).
    const legacy = [
      '[hooks.session_start]',
      'command = "echo hi"',
      '',
    ].join('\n');

    const migrated = migrateCodexHooksMapFormat(legacy);
    const parsed = parseTomlToObject(migrated);

    assert.deepEqual(
      Object.keys(parsed.hooks),
      ['session_start'],
      'bare-event legacy shape must continue to migrate to event-named leaf key'
    );
    assert.equal(parsed.hooks.session_start[0].hooks[0].command, 'echo hi');
  });
});
