/**
 * Tests for loop-guard.cjs — agent loop detection and circuit breaking
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createLoopGuard, hashCall, detectPingPong } = require('../get-shit-done/bin/lib/loop-guard.cjs');

describe('hashCall', () => {
  it('produces consistent hashes for same input', () => {
    const a = hashCall('Read', { path: '/foo.js' });
    const b = hashCall('Read', { path: '/foo.js' });
    assert.equal(a, b);
  });

  it('produces different hashes for different input', () => {
    const a = hashCall('Read', { path: '/foo.js' });
    const b = hashCall('Read', { path: '/bar.js' });
    assert.notEqual(a, b);
  });

  it('produces different hashes for different tool names', () => {
    const a = hashCall('Read', { path: '/foo.js' });
    const b = hashCall('Edit', { path: '/foo.js' });
    assert.notEqual(a, b);
  });
});

describe('detectPingPong', () => {
  it('returns false for short history', () => {
    assert.equal(detectPingPong(['a', 'b']).detected, false);
  });

  it('detects A-B pattern repeated 3 times', () => {
    const history = ['a', 'b', 'a', 'b', 'a', 'b'];
    assert.equal(detectPingPong(history).detected, true);
    assert.equal(detectPingPong(history).patternLength, 2);
  });

  it('detects A-B-C pattern repeated 3 times', () => {
    const history = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'];
    assert.equal(detectPingPong(history).detected, true);
    assert.equal(detectPingPong(history).patternLength, 3);
  });

  it('rejects single-element repeats (not ping-pong)', () => {
    const history = ['a', 'a', 'a', 'a', 'a', 'a'];
    assert.equal(detectPingPong(history).detected, false);
  });

  it('returns false for non-repeating history', () => {
    const history = ['a', 'b', 'c', 'd', 'e', 'f'];
    assert.equal(detectPingPong(history).detected, false);
  });
});

describe('createLoopGuard', () => {
  it('allows first call', () => {
    const guard = createLoopGuard();
    const r = guard.check('Read', { path: '/foo.js' });
    assert.equal(r.action, 'allow');
    assert.equal(r.message, null);
  });

  it('warns on 3rd identical call', () => {
    const guard = createLoopGuard();
    guard.check('Read', { path: '/foo.js' });
    guard.check('Read', { path: '/foo.js' });
    const r = guard.check('Read', { path: '/foo.js' });
    assert.equal(r.action, 'warn');
    assert.ok(r.message.includes('3'));
  });

  it('blocks on 5th identical call', () => {
    const guard = createLoopGuard();
    for (let i = 0; i < 4; i++) guard.check('Read', { path: '/foo.js' });
    const r = guard.check('Read', { path: '/foo.js' });
    assert.equal(r.action, 'block');
  });

  it('detects ping-pong and returns block', () => {
    const guard = createLoopGuard();
    let lastResult;
    for (let i = 0; i < 3; i++) {
      lastResult = guard.check('Read', { path: '/a.js' });
      if (lastResult.action === 'block') break;
      lastResult = guard.check('Edit', { path: '/a.js' });
      if (lastResult.action === 'block') break;
    }
    assert.equal(lastResult.action, 'block');
    assert.ok(lastResult.message.length > 0);
  });

  it('circuit breaks after configured total calls', () => {
    const guard = createLoopGuard({ circuitBreakTotal: 10 });
    let result;
    for (let i = 0; i < 10; i++) {
      result = guard.check('tool' + i, { i });
    }
    assert.equal(result.action, 'circuit_break');
    assert.ok(result.message.includes('10'));
  });

  it('uses default circuit break of 200', () => {
    const guard = createLoopGuard();
    // After 5 calls, should not trip
    for (let i = 0; i < 5; i++) guard.check('tool' + i, { i });
    const stats = guard.getStats();
    assert.equal(stats.totalCalls, 5);
  });

  it('applies poll multiplier to threshold', () => {
    const guard = createLoopGuard({ pollTools: ['BashOutput'] });
    // BashOutput gets 3x threshold: warn at 9, block at 15
    for (let i = 0; i < 8; i++) guard.check('BashOutput', { id: 'same' });
    const r = guard.check('BashOutput', { id: 'same' });
    assert.equal(r.action, 'warn');
  });

  it('does not apply multiplier to non-poll tools', () => {
    const guard = createLoopGuard({ pollTools: ['BashOutput'] });
    for (let i = 0; i < 4; i++) guard.check('Read', { path: '/foo.js' });
    const r = guard.check('Read', { path: '/foo.js' });
    assert.equal(r.action, 'block');
  });

  it('tracks stats correctly', () => {
    const guard = createLoopGuard();
    guard.check('Read', { path: '/a.js' });
    guard.check('Read', { path: '/b.js' });
    guard.check('Read', { path: '/a.js' });
    const stats = guard.getStats();
    assert.equal(stats.totalCalls, 3);
    assert.equal(stats.uniqueCalls, 2);
    assert.equal(stats.history.length, 3);
  });

  it('resets state', () => {
    const guard = createLoopGuard();
    guard.check('Read', { path: '/a.js' });
    guard.check('Read', { path: '/a.js' });
    guard.reset();
    const stats = guard.getStats();
    assert.equal(stats.totalCalls, 0);
    assert.equal(stats.uniqueCalls, 0);
    // After reset, same call should be allowed again
    const r = guard.check('Read', { path: '/a.js' });
    assert.equal(r.action, 'allow');
  });

  it('allows different calls without interference', () => {
    const guard = createLoopGuard();
    guard.check('Read', { path: '/a.js' });
    guard.check('Read', { path: '/b.js' });
    guard.check('Read', { path: '/c.js' });
    guard.check('Read', { path: '/d.js' });
    const r = guard.check('Read', { path: '/e.js' });
    assert.equal(r.action, 'allow');
  });
});
