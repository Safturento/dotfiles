#!/usr/bin/env node
// register-session-hook.mjs — idempotently add a SessionStart hook command to a
// settings.json file. Used by install.sh so settings.json can stay machine-local
// (untracked) while the registration stays reproducible.
// Usage: node register-session-hook.mjs <settings.json> <command>
import { readFileSync, writeFileSync } from 'node:fs';

export function addSessionStartHook(settings, cmd) {
  settings.hooks = settings.hooks || {};
  settings.hooks.SessionStart = settings.hooks.SessionStart || [];
  const has = settings.hooks.SessionStart.some((g) => (g.hooks || []).some((h) => h.command === cmd));
  if (has) return false;
  settings.hooks.SessionStart.push({ hooks: [{ type: 'command', command: cmd }] });
  return true;
}

function main() {
  const [, , settingsPath, cmd] = process.argv;
  if (!settingsPath || !cmd) {
    console.error('usage: register-session-hook.mjs <settings.json> <command>');
    process.exit(2);
  }
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  if (addSessionStartHook(settings, cmd)) {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    console.log('  new  SessionStart hook');
  } else {
    console.log('  ok   SessionStart hook');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
