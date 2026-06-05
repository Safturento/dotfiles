# Cross-session reminders — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A global reminder convention that surfaces queued "do this next time you're in project X / after date Y" notes via a deterministic once-per-project-per-day SessionStart check-in, so cross-session reminders stop failing to set up.

**Architecture:** Flat markdown reminder files under `~/.claude/reminders/` (tracked via `~/dotfiles`, symlinked). A dependency-free Node `SessionStart` hook (`reminder-checkin.mjs`) resolves the current project from cwd, filters reminders by scope + due date, throttles to once per project per day, and emits matches as `additionalContext`. A `~/.claude/CLAUDE.md` "Reminders" section makes the store the canonical creation path and drives proactive resolution.

**Tech Stack:** Node 18+ ESM (builtins only: `fs`, `path`, `os`, `child_process`), `node --test` for tests, bash `install.sh` for symlinks, Claude Code SessionStart hooks.

**Spec:** `docs/superpowers/specs/2026-06-05-cross-session-reminders-design.md`

---

## Where each change lands

| Change | Location | Tracked? |
| --- | --- | --- |
| **P0** CLAUDE.md, conventions, skills migrated | `~/dotfiles/claude/{CLAUDE.md,conventions/,skills/}` (symlinked back) | dotfiles PR |
| **P0** `ensure_session_start_hook` helper + symlinks | `~/dotfiles/install.sh` | dotfiles PR |
| **P1** Hook script + tests | `~/dotfiles/claude/hooks/reminder-checkin.{mjs,test.mjs}` | dotfiles PR |
| **P1** Reminder store scaffolding | `~/dotfiles/claude/reminders/` (README + archive/) | dotfiles PR |
| **P1** `.state/` ignore | `~/dotfiles/.gitignore` | dotfiles PR |
| **P1** "Reminders" convention | `~/dotfiles/claude/CLAUDE.md` (now tracked, via P0) | dotfiles PR |
| `settings.json` SessionStart registration | `~/.claude/settings.json` | **local** (machine-specific); written idempotently by `install.sh`, not tracked |

Everything except `~/.claude/settings.json` is dotfiles-tracked after Phase 0. `settings.json` stays
local (public-repo + machine-specific allowlist) but its reminder-hook registration is reproducible
via the `install.sh` helper.

## File structure

- `claude/hooks/reminder-checkin.mjs` — the hook. Exports pure functions (`parseFrontmatter`, `resolveProject`, `loadReminders`, `selectReminders`, `alreadyCheckedInToday`, `stampCheckin`, `renderContext`, `runCheckin`, `localToday`) + a `main()` CLI guarded by `import.meta.url`. One responsibility: decide what (if anything) to surface this session and emit it.
- `claude/hooks/reminder-checkin.test.mjs` — `node --test` unit + integration tests against fixtures and temp dirs.
- `claude/reminders/README.md` — explains the store (also serves as a non-reminder file the loader must skip).
- `claude/reminders/archive/.gitkeep` — keeps the archive dir in git.
- `claude/reminders/.state/` — gitignored throttle state (created at runtime).

---

# Phase 0 — Config consolidation

Bring all user-authored `~/.claude` agent config under dotfiles management so it's tracked,
backed up, and reproducible. Migration per file is: `mv` it into `~/dotfiles/claude/`, add a
`link` line to `install.sh`, run `install.sh` (creates the symlink back), verify. `mv` preserves
content (nothing is read into the transcript). `settings.json` is deliberately NOT migrated.

## Task P0.1: install.sh — node resolution + idempotent hook-registration helper

**Files:**
- Modify: `install.sh` (after `DOTFILES=...`, and after the `link()` function)

- [ ] **Step 1: Add a stable node path** after the `DOTFILES="$(...)"` line:

```bash
# Stable absolute node path. fnm's per-shell multishell symlink dies when its
# originating shell exits; aliases/default persists. Falls back to PATH.
NODE_BIN="$( [ -x "$HOME/.local/share/fnm/aliases/default/bin/node" ] \
  && echo "$HOME/.local/share/fnm/aliases/default/bin/node" || command -v node )"
```

- [ ] **Step 2: Add the helper** after the `link()` function closes (before `echo "Linking..."`):

