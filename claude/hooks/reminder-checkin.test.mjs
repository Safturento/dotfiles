import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseFrontmatter, resolveProject, loadReminders, readStore, selectReminders,
  dueLabel, renderContext, renderSystemMessage, runCheckin, localToday, isMainModule,
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

test('selectReminders: scope + status filtering, due is NOT a gate', () => {
  const rs = [
    { name: 'g', scope: 'global', due: null, status: 'active', body: '' },
    { name: 'c', scope: 'project:crew', due: null, status: 'active', body: '' },
    { name: 'o', scope: 'project:other', due: null, status: 'active', body: '' },
    { name: 'future', scope: 'global', due: '2999-01-01', status: 'active', body: '' },
    { name: 'past', scope: 'global', due: '2000-01-01', status: 'active', body: '' },
    { name: 'done', scope: 'global', due: null, status: 'done', body: '' },
  ];
  // other-project + done dropped; future-dated NO LONGER filtered out.
  const got = selectReminders(rs, 'crew').map((r) => r.name);
  // dated items lead (ascending), then undated in file order.
  assert.deepEqual(got, ['past', 'future', 'g', 'c']);
});

test('readStore captures the optional device field', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-'));
  writeFileSync(join(dir, 'a.md'), '---\nname: a\nscope: global\ndevice: wsl-desktop\n---\nbody');
  const { reminders } = readStore(dir);
  assert.equal(reminders[0].device, 'wsl-desktop');
});

test('selectReminders: device-agnostic items always show; device-tagged items only on match', () => {
  const rs = [
    { name: 'anydev', scope: 'global', due: null, status: 'active', body: '', device: undefined },
    { name: 'thisdev', scope: 'global', due: null, status: 'active', body: '', device: 'wsl-desktop' },
    { name: 'otherdev', scope: 'global', due: null, status: 'active', body: '', device: 'mac-mini' },
  ];
  const got = selectReminders(rs, 'crew', 'wsl-desktop').map((r) => r.name);
  assert.deepEqual(got, ['anydev', 'thisdev']);
});

test('selectReminders: device=null disables the device filter (back-compat)', () => {
  const rs = [
    { name: 'thisdev', scope: 'global', due: null, status: 'active', body: '', device: 'wsl-desktop' },
    { name: 'otherdev', scope: 'global', due: null, status: 'active', body: '', device: 'mac-mini' },
  ];
  const got = selectReminders(rs, 'crew', null).map((r) => r.name);
  assert.deepEqual(got, ['thisdev', 'otherdev']);
});

test('dueLabel: empty when undated, OVERDUE when due < today', () => {
  assert.equal(dueLabel(null, '2026-06-08'), '');
  assert.equal(dueLabel('2026-06-09', '2026-06-08'), ' due 2026-06-09');
  assert.equal(dueLabel('2026-06-08', '2026-06-08'), ' due 2026-06-08'); // due today ≠ overdue
  assert.equal(dueLabel('2026-06-07', '2026-06-08'), ' due 2026-06-07 — OVERDUE');
});

test('loadReminders skips README + malformed, reads valid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-load-'));
  writeFileSync(join(dir, 'README.md'), '# not a reminder');
  writeFileSync(join(dir, 'a.md'), '---\nname: a\nscope: global\nstatus: active\n---\nbody a');
  const got = loadReminders(dir);
  assert.equal(got.length, 1);
  assert.equal(got[0].name, 'a');
});

test('readStore: flags fence-less + scope-less files as malformed, never the README', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-store-'));
  writeFileSync(join(dir, 'README.md'), '# store readme\n\n```yaml\nscope: global\n```'); // not a reminder despite a scope: line
  writeFileSync(join(dir, 'ok.md'), '---\nname: ok\nscope: global\nstatus: active\n---\nbody');
  writeFileSync(join(dir, 'no-fence.md'), 'name: nf\nscope: project:crew\nstatus: active\n\nbody'); // the exact slip we saw
  writeFileSync(join(dir, 'no-scope.md'), '---\nname: ns\nstatus: active\n---\nbody');
  const { reminders, malformed } = readStore(dir);
  assert.deepEqual(reminders.map((r) => r.name), ['ok']);
  const byFile = Object.fromEntries(malformed.map((m) => [m.file, m.reason]));
  assert.match(byFile['no-fence.md'], /frontmatter fences/);
  assert.match(byFile['no-scope.md'], /scope/);
  assert.ok(!('README.md' in byFile), 'README must never be flagged as malformed');
});

