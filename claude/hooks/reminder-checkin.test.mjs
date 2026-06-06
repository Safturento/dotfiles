import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseFrontmatter, resolveProject, loadReminders, selectReminders,
  loadSurfaced, saveSurfaced, renderContext, runCheckin, localToday, isMainModule,
} from './reminder-checkin.mjs';

test('parseFrontmatter parses frontmatter + body', () => {
  const r = parseFrontmatter('---\nname: x\nscope: global\n---\nhello body');
  assert.equal(r.data.name, 'x');
  assert.equal(r.data.scope, 'global');
  assert.equal(r.body, 'hello body');
});

test('parseFrontmatter returns null without frontmatter', () => {
  assert.equal(parseFrontmatter('# just a readme\n'), null);
});

test('resolveProject: worktree common-dir (absolute) → repo name', () => {
  const fake = () => '/home/u/crew/.git\n';
  assert.equal(resolveProject('/home/u/crew-CREW-1', fake), 'crew');
});

test('resolveProject: main repo common-dir (relative) → repo name', () => {
  const fake = () => '.git\n';
  assert.equal(resolveProject('/home/u/crew', fake), 'crew');
});

test('resolveProject: not a git repo → basename(cwd)', () => {
  const fake = () => { throw new Error('not a repo'); };
  assert.equal(resolveProject('/home/u/loosedir', fake), 'loosedir');
});

test('selectReminders: scope + due + status filtering', () => {
  const rs = [
    { name: 'g', scope: 'global', due: null, status: 'active', body: '' },
    { name: 'c', scope: 'project:crew', due: null, status: 'active', body: '' },
    { name: 'o', scope: 'project:other', due: null, status: 'active', body: '' },
    { name: 'future', scope: 'global', due: '2999-01-01', status: 'active', body: '' },
    { name: 'past', scope: 'global', due: '2000-01-01', status: 'active', body: '' },
    { name: 'done', scope: 'global', due: null, status: 'done', body: '' },
  ];
  const got = selectReminders(rs, 'crew', '2026-06-05').map((r) => r.name).sort();
  assert.deepEqual(got, ['c', 'g', 'past']);
});

test('surfaced state: round-trips per-reminder dates; missing = {}', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-state-'));
  assert.deepEqual(loadSurfaced(dir, 'crew'), {});
  saveSurfaced(dir, 'crew', { a: '2026-06-06', b: '2026-06-06' });
  assert.deepEqual(loadSurfaced(dir, 'crew'), { a: '2026-06-06', b: '2026-06-06' });
});

test('loadReminders skips README + malformed, reads valid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-load-'));
  writeFileSync(join(dir, 'README.md'), '# not a reminder');
  writeFileSync(join(dir, 'a.md'), '---\nname: a\nscope: global\nstatus: active\n---\nbody a');
  const got = loadReminders(dir);
  assert.equal(got.length, 1);
  assert.equal(got[0].name, 'a');
});

test('runCheckin: surfaces matches once, then throttles same day', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-run-'));
  writeFileSync(join(dir, 'g.md'), '---\nname: g\nscope: global\nstatus: active\n---\nglobal body');
  // cwd is the temp dir (not a git repo) → project = basename(dir)
  const first = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-05' });
  assert.ok(first);
  assert.match(first.systemMessage, /1 queued reminder/);
  assert.equal(first.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(first.hookSpecificOutput.additionalContext, /global body/);
  const second = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-05' });
  assert.equal(second, null);
});

test('runCheckin: a reminder added later the same day still surfaces', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-add-'));
  writeFileSync(join(dir, 'a.md'), '---\nname: a\nscope: global\nstatus: active\n---\nbody a');
  const first = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-06' });
  assert.match(first.systemMessage, /1 queued reminder/);
  // a second reminder appears after the first already surfaced today
  writeFileSync(join(dir, 'b.md'), '---\nname: b\nscope: global\nstatus: active\n---\nbody b');
  const second = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-06' });
  assert.ok(second, 'newly-added reminder should still surface the same day');
  assert.match(second.systemMessage, /1 queued reminder/);
  assert.match(second.hookSpecificOutput.additionalContext, /body b/);
  assert.doesNotMatch(second.hookSpecificOutput.additionalContext, /body a/);
  // nothing new left today
  assert.equal(runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-06' }), null);
});

test('runCheckin: re-surfaces the next day', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-day-'));
  writeFileSync(join(dir, 'g.md'), '---\nname: g\nscope: global\nstatus: active\n---\nbody');
  assert.ok(runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-06' }));
  assert.equal(runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-06' }), null);
  assert.ok(runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-07' }), 'should re-surface next day');
});

test('isMainModule: true through a symlink, false for an unrelated path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-main-'));
  const target = join(dir, 'real.mjs');
  const link = join(dir, 'link.mjs');
  writeFileSync(target, '// target');
  symlinkSync(target, link);
  // Invoked as `node <link>` while import.meta.url resolves to the target —
  // the exact shape that broke the naive guard.
  assert.equal(isMainModule(link, pathToFileURL(target).href), true);
  assert.equal(isMainModule(join(dir, 'other.mjs'), pathToFileURL(target).href), false);
  assert.equal(isMainModule(undefined, pathToFileURL(target).href), false);
});

test('localToday returns YYYY-MM-DD', () => {
  assert.match(localToday(new Date(2026, 5, 5)), /^2026-06-05$/);
});
