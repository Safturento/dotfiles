#!/usr/bin/env node
// reminder-checkin.mjs — global SessionStart hook.
// Surfaces queued reminders (global + current project), re-raising each one at
// most once per calendar day per project until it's resolved or snoozed.
// Dependency-free: Node builtins only. Fails open / silent so a reminder problem
// can never break session startup.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join, dirname, basename, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

/**
 * Per-reminder, per-project throttle state: `{ surfaced: { <name>: <YYYY-MM-DD> } }`.
 * A reminder re-surfaces once per calendar day until it's resolved (status flips
 * off `active`, so it leaves `selectReminders`) or snoozed (due bumped to a future
 * date). Reading a missing/garbage file fails open to an empty map.
 */
export function loadSurfaced(stateDir, project) {
  try {
    const s = JSON.parse(readFileSync(join(stateDir, `checkin-${project}.json`), 'utf8'));
    return s && typeof s.surfaced === 'object' && s.surfaced ? s.surfaced : {};
  } catch {
    return {};
  }
}

export function saveSurfaced(stateDir, project, surfaced) {
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, `checkin-${project}.json`), JSON.stringify({ surfaced }) + '\n');
  } catch { /* non-fatal */ }
}

export function renderContext(matched) {
  const lines = [
    '# Queued reminders', '',
    'Queued reminders for this session (global + this project). **Surface these to the user as your first action this session — before engaging their request — then proceed.** Raise the relevant ones; if a reminder\'s work has demonstrably shipped this session, resolve it (archive + report).', '',
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
  const surfaced = loadSurfaced(stateDir, project);
  const due = selectReminders(loadReminders(remindersDir), project, today);
  // Re-raise each due reminder at most once per calendar day. A reminder added
  // later in the day still surfaces even if an earlier one already did today.
  const matched = due.filter((r) => surfaced[r.name] !== today);
  if (matched.length === 0) return null;
  // Persist today's surfacing, pruned to the currently-due set so resolved /
  // removed reminders don't accumulate in the state file.
  const next = {};
  for (const r of due) next[r.name] = today;
  saveSurfaced(stateDir, project, next);
  return {
    systemMessage: `📌 ${matched.length} queued reminder${matched.length > 1 ? 's' : ''} — say "review reminders" to discuss`,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: renderContext(matched) },
  };
}

/**
 * True when this module is the process entry point. Robust to symlinks: the hook
 * is installed as `~/.claude/hooks/reminder-checkin.mjs` symlinked into the
 * dotfiles repo, so `process.argv[1]` is the symlink path while `import.meta.url`
 * is the resolved target — a naive `import.meta.url === file://argv[1]` compare
 * fails and `main()` never runs. Compare real paths instead.
 */
export function isMainModule(argv1, metaUrl) {
  try {
    return !!argv1 && realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
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

if (isMainModule(process.argv[1], import.meta.url)) {
  try { main(); } catch { /* fail silent, exit 0 */ }
}
