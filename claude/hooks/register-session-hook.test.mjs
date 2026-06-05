import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSessionStartHook } from './register-session-hook.mjs';

test('addSessionStartHook adds when absent (returns true)', () => {
  const s = { model: 'x', hooks: { PreToolUse: [] } };
  assert.equal(addSessionStartHook(s, 'CMD'), true);
  assert.equal(s.hooks.SessionStart.length, 1);
  assert.equal(s.hooks.SessionStart[0].hooks[0].command, 'CMD');
  assert.ok(s.hooks.PreToolUse, 'preserves other hook events');
});

test('addSessionStartHook is idempotent (returns false when present)', () => {
  const s = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'CMD' }] }] } };
  assert.equal(addSessionStartHook(s, 'CMD'), false);
  assert.equal(s.hooks.SessionStart.length, 1);
});

test('addSessionStartHook bootstraps hooks object when missing entirely', () => {
  const s = {};
  assert.equal(addSessionStartHook(s, 'CMD'), true);
  assert.equal(s.hooks.SessionStart[0].hooks[0].command, 'CMD');
});