```bash
# Idempotently register a SessionStart hook command in ~/.claude/settings.json.
# settings.json stays machine-local (not tracked); this keeps the registration
# reproducible without publishing it. Mirrors the delta include.path block below.
ensure_session_start_hook() {
  local cmd="$1"
  local settings="$HOME/.claude/settings.json"
  [ -f "$settings" ] || { echo "  skip SessionStart hook (no settings.json)"; return; }
  "$NODE_BIN" -e '
    const fs=require("fs"), p=process.argv[2], cmd=process.argv[3];
    const s=JSON.parse(fs.readFileSync(p,"utf8"));
    s.hooks=s.hooks||{}; s.hooks.SessionStart=s.hooks.SessionStart||[];
    const has=s.hooks.SessionStart.some(g=>(g.hooks||[]).some(h=>h.command===cmd));
    if(!has){s.hooks.SessionStart.push({hooks:[{type:"command",command:cmd}]});
      fs.writeFileSync(p,JSON.stringify(s,null,2)+"\n");console.log("  new  SessionStart hook");}
    else{console.log("  ok   SessionStart hook");}
  ' "$settings" "$cmd"
}
```

- [ ] **Step 3: Syntax check + commit**

```bash
cd ~/dotfiles && bash -n install.sh && echo "ok"
git add install.sh && git commit -m "feat(install): node path + idempotent SessionStart hook helper"
```

Expected: `ok`.

## Task P0.2: Migrate CLAUDE.md

**Files:** Move `~/.claude/CLAUDE.md` → `~/dotfiles/claude/CLAUDE.md`; modify `install.sh`.

- [ ] **Step 1: Move + link**

```bash
mv ~/.claude/CLAUDE.md ~/dotfiles/claude/CLAUDE.md
```

Add to `install.sh` (with the other `claude/` links):

```bash
link "$DOTFILES/claude/CLAUDE.md"                        "$HOME/.claude/CLAUDE.md"
```

- [ ] **Step 2: Install + verify (no content read)**

```bash
cd ~/dotfiles && ./install.sh 2>&1 | grep -i claude.md
readlink ~/.claude/CLAUDE.md          # → .../dotfiles/claude/CLAUDE.md
test -s ~/.claude/CLAUDE.md && echo "non-empty ok"
```

- [ ] **Step 3: Commit**

```bash
git add claude/CLAUDE.md install.sh && git commit -m "chore(claude): track CLAUDE.md in dotfiles"
```

## Task P0.3: Migrate the 8 conventions

**Files:** Move 8 files → `~/dotfiles/claude/conventions/`; modify `install.sh`.

- [ ] **Step 1: Move**

```bash
cd ~/.claude/conventions
mv code-quality.md crew-dispatch.md designer-collaboration.md documentation.md \
   figma.md line-endings.md node.md self-improvement.md \
   ~/dotfiles/claude/conventions/
```

- [ ] **Step 2: Add link lines** to `install.sh` (after the existing `project-scaffolding.md` link):

```bash
link "$DOTFILES/claude/conventions/code-quality.md"          "$HOME/.claude/conventions/code-quality.md"
link "$DOTFILES/claude/conventions/crew-dispatch.md"         "$HOME/.claude/conventions/crew-dispatch.md"
link "$DOTFILES/claude/conventions/designer-collaboration.md" "$HOME/.claude/conventions/designer-collaboration.md"
link "$DOTFILES/claude/conventions/documentation.md"         "$HOME/.claude/conventions/documentation.md"
link "$DOTFILES/claude/conventions/figma.md"                 "$HOME/.claude/conventions/figma.md"
link "$DOTFILES/claude/conventions/line-endings.md"          "$HOME/.claude/conventions/line-endings.md"
link "$DOTFILES/claude/conventions/node.md"                  "$HOME/.claude/conventions/node.md"
link "$DOTFILES/claude/conventions/self-improvement.md"      "$HOME/.claude/conventions/self-improvement.md"
```

- [ ] **Step 3: Install + verify all symlinked**

```bash
cd ~/dotfiles && ./install.sh >/dev/null
for f in ~/.claude/conventions/*.md; do printf '%s -> %s\n' "$(basename "$f")" "$(readlink "$f" || echo NOT-A-SYMLINK)"; done
```

Expected: every convention resolves to a `dotfiles/claude/conventions/...` target.

- [ ] **Step 4: Commit**