test('runCheckin: surfaces malformed files even when the queue is otherwise empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-malformed-'));
  // a fence-less file is the only thing in the store → nothing reaches the queue
  writeFileSync(join(dir, 'broken.md'), 'name: broken\nscope: global\nstatus: active\n\nbody');
  const out = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-17' });
  assert.ok(out, 'malformed files must surface even with an empty queue');
  assert.match(out.systemMessage, /1 MALFORMED REMINDER FILE/);
  assert.match(out.systemMessage, /broken\.md/);
  assert.match(out.hookSpecificOutput.additionalContext, /Malformed reminder files/);
  assert.match(out.hookSpecificOutput.additionalContext, /broken\.md/);
});

test('runCheckin: renders queue AND malformed sections together', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-both-'));
  writeFileSync(join(dir, 'g.md'), '---\nname: g\nscope: global\nstatus: active\n---\nglobal body');
  writeFileSync(join(dir, 'broken.md'), 'name: broken\nscope: global\nstatus: active\n\nbody');
  const out = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-17' });
  assert.match(out.systemMessage, /1 QUEUED REMINDER/);
  assert.match(out.systemMessage, /1 MALFORMED REMINDER FILE/);
  assert.match(out.hookSpecificOutput.additionalContext, /Queued reminders/);
  assert.match(out.hookSpecificOutput.additionalContext, /Malformed reminder files/);
});

test('runCheckin: surfaces the full queue every session (no throttle)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-run-'));
  writeFileSync(join(dir, 'g.md'), '---\nname: g\nscope: global\nstatus: active\n---\nglobal body');
  // cwd is the temp dir (not a git repo) → project = basename(dir)
  const first = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-05' });
  assert.ok(first);
  assert.match(first.systemMessage, /1 QUEUED REMINDER/);
  assert.equal(first.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(first.hookSpecificOutput.additionalContext, /global body/);
  // same session params again → still surfaces (the queue is not throttled).
  const second = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-05' });
  assert.ok(second, 'queue should re-surface every session, not once per day');
  assert.match(second.systemMessage, /1 QUEUED REMINDER/);
});

test('runCheckin: returns null only when the queue is empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-empty-'));
  assert.equal(runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-06' }), null);
  writeFileSync(join(dir, 'a.md'), '---\nname: a\nscope: global\nstatus: active\n---\nbody a');
  assert.ok(runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-06' }));
});

test('runCheckin: flags an overdue item in the surfaced output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-overdue-'));
  writeFileSync(join(dir, 'g.md'), '---\nname: g\nscope: global\ndue: 2026-06-01\nstatus: active\n---\nbody');
  const out = runCheckin({ remindersDir: dir, cwd: dir, today: '2026-06-08' });
  assert.match(out.systemMessage, /OVERDUE/);
  assert.match(out.hookSpecificOutput.additionalContext, /OVERDUE/);
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

test('renderSystemMessage: count header + one named line per reminder', () => {
  const msg = renderSystemMessage([
    { name: 'alpha', scope: 'project:crew', due: '2026-06-06', body: '' },
    { name: 'beta', scope: 'global', due: null, body: '' },
  ]);
  const lines = msg.split('\n');
  assert.equal(lines.length, 3); // header + 2 reminders
  assert.match(lines[0], /2 QUEUED REMINDERS/);
  assert.match(lines[0], /review reminders/);
  assert.match(lines[1], /alpha\b.*due 2026-06-06/);
  assert.match(lines[2], /beta/);
  assert.doesNotMatch(lines[2], /due/); // no due date → no "(due …)"
  // singular header for one reminder
  assert.match(renderSystemMessage([{ name: 'x', scope: 'global', due: null, body: '' }]), /1 QUEUED REMINDER\b/);
});

test('localToday returns YYYY-MM-DD', () => {
  assert.match(localToday(new Date(2026, 5, 5)), /^2026-06-05$/);
});
