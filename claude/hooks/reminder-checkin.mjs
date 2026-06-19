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
import { homedir, hostname } from 'node:os';

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

/**
 * Read the whole store, separating well-formed reminders from malformed
 * candidates. A file is "malformed" when it is not the store's own README yet
 * fails to parse as a fenced-frontmatter reminder — either it is missing the
 * `---` fences entirely (the common slip: an agent copies the YAML template
 * without the fences) or it is fenced but lacks the required `scope:` field.
 * Surfacing these loudly is the whole point of the validation pass: a
 * silently-dropped reminder is a silently-lost task. Returns
 * `{ reminders, malformed }`, where `malformed` is `{ file, reason }[]`.
 */
export function readStore(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return { reminders: [], malformed: [] }; }
  const reminders = [];
  const malformed = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    if (e.name.toLowerCase() === 'readme.md') continue; // the store's own README, not a reminder
    let text;
    try { text = readFileSync(join(dir, e.name), 'utf8'); } catch { continue; }
    const parsed = parseFrontmatter(text);
    if (!parsed) {
      malformed.push({ file: e.name, reason: 'missing `---` frontmatter fences' });
      continue;
    }
    if (!parsed.data.scope) {
      malformed.push({ file: e.name, reason: 'frontmatter missing required `scope:` field' });
      continue;
    }
    reminders.push({
      name: parsed.data.name || e.name.replace(/\.md$/, ''),
      scope: parsed.data.scope,
      device: parsed.data.device || null,
      due: parsed.data.due || null,
      status: parsed.data.status || 'active',
      body: parsed.body,
      file: e.name,
    });
  }
  return { reminders, malformed };
}

/** Back-compat thin wrapper: just the well-formed reminders. */
export function loadReminders(dir) {
  return readStore(dir).reminders;
}

/**
 * Active, in-scope reminders, ordered by priority. `due` is a deadline, not a
 * gate — every active item surfaces regardless of date. Dated items sort first
 * (ascending, so overdue/soonest lead); undated items keep their file order
 * after. The living queue stays visible every session until items are archived.
 *
 * `device` filters for the shared (cloud-synced) reminder store: a reminder with
 * a `device:` field surfaces only on that host, while device-agnostic reminders
 * (no `device:`) surface everywhere. Passing `device = null` disables the filter
 * entirely (back-compat for callers that don't care about the host).
 */
export function selectReminders(reminders, project, device = null) {
  return reminders
    .filter((r) =>
      r.status === 'active' &&
      (r.scope === 'global' || r.scope === `project:${project}`) &&
      (!device || !r.device || r.device === device),
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
export function renderContext(matched, today, malformed = []) {
  const sections = [];
  if (matched.length) {
    const lines = [
      '# Queued reminders', '',
      'Raise these with the user as your first action this session, before engaging their request. Summaries only — read the full file before acting on one, and resolve (archive + report) any whose work has demonstrably shipped.', '',
    ];
    for (const r of matched) {
      const dl = dueLabel(r.due, today);
      lines.push(`- **${r.name}** (${r.scope}${dl ? `,${dl}` : ''}) — ${firstLine(r.body)}`);
      lines.push(`  full text: ~/.claude/reminders/${r.file}`);
    }
    sections.push(lines.join('\n').trim());
  }
  if (malformed.length) {
    const lines = [
      '# ⚠️ Malformed reminder files', '',
      'These files are in the reminders store but were SKIPPED — they never reached the queue, so whatever task they hold is currently invisible. Tell the user, then fix each one: every reminder must begin with a `---` fence, carry a YAML frontmatter block with at least a `scope:` field, and close the block with a `---` fence before the body. Re-run the hook (or start a fresh session) to confirm they parse.', '',
    ];
    for (const m of malformed) {
      lines.push(`- \`~/.claude/reminders/${m.file}\` — ${m.reason}`);
    }
    sections.push(lines.join('\n').trim());
  }
  return sections.join('\n\n').trim();
}

/**
 * The user-visible nudge. Claude Code renders a hook's systemMessage in muted
 * gray and it can't be recolored from here (embedded ANSI is unreliable), so
 * prominence comes from structure: an emoji-led ALL-CAPS header plus each
 * reminder name (+ due) on its own emoji-led line. Emoji glyphs render in color
 * even when the surrounding text is gray, so the block stands out at a glance.
 */
export function renderSystemMessage(matched, today, malformed = []) {
  const lines = [];
  if (matched.length) {
    const n = matched.length;
    lines.push(`📌 ${n} QUEUED REMINDER${n > 1 ? 'S' : ''} — say "review reminders" to act on them:`);
    for (const r of matched) {
      const dl = dueLabel(r.due, today);
      lines.push(`   📌 ${r.name}${dl ? ` (${dl.trim()})` : ''}`);
    }
  }
  if (malformed.length) {
    const n = malformed.length;
    lines.push(`⚠️ ${n} MALFORMED REMINDER FILE${n > 1 ? 'S' : ''} skipped (not in the queue) — needs fixing:`);
    for (const m of malformed) {
      lines.push(`   ⚠️ ${m.file} — ${m.reason}`);
    }
  }
  return lines.join('\n');
}

export function runCheckin({ remindersDir, cwd, today, device = null }) {
  const project = resolveProject(cwd);
  // The queue surfaces in full every session — no per-day throttle. Items leave
  // only by being archived (status flips off `active`, so they drop out here).
  // Malformed files never make it into the queue, so we surface them separately
  // rather than letting a formatting slip silently swallow a task.
  const { reminders, malformed } = readStore(remindersDir);
  const matched = selectReminders(reminders, project, device);
  if (matched.length === 0 && malformed.length === 0) return null;
  return {
    systemMessage: renderSystemMessage(matched, today, malformed),
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: renderContext(matched, today, malformed) },
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
  const out = runCheckin({ remindersDir, cwd, today: localToday(), device: hostname() });
  if (out) process.stdout.write(JSON.stringify(out));
}

if (isMainModule(process.argv[1], import.meta.url)) {
  try { main(); } catch { /* fail silent, exit 0 */ }
}
