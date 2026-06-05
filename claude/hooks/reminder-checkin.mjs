#!/usr/bin/env node
// reminder-checkin.mjs — global SessionStart hook.
// Surfaces queued reminders (global + current project) at most once per project
// per calendar day. Dependency-free: Node builtins only. Fails open / silent so a
// reminder problem can never break session startup.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

export function localToday(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const mm = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (mm) data[mm[1]] = mm[2].trim();
  }
  return { data, body: m[2].trim() };
}

function defaultRunGit(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  });
}

export function resolveProject(cwd, runGit = defaultRunGit) {
  try {
    const common = runGit(cwd, ['rev-parse', '--git-common-dir']).trim();
    const gitDir = isAbsolute(common) ? common : join(cwd, common);
    return basename(dirname(gitDir));
  } catch {
    return basename(cwd);
  }
}

export function loadReminders(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    let parsed;
    try { parsed = parseFrontmatter(readFileSync(join(dir, e.name), 'utf8')); } catch { continue; }
    if (!parsed || !parsed.data.scope) continue; // skips README + malformed
    out.push({
      name: parsed.data.name || e.name.replace(/\.md$/, ''),
      scope: parsed.data.scope,
      due: parsed.data.due || null,
      status: parsed.data.status || 'active',
      body: parsed.body,
      file: e.name,
    });
  }
  return out;
}

export function selectReminders(reminders, project, today) {
  return reminders.filter((r) =>
    r.status === 'active' &&
    (r.scope === 'global' || r.scope === `project:${project}`) &&
    (!r.due || r.due <= today),
  );
}

export function alreadyCheckedInToday(stateDir, project, today) {
  try {
    const s = JSON.parse(readFileSync(join(stateDir, `checkin-${project}.json`), 'utf8'));
    return s.lastCheckin === today;
  } catch {
    return false; // fail open
  }
}

export function stampCheckin(stateDir, project, today) {
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, `checkin-${project}.json`), JSON.stringify({ lastCheckin: today }) + '\n');
  } catch { /* non-fatal */ }
}

export function renderContext(matched) {
  const lines = [
    '# Queued reminders', '',
    'Reminders queued for this session (global + this project). Raise the relevant ones with the user. If a reminder\'s work has demonstrably shipped this session, resolve it (archive + report).', '',
  ];
  for (const r of matched) {
    lines.push(`## ${r.name}  (${r.scope}${r.due ? `, due ${r.due}` : ''})`);
    lines.push(r.body, '');
  }
  return lines.join('\n').trim();
}

export function runCheckin({ remindersDir, cwd, today }) {
  const project = resolveProject(cwd);
  const stateDir = join(remindersDir, '.state');
  if (alreadyCheckedInToday(stateDir, project, today)) return null;
  const matched = selectReminders(loadReminders(remindersDir), project, today);
  if (matched.length === 0) return null;
  stampCheckin(stateDir, project, today);
  return {
    systemMessage: `📌 ${matched.length} queued reminder${matched.length > 1 ? 's' : ''} — say "review reminders" to discuss`,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: renderContext(matched) },
  };
}

function main() {
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* no stdin */ }
  const cwd = input.cwd || process.cwd();
  const remindersDir = join(homedir(), '.claude', 'reminders');
  if (!existsSync(remindersDir)) return;
  const out = runCheckin({ remindersDir, cwd, today: localToday() });
  if (out) process.stdout.write(JSON.stringify(out));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch { /* fail silent, exit 0 */ }
}