```bash
git add claude/conventions/ install.sh && git commit -m "chore(claude): track all conventions in dotfiles"
```

## Task P0.4: Migrate the 8 skills

**Files:** Move 8 dirs → `~/dotfiles/claude/skills/`; modify `install.sh`. (Skip the empty `learned/`.)

- [ ] **Step 1: Move**

```bash
cd ~/.claude/skills
mv agents-doc-parity-check bruno-collection-maintenance figma-design-system-propagation \
   figma-screen-migration mumen reaching-for-backend-patterns \
   reaching-for-frontend-libraries visual-fidelity-check \
   ~/dotfiles/claude/skills/
```

- [ ] **Step 2: Add link lines** to `install.sh` (after the existing skill links):

```bash
link "$DOTFILES/claude/skills/agents-doc-parity-check"          "$HOME/.claude/skills/agents-doc-parity-check"
link "$DOTFILES/claude/skills/bruno-collection-maintenance"     "$HOME/.claude/skills/bruno-collection-maintenance"
link "$DOTFILES/claude/skills/figma-design-system-propagation"  "$HOME/.claude/skills/figma-design-system-propagation"
link "$DOTFILES/claude/skills/figma-screen-migration"           "$HOME/.claude/skills/figma-screen-migration"
link "$DOTFILES/claude/skills/mumen"                            "$HOME/.claude/skills/mumen"
link "$DOTFILES/claude/skills/reaching-for-backend-patterns"    "$HOME/.claude/skills/reaching-for-backend-patterns"
link "$DOTFILES/claude/skills/reaching-for-frontend-libraries"  "$HOME/.claude/skills/reaching-for-frontend-libraries"
link "$DOTFILES/claude/skills/visual-fidelity-check"            "$HOME/.claude/skills/visual-fidelity-check"
```

- [ ] **Step 3: Install + verify**

```bash
cd ~/dotfiles && ./install.sh >/dev/null
for d in ~/.claude/skills/*/; do d=${d%/}; printf '%s -> %s\n' "$(basename "$d")" "$(readlink "$d" || echo REAL-DIR)"; done
```

Expected: the 8 migrated skills (+ the 2 pre-existing) resolve to dotfiles; only `learned` stays a real dir.

- [ ] **Step 4: Commit**

```bash
git add claude/skills/ install.sh && git commit -m "chore(claude): track all authored skills in dotfiles"
```

## Task P0.5: Phase 0 end-to-end verification

- [ ] **Step 1: Re-run install idempotently**

```bash
cd ~/dotfiles && ./install.sh 2>&1 | grep -E 'claude|SessionStart' | grep -vi 'ok ' || ./install.sh >/dev/null && echo "idempotent re-run clean"
```

Expected: a second run reports `ok` for already-linked files, no `.bak` churn.

- [ ] **Step 2: Confirm nothing left untracked**

```bash
for f in ~/.claude/conventions/*.md ~/.claude/skills/*/ ~/.claude/CLAUDE.md ~/.claude/hooks/*; do
  [ -e "$f" ] || continue; [ -L "$f" ] || echo "STILL UNTRACKED: $f"
done; echo "(only ~/.claude/skills/learned expected, if anything)"
```

Expected: nothing printed except possibly `learned`.

---

# Phase 1 — Reminders feature

## Task 1: Reminder store scaffolding + gitignore

**Files:**
- Create: `claude/reminders/README.md`
- Create: `claude/reminders/archive/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create the store README**

Create `claude/reminders/README.md`:

```markdown
# Reminders store

Cross-session reminders surfaced by the `reminder-checkin.mjs` SessionStart hook.
One `<slug>.md` file per reminder. See the "Reminders" section of `~/.claude/CLAUDE.md`
for the authoring convention and `docs/superpowers/specs/2026-06-05-cross-session-reminders-design.md`
for the design.

- Active reminders: `*.md` in this directory (git-tracked).
- Resolved/dismissed: moved to `archive/` (git-tracked, never surfaced).
- `.state/`: per-project daily-throttle timestamps (gitignored, machine-local).

Frontmatter:

