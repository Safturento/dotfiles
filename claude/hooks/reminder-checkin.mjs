#!/usr/bin/env node
// reminder-checkin.mjs — global SessionStart hook.
// Surfaces queued reminders (global + current project) at the start of every
// session — the store is a living queue, so an item shows every time until it's
// resolved (archived). `due` is a priority signal, not a visibility gate: dated
// items sort to the top (soonest/overdue first), undated items follow.
// Dependency-free: Node builtins only. Fails open / silent so a reminder problem
// can never break session startup.
import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
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

/**
 * Active, in-scope reminders, ordered by priority. `due` is a deadline, not a
 * gate — every active item surfaces regardless of date. Dated items sort first
 * (ascending, so overdue/soonest lead); undated items keep their file order
 * after. The living queue stays visible every session until items are archived.
 */
export function selectReminders(reminders, project) {
  return reminders
    .filter((r) =>
      r.status === 'active' &&
      (r.scope === 'global' || r.scope === `project:${project}`),
    )
    .sort((a, b) => {
      if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
      if (a.due) return -1; // dated before undated
      if (b.due) return 1;
      return 0; // both undated → stable (file order)
    });
}

/** First non-empty line of a reminder body, truncated — enough to raise it by
 *  name without dumping the whole body into every session's context. */
export function firstLine(body, max = 200) {
  for (const ln of (body || '').split('\n')) {
    const t = ln.trim();
    if (t) return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  }
  return '';
}

/** Human-readable due suffix, e.g. ` due 2026-06-09` or ` due 2026-06-09 — OVERDUE`.
 *  Empty for undated reminders. `today` lets us flag a passed deadline. */
export function dueLabel(due, today) {
  if (!due) return '';
  return today && due < today ? ` due ${due} — OVERDUE` : ` due ${due}`;
}

/**
 * Compact summary — one line per reminder (name, scope/due, gist, file path).
 * Deliberately NOT the full bodies: dumping them bloats every session's context
 * and overflows the hook-output size cap. Read the named file before acting.
 */
export function renderContext(matched, today) {
  const lines = [
    '# Queued reminders', '',
    'Raise these with the user as your first action this session, before engaging their request. Summaries only — read the full file before acting on one, and resolve (archive + report) any whose work has demonstrably shipped.', '',
  ];
  for (const r of matched) {
    const dl = dueLabel(r.due, today);
    lines.push(`- **${r.name}** (${r.scope}${dl ? `,${dl}` : ''}) — ${firstLine(r.body)}`);
    lines.push(`  full text: ~/.claude/reminders/${r.file}`);
  }
  return lines.join('\n').trim();
}

/**
 * The user-visible nudge. Claude Code renders a hook's systemMessage in muted
 * gray and it can't be recolored from here (embedded ANSI is unreliable), so
 * prominence comes from structure: an emoji-led ALL-CAPS header plus each
 * reminder name (+ due) on its own emoji-led line. Emoji glyphs render in color
 * even when the surrounding text is gray, so the block stands out at a glance.
 */
export function renderSystemMessage(matched, today) {
  const n = matched.length;
  const head = `📌 ${n} QUEUED REMINDER${n > 1 ? 'S' : ''} — say "review reminders" to act on them:`;
  const items = matched.map((r) => {
    const dl = dueLabel(r.due, today);
    return `   📌 ${r.name}${dl ? ` (${dl.trim()})` : ''}`;
  });
  return [head, ...items].join('\n');
}

export function runCheckin({ remindersDir, cwd, today }) {
  const project = resolveProject(cwd);
  // The queue surfaces in full every session — no per-day throttle. Items leave
  // only by being archived (status flips off `active`, so they drop out here).
  const matched = selectReminders(loadReminders(remindersDir), project);
  if (matched.length === 0) return null;
  return {
    systemMessage: renderSystemMessage(matched, today),
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: renderContext(matched, today) },
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