​```yaml
name: <kebab-slug>
scope: global | project:<name>
due: 2026-06-09            # optional; omit = "next session in scope"
created: 2026-06-05
source_session: <id>
done_when: <completion condition>   # optional
status: active            # active | done
​```
```

- [ ] **Step 2: Create the archive keepfile**

```bash
mkdir -p claude/reminders/archive
touch claude/reminders/archive/.gitkeep
```

- [ ] **Step 3: Ignore the runtime state dir**

Append to `.gitignore`:

```
# Reminder check-in throttle state (machine-local, transient)
claude/reminders/.state/
```

- [ ] **Step 4: Commit**

```bash
git add claude/reminders/README.md claude/reminders/archive/.gitkeep .gitignore
git commit -m "feat(reminders): scaffold reminder store + ignore throttle state"
```

---

## Task 2: Hook pure functions (TDD)

**Files:**
- Create: `claude/hooks/reminder-checkin.mjs`
- Test: `claude/hooks/reminder-checkin.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `claude/hooks/reminder-checkin.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseFrontmatter, resolveProject, loadReminders, selectReminders,
  alreadyCheckedInToday, stampCheckin, renderContext, runCheckin, localToday,
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
  const got = selectReminders(rs, 'crew', '2026-06-05').map(r => r.name).sort();
  assert.deepEqual(got, ['c', 'g', 'past']);
});

test('throttle: stamp then detect same-day; missing state = false', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rem-state-'));
  assert.equal(alreadyCheckedInToday(dir, 'crew', '2026-06-05'), false);
  stampCheckin(dir, 'crew', '2026-06-05');
  assert.equal(alreadyCheckedInToday(dir, 'crew', '2026-06-05'), true);
  assert.equal(alreadyCheckedInToday(dir, 'crew', '2026-06-06'), false);
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

test('localToday returns YYYY-MM-DD', () => {
  assert.match(localToday(new Date(2026, 5, 5)), /^2026-06-05$/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 'claude/hooks/*.test.mjs'`
Expected: FAIL — `Cannot find module './reminder-checkin.mjs'` (file not created yet).

- [ ] **Step 3: Implement the module**

Create `claude/hooks/reminder-checkin.mjs`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test 'claude/hooks/*.test.mjs'`  (the bare-directory form misbehaves in Node 24)
Expected: PASS — all tests green (10 passing).

- [ ] **Step 5: Commit**

```bash
git add claude/hooks/reminder-checkin.mjs claude/hooks/reminder-checkin.test.mjs
git commit -m "feat(reminders): add reminder-checkin SessionStart hook + tests"
```

---

## Task 3: Integration smoke via real stdin

**Files:**
- Test (manual): `claude/hooks/reminder-checkin.mjs`

- [ ] **Step 1: Build a throwaway fixture store + invoke via stdin**

Run:

```bash
TMP=$(mktemp -d)
mkdir -p "$TMP/reminders"
printf -- '---\nname: smoke\nscope: global\nstatus: active\n---\nsmoke-test body\n' > "$TMP/reminders/smoke.md"
# Point the hook at the fixture by faking HOME so ~/.claude/reminders resolves there:
mkdir -p "$TMP/.claude"; ln -s "$TMP/reminders" "$TMP/.claude/reminders"
echo "{\"cwd\":\"$TMP\"}" | HOME="$TMP" node claude/hooks/reminder-checkin.mjs
```

Expected: a single line of JSON containing `"hookEventName":"SessionStart"` and `smoke-test body`.

- [ ] **Step 2: Verify the throttle on a second invocation**

Run (same shell):

```bash
echo "{\"cwd\":\"$TMP\"}" | HOME="$TMP" node claude/hooks/reminder-checkin.mjs; echo "exit=$?"
```

Expected: **no output**, `exit=0` (throttled — already checked in today). Clean up: `rm -rf "$TMP"`.

- [ ] **Step 3: Verify empty-store is silent**

Run:

```bash
T2=$(mktemp -d); mkdir -p "$T2/.claude/reminders"
echo "{\"cwd\":\"$T2\"}" | HOME="$T2" node claude/hooks/reminder-checkin.mjs; echo "exit=$?"; rm -rf "$T2"
```

Expected: no output, `exit=0`.

(No commit — verification only.)

---

## Task 4: Symlink wiring via install.sh

**Files:**
- Modify: `install.sh:37` (after the `doc-parity-gate.sh` link line)

- [ ] **Step 1: Add link lines**

In `install.sh`, immediately after the line:

```bash
link "$DOTFILES/claude/hooks/doc-parity-gate.sh"          "$HOME/.claude/hooks/doc-parity-gate.sh"
```

add:

```bash
link "$DOTFILES/claude/hooks/reminder-checkin.mjs"        "$HOME/.claude/hooks/reminder-checkin.mjs"
link "$DOTFILES/claude/reminders"                         "$HOME/.claude/reminders"
```

Then, after the full `link ...` block (alongside the delta gitconfig `include.path` block at the
bottom), register the hook idempotently using the Phase 0 helper:

```bash
ensure_session_start_hook "$NODE_BIN $HOME/.claude/hooks/reminder-checkin.mjs"
```

- [ ] **Step 2: Run install + verify symlinks**

Run:

```bash
./install.sh 2>&1 | grep -E 'reminder|reminders'
readlink ~/.claude/hooks/reminder-checkin.mjs
readlink ~/.claude/reminders
```

Expected: both symlinks point into `~/dotfiles/claude/...`; install prints `ok`/`new` for each. If `~/.claude/reminders` already existed as a real dir, install moved it to `.bak` — confirm no data lost (it shouldn't exist yet).

- [ ] **Step 3: Confirm the hook runs through the symlink**

Run:

```bash
echo '{"cwd":"'"$HOME"'/Repos/crew"}' | node ~/.claude/hooks/reminder-checkin.mjs; echo "exit=$?"
```

Expected: `exit=0` (no reminders yet → silent, or a check-in if any exist). No crash.

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat(reminders): symlink reminder hook + store via install.sh"
```

---

## Task 5: Verify the SessionStart hook is registered + fires

Registration is handled by `install.sh` (`ensure_session_start_hook`, added in Task P0.1 and
called in Task 4) — no manual settings.json edit. This task just confirms it took.

**Files:** none (verification only)

- [ ] **Step 1: Confirm the hook is registered in settings.json**

```bash
node -e 'const s=require(require("os").homedir()+"/.claude/settings.json");console.log(JSON.stringify(s.hooks.SessionStart,null,2))'
```

Expected: a `SessionStart` entry whose command ends in `reminder-checkin.mjs`. Validate JSON is
intact: `python3 -c "import json;json.load(open('$HOME/.claude/settings.json'));print('valid')"`.

- [ ] **Step 2: Verify the hook fires through the real path**

```bash
printf -- '---\nname: hook-smoke\nscope: global\nstatus: active\n---\nIf you see this in session context, the SessionStart hook works.\n' > ~/.claude/reminders/hook-smoke.md
echo '{"cwd":"'"$HOME"'/Repos/crew"}' | "$NODE_BIN" ~/.claude/hooks/reminder-checkin.mjs
rm -f ~/.claude/reminders/hook-smoke.md ~/.claude/reminders/.state/checkin-crew.json
```

Expected: JSON output containing `hook-smoke`. (`$NODE_BIN` as resolved in Task P0.1; a brand-new
real session in `~/Repos/crew` is the truest test — confirm the reminder appears in session-start
context, then clean up.)

---

## Task 6: Add the "Reminders" convention to CLAUDE.md (now dotfiles-tracked)

**Files:**
- Modify: `~/dotfiles/claude/CLAUDE.md` (tracked + symlinked as of Task P0.2 — edit the dotfiles
  copy; the `~/.claude/CLAUDE.md` symlink reflects it immediately)

- [ ] **Step 1: Insert a "Reminders" section**

Add a new top-level section to `~/.claude/CLAUDE.md` (place it adjacent to "Followup detection" / "Park planning intentions in Jira", since it is always-on behavior). Content:

```markdown
## Reminders (cross-session)

A reminder is a note-to-future-self that should surface at the right **time** or in the right
**project**, even one set from a different project. The canonical home is the file store at
`~/.claude/reminders/` — surfaced by the `reminder-checkin.mjs` SessionStart hook at most once
per project per day (global items + items for the current repo).

**Creating one.** When I say "remind me [next time in X / tomorrow / on DATE] to …" (or
equivalent), write a file `~/.claude/reminders/<slug>.md`:

​```yaml
name: <kebab-slug>
scope: global | project:<name>     # project:<name> = the target repo's directory name
due: 2026-06-09                    # optional; resolve relative dates ("tomorrow") to absolute
created: <today>
source_session: <this session id>
done_when: <plain-language completion condition>   # optional but encouraged
status: active
​```

…followed by the reminder body (what to do, why, links to `[[followup-anchor]]` / `CREW-NNN` /
file paths). A reminder set from one project for another is just `scope: project:<other>` — the
file lives in the global store, so it surfaces there regardless of where it was authored.

**Never** stash a cross-session reminder as a claude-mem memory, and **never** hand-edit a
`SessionStart` hook blob in a project's `settings.local.json`. Both have silently failed before;
the store + hook is the only mechanism.

**Resolving one.** Proactively mark a reminder done the moment there's **concrete evidence** its
work shipped — its `done_when` is satisfied, or the described task lands this session (a commit,
an opened/merged PR, the edits shipping). Don't wait to be told. Move the file to
`~/.claude/reminders/archive/` with `status: done`, a `resolved: <date>` line, and a one-line
outcome, then report it in passing ("✓ resolved reminder `<slug>` — landed in PR #NN"). Resolve
only on concrete evidence (not mere discussion); when unsure, ask. Archiving (not deleting) makes
erring toward done safe.

**Reviewing.** "review reminders" → discuss the surfaced set; per item act / snooze (bump `due`) /
dismiss (archive). "show all reminders" → read the whole store and list global + every project's
active items, bypassing the per-project filter.
```

- [ ] **Step 2: Verify the section reads cleanly**

Run: `grep -n "## Reminders (cross-session)" ~/.claude/CLAUDE.md`
Expected: one match (the symlink resolves to the tracked dotfiles copy). Re-read the section start-to-finish for contradictions with the existing "Followup detection" and "Park planning intentions in Jira" sections (reminders are lighter-weight than followups/Jira and link to them rather than replace them).

- [ ] **Step 3: Commit**

```bash
cd ~/dotfiles && git add claude/CLAUDE.md
git commit -m "docs(claude): add cross-session Reminders convention to CLAUDE.md"
```

---

## Task 7: Dogfood end-to-end + open the dotfiles PR

**Files:** none (verification + PR)

- [ ] **Step 1: Full dotfiles test + lint pass**

Run:

```bash
cd ~/dotfiles
node --test 'claude/hooks/*.test.mjs'
bash -n install.sh && echo "install.sh syntax ok"
```

Expected: all tests pass; `install.sh syntax ok`.

- [ ] **Step 2: Live dogfood**

Create a real `scope: project:crew` reminder via the convention (e.g. a throwaway "dogfood works" note), start a fresh session in `~/Repos/crew`, confirm the check-in surfaces it, then resolve it via the archive flow. Confirm a second same-day session in crew is silent (throttled).

- [ ] **Step 3: Push branch + open PR**

```bash
cd ~/dotfiles
git push -u origin cross-session-reminders
gh pr create --title "Cross-session reminders convention" \
  --body "Two-phase. Phase 0: bring all user-authored ~/.claude config (CLAUDE.md, conventions, skills) under dotfiles management + add an idempotent install.sh SessionStart-hook registrar. Phase 1: cross-session reminders — global reminder store, SessionStart check-in hook, and the CLAUDE.md Reminders convention. Replaces the hand-built per-project SessionStart hook blobs that never self-cleared. settings.json stays local (machine-specific allowlist) but its reminder-hook registration is reproducible via install.sh. Spec + plan under docs/superpowers/."
```

Expected: PR URL printed. Surface it.

- [ ] **Step 4: Commit the spec + plan if not already tracked**

```bash
git add docs/superpowers/specs/2026-06-05-cross-session-reminders-design.md docs/superpowers/plans/2026-06-05-cross-session-reminders.md
git commit -m "docs(reminders): design spec + implementation plan" || echo "already committed"
```

---

## Notes

- **Node-on-PATH risk** (Tasks P0.1 / 5): the single biggest unknown is whether `node` resolves in
  the SessionStart hook's shell. `ensure_session_start_hook` bakes the absolute `$NODE_BIN` into the
  registered command to de-risk it; Task 5 verifies empirically. If a fresh session shows no
  reminder despite a matching file, suspect the node path first.
- **This retires** the hand-built per-project `SessionStart` reminder hooks. The stale 2026-05-15
  blob (already deleted from `crew/.claude/settings.local.json`) was the last of its kind.
```
