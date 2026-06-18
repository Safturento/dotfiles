# Obsidian Tracking Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **NOTE — this is interactive, user-level infra.** Deliverables live under `~/.claude`, `~/dotfiles`, and a new `~/vault`. Per the "Don't ticket — handle manually" convention there is **no Jira ticket**. Several tasks need the **Obsidian desktop app** (GUI), so this is **driven live in session, not via `crew run`**. Do not auto-start; wait for the go-signal.

**Goal:** Stand up an Obsidian vault that is the unified, mobile-capable human view over reminders, memory, followups, and Jira — without breaking the SessionStart hook, PR-review of followups, or the Jira source-of-truth.

**Architecture:** Reminders and memory physically relocate *into* the vault with canonical paths becoming inward symlinks (so MCPVault can read/write/search them and the hook/harness keep working through the links). Followups stay git-tracked in their repos and appear via outward symlinks (Obsidian-app-visible, MCP-blind). Jira is mirrored as plain-markdown snapshot notes written by Claude through the existing Atlassian MCP (no token ever enters the synced vault).

**Tech Stack:** Obsidian + Obsidian Sync + Dataview plugin; MCPVault (`@bitbonsai/mcpvault`) MCP server; the existing dependency-free Node SessionStart hook (`reminder-checkin.mjs`); the existing Atlassian MCP.

## Global Constraints

- **Vault path:** `~/vault` (confirmed default). Sync engine: **Obsidian Sync**.
- **Hook stays dependency-free:** Node builtins only (`reminder-checkin.mjs` imports nothing external). Any change keeps that invariant.
- **Reminder frontmatter invariant:** every reminder file must open with a `---` fence, carry `scope:`, and close the fence before the body. New `device:`/`project:` fields are additive and optional.
- **Device identity:** `os.hostname()`. A reminder with **no** `device:` field is device-agnostic (surfaces everywhere — back-compat); a reminder with `device: <name>` surfaces only on that host (plus the existing scope rule).
- **Secrets:** no Jira API token may be written into the vault. Jira data arrives only via the Atlassian MCP into plain-markdown notes.
- **Clean-name mapping** (used by memory, followups, and Jira so all three converge on one folder):

  | Encoded memory dir | Repo path | Jira key | → vault folder |
  |---|---|---|---|
  | `-home-safturento` | (home / no repo) | — | `projects/home/` |
  | `-home-safturento-dotfiles` | `~/dotfiles` | — | `projects/dotfiles/` |
  | `-home-safturento-Repos-crew` | `~/Repos/crew` | `CREW` | `projects/crew/` |
  | (per active repo) | `~/Repos/<name>` | (its key) | `projects/<name>/` |
  | — | — | `<key with no repo>` | `projects/_jira-only/<KEY>/` |

  Worktree-style encoded dirs (`-home-safturento-Repos-crew-CREW-31`) collapse to their base project (`crew`) — they share its memory namespace.

---

### Task 1: Create the vault skeleton and wire Obsidian + sync + Dataview

**Files:**
- Create: `~/vault/` and the folder skeleton below
- Create: `~/vault/.gitignore` is N/A (vault is not git; synced via Obsidian Sync)

**Interfaces:**
- Produces: the `~/vault` directory tree every later task writes into; the running Obsidian app with Sync + Dataview enabled.

- [ ] **Step 1: Create the folder skeleton**

```bash
mkdir -p ~/vault/reminders/archive \
         ~/vault/projects/_jira-only \
         ~/vault/dashboards
```

- [ ] **Step 2: Verify the skeleton exists**

```bash
find ~/vault -type d | sort
```
Expected: lists `~/vault`, `~/vault/dashboards`, `~/vault/projects`, `~/vault/projects/_jira-only`, `~/vault/reminders`, `~/vault/reminders/archive`.

- [ ] **Step 3 (interactive, GUI): Open the vault in Obsidian**

Open Obsidian → "Open folder as vault" → select `~/vault`. Confirm it opens with the empty folder tree visible.

- [ ] **Step 4 (interactive, GUI): Enable Obsidian Sync**

Settings → Core plugins → enable **Sync** → set up / select a remote vault → confirm "Fully synced" status.

- [ ] **Step 5 (interactive, GUI): Install the Dataview community plugin**

Settings → Community plugins → Browse → install **Dataview** → enable it.

- [ ] **Step 6: Verify Obsidian recorded the plugin**

```bash
ls ~/vault/.obsidian/plugins/
```
Expected: includes `dataview`.

- [ ] **Step 7: Confirm sync engine symlink behavior (spec open item)**

After Task 4 creates an outward symlink, re-open Obsidian on a second synced device (or check Sync logs) and confirm the symlink isn't corrupted/duplicated. If the engine mishandles in-vault symlinks, note it and exclude `**/followups.md` symlinks from sync via Obsidian Sync's selective-sync. *(No action now if single-device; revisit when a second device is added.)*

---

### Task 2: Relocate reminders into the vault (inward symlink)

**Files:**
- Move: `~/dotfiles/claude/reminders/*.md` + `archive/*` → `~/vault/reminders/`
- Replace symlink: `~/.claude/reminders` → `~/vault/reminders`
- Modify: `~/dotfiles/claude/reminders/README.md` (becomes a pointer doc)

**Interfaces:**
- Consumes: `~/vault/reminders/` (Task 1).
- Produces: live reminder store at `~/vault/reminders/`, readable by the hook through the repointed `~/.claude/reminders` symlink.

- [ ] **Step 1: Snapshot the current hook output (baseline to diff against)**

```bash
echo '{"cwd":"'"$HOME"'/Repos/crew"}' | node ~/.claude/hooks/reminder-checkin.mjs
```
Expected: JSON listing the current reminders. Save this output to compare after the move.

- [ ] **Step 2: Copy the real reminder files into the vault**

```bash
cp -a ~/dotfiles/claude/reminders/. ~/vault/reminders/
ls ~/vault/reminders/ ~/vault/reminders/archive/
```
Expected: the `*.md` reminders + `README.md` + `archive/` contents now present under `~/vault/reminders/`.

- [ ] **Step 3: Repoint the canonical symlink to the vault**

`~/.claude/reminders` currently points at `~/dotfiles/claude/reminders`. Repoint it at the vault:
```bash
rm ~/.claude/reminders
ln -s ~/vault/reminders ~/.claude/reminders
readlink ~/.claude/reminders
```
Expected: `/home/safturento/vault/reminders`.

- [ ] **Step 4: Verify the hook reads identical reminders from the new location**

```bash
echo '{"cwd":"'"$HOME"'/Repos/crew"}' | node ~/.claude/hooks/reminder-checkin.mjs
```
Expected: same reminder set as the Step 1 baseline (the hook resolves symlinks via `realpathSync`, so this proves the repoint works).

- [ ] **Step 5: Convert the dotfiles reminders dir into a pointer doc**

Replace the body of `~/dotfiles/claude/reminders/README.md` so future readers aren't misled — the live store now lives in the vault:

```markdown
# Reminders store — MOVED

The live reminder store now lives in the Obsidian vault at `~/vault/reminders/`.
`~/.claude/reminders` is a symlink into the vault. See
`docs/superpowers/specs/2026-06-18-obsidian-tracking-vault-design.md`.

This directory is retained only for git history; do not add reminders here.
```

- [ ] **Step 6: Commit the dotfiles change**

```bash
cd ~/dotfiles
git add claude/reminders/README.md
git commit -m "chore(reminders): store moved into Obsidian vault; README is now a pointer"
```

---

### Task 3: Relocate memory into the vault (inward symlinks) with clean names

**Files:**
- Move: each `~/.claude/projects/<enc>/memory/` → `~/vault/projects/<clean>/memories/`
- Replace symlink: each `~/.claude/projects/<enc>/memory` → the vault location

**Interfaces:**
- Consumes: `~/vault/projects/` (Task 1), the clean-name mapping (Global Constraints).
- Produces: per-project `memories/` dirs in the vault, readable by the harness through inward symlinks.

- [ ] **Step 1: List the real memory dirs to migrate**

```bash
find ~/.claude/projects -maxdepth 2 -name memory -type d
```
Expected: the 5 dirs. For each, derive its clean folder name from the mapping table.

- [ ] **Step 2: Migrate one memory dir (repeat per dir)**

For the primary one (`-home-safturento` → `home`); repeat the same four commands for each remaining dir with its mapped clean name:
```bash
ENC=-home-safturento ; CLEAN=home
mkdir -p ~/vault/projects/$CLEAN
cp -a ~/.claude/projects/$ENC/memory ~/vault/projects/$CLEAN/memories
rm -rf ~/.claude/projects/$ENC/memory
ln -s ~/vault/projects/$CLEAN/memories ~/.claude/projects/$ENC/memory
```

- [ ] **Step 3: Verify each canonical memory path still resolves to MEMORY.md**

```bash
for d in $(find ~/.claude/projects -maxdepth 2 -name memory); do
  echo "$d -> $(readlink -f "$d")"; ls "$d/MEMORY.md" 2>/dev/null || echo "  (no MEMORY.md)";
done
```
Expected: every `memory` path is now a symlink resolving under `~/vault/projects/<clean>/memories`, and the ones that had a `MEMORY.md` still show it.

- [ ] **Step 4: Sanity-check the harness still loads memory**

Start a fresh Claude session in `~` and confirm the memory index still appears in context (the `# claudeMd` / memory block referencing `MEMORY.md`). Expected: unchanged from before the move.

---

### Task 4: Surface followups via outward symlinks

**Files:**
- Create: `~/vault/projects/<clean>/followups.md` → symlink to `<repo>/docs/followups.md` for each active repo

**Interfaces:**
- Consumes: `~/vault/projects/` (Task 1); the repo list (`~/Repos/*/docs/followups.md`).
- Produces: Obsidian-app-visible followups per project (MCP-blind by design).

- [ ] **Step 1: List repos with a followups file**

```bash
for d in ~/Repos/*/; do [ -f "$d/docs/followups.md" ] && echo "$d"; done
```
Expected: e.g. `Recipes`, `crew`, `home-assistant`, `skadimetric`, plus active worktrees. Map each to its clean folder; worktrees (`crew-CREW-242`) collapse to the base project (`crew`) — link only the main checkout's followups, not each worktree's.

- [ ] **Step 2: Create one outward symlink per base project (repeat per repo)**

```bash
CLEAN=crew ; REPO=~/Repos/crew
mkdir -p ~/vault/projects/$CLEAN
ln -s "$REPO/docs/followups.md" ~/vault/projects/$CLEAN/followups.md
```

- [ ] **Step 3: Verify the symlinks resolve**

```bash
for f in ~/vault/projects/*/followups.md; do echo "$f -> $(readlink -f "$f")"; done
```
Expected: each resolves to a real `docs/followups.md` in its repo.

- [ ] **Step 4 (interactive, GUI): Confirm Obsidian renders a followups file**

Open `projects/crew/followups.md` in Obsidian. Expected: the repo's followups content renders (proving the app follows the outward symlink even though MCP would refuse it).

---

### Task 5: Add `device:` filtering to reminders and the hook

**Files:**
- Modify: `~/dotfiles/claude/hooks/reminder-checkin.mjs` (readStore, selectReminders, runCheckin, main)
- Modify: `~/dotfiles/claude/hooks/reminder-checkin.test.mjs` (new tests)

**Interfaces:**
- Consumes: existing exported `readStore`, `selectReminders`, `runCheckin`.
- Produces: `selectReminders(reminders, project, device)` — third positional arg; `device` defaults to `null` meaning "no device filter". `runCheckin({ remindersDir, cwd, today, device })` — new `device` field.

- [ ] **Step 1: Write the failing tests**

Add to `reminder-checkin.test.mjs`:
```javascript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ~/dotfiles && node --test claude/hooks/reminder-checkin.test.mjs`
Expected: FAIL — `reminders[0].device` is `undefined` and `selectReminders` ignores the third arg / wrong arity.

- [ ] **Step 3: Capture `device` in `readStore`**

In `reminder-checkin.mjs`, in the `reminders.push({ ... })` object inside `readStore`, add the field:
```javascript
      device: parsed.data.device || null,
```
(Place it next to `scope`, before `due`.)

- [ ] **Step 4: Add the device filter to `selectReminders`**

Change the signature and filter:
```javascript
export function selectReminders(reminders, project, device = null) {
  return reminders
    .filter((r) =>
      r.status === 'active' &&
      (r.scope === 'global' || r.scope === `project:${project}`) &&
      (!device || !r.device || r.device === device),
    )
    .sort((a, b) => {
      if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
      if (a.due) return -1;
      if (b.due) return 1;
      return 0;
    });
}
```

- [ ] **Step 5: Thread `device` through `runCheckin` and `main`**

In `runCheckin`, accept and pass `device`:
```javascript
export function runCheckin({ remindersDir, cwd, today, device = null }) {
  const project = resolveProject(cwd);
  const { reminders, malformed } = readStore(remindersDir);
  const matched = selectReminders(reminders, project, device);
  if (matched.length === 0 && malformed.length === 0) return null;
  return {
    systemMessage: renderSystemMessage(matched, today, malformed),
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: renderContext(matched, today, malformed) },
  };
}
```
In `main`, import `hostname` and pass it. The file already imports `homedir` from `node:os`; change that import line to:
```javascript
import { homedir, hostname } from 'node:os';
```
and update the `runCheckin` call:
```javascript
  const out = runCheckin({ remindersDir, cwd, today: localToday(), device: hostname() });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd ~/dotfiles && node --test claude/hooks/reminder-checkin.test.mjs`
Expected: PASS (all tests, including the pre-existing ones — the new `device` arg is optional so old `selectReminders(rs, 'crew')` calls still pass).

- [ ] **Step 7: Smoke-test the live hook**

```bash
echo '{"cwd":"'"$HOME"'/Repos/crew"}' | node ~/.claude/hooks/reminder-checkin.mjs
```
Expected: still lists your reminders (all current ones are device-agnostic, so none are filtered out).

- [ ] **Step 8: Document the new field in the reminders convention**

In `~/dotfiles/claude/CLAUDE.md`, in the "Reminders (cross-session)" frontmatter block, add a line after `scope:`:
```
device: <hostname>                 # OPTIONAL — restrict surfacing to one machine; omit = all machines.
```
*(This is a `~/.claude` deliverable — edited directly, no ticket.)* Mirror the same addition into `~/.claude/reminders/README.md`'s frontmatter example.

- [ ] **Step 9: Commit**

```bash
cd ~/dotfiles
git add claude/hooks/reminder-checkin.mjs claude/hooks/reminder-checkin.test.mjs claude/CLAUDE.md
git commit -m "feat(hooks): per-device reminder filtering for the synced vault"
```

---

### Task 6: Register the MCPVault MCP server

**Files:**
- Modify: `~/.claude.json` (`mcpServers`) — via the `claude mcp` CLI, not hand-edit

**Interfaces:**
- Consumes: the `~/vault` path; the real files placed by Tasks 2–3.
- Produces: MCP tools (`read_note`, `write_note`, `search_notes`, `update_frontmatter`, …) scoped to the vault, used by Task 7.

- [ ] **Step 1: Add the server (user scope)**

```bash
claude mcp add obsidian-vault --scope user -- npx -y @bitbonsai/mcpvault@latest ~/vault
```

- [ ] **Step 2: Verify it registered**

```bash
claude mcp list | grep obsidian-vault
```
Expected: `obsidian-vault` listed.

- [ ] **Step 3: Verify connectivity in a fresh session**

Start a new Claude session and confirm the `obsidian-vault` MCP tools are available (e.g. `get_vault_stats` returns counts), and that `search_notes` finds a reminder but does **not** return a followups file (out-of-vault symlink — boundary guard working as designed).
Expected: reminders/memory searchable; followups absent from MCP results.

---

### Task 7: Jira snapshot skill

**Files:**
- Create: `~/.claude/skills/sync-jira-vault/SKILL.md`

**Interfaces:**
- Consumes: the Atlassian MCP (`searchJiraIssuesUsingJql`, `getJiraIssue`); the MCPVault `write_note`; the clean-name mapping.
- Produces: `projects/<clean>/jira/<KEY>.md` snapshot notes (and `projects/_jira-only/<KEY>/<KEY>.md` for unmapped spaces).

- [ ] **Step 1: Author the skill**

Create `~/.claude/skills/sync-jira-vault/SKILL.md`:
```markdown
---
name: sync-jira-vault
description: Use when asked to refresh the Jira mirror in the Obsidian vault ("sync jira to vault", "refresh jira notes"). Pulls the planning-queue + open issues via the Atlassian MCP and writes per-project snapshot notes into ~/vault/projects/<clean>/jira/. No Jira token ever touches the vault.
---

# Sync Jira → Obsidian vault

1. Resolve the cloud id via `getAccessibleAtlassianResources`.
2. Run `searchJiraIssuesUsingJql` for the tracked set, e.g.
   `assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC`.
   (Adjust JQL with the user if they want a different scope.)
3. For each issue, map its project key to a clean folder via the table in
   `docs/superpowers/specs/2026-06-18-obsidian-tracking-vault-design.md`
   (CREW → projects/crew). Unmapped keys → projects/_jira-only/<KEY>/.
4. Write `~/vault/projects/<clean>/jira/<KEY>.md` via the obsidian-vault MCP
   `write_note`, with this frontmatter + body:

   ---
   key: <KEY>
   summary: <summary>
   status: <status>
   type: <issue type>
   assignee: <name>
   updated: <ISO date>
   url: https://safturento.atlassian.net/browse/<KEY>
   tags: [jira, <clean>]
   synced: <today>
   ---

   # <KEY> — <summary>

   <description as markdown>

   **Links:** [[followups]] · [open in Jira](url)

5. Delete vault Jira notes whose issue is no longer in the result set AND is
   Done (stale snapshot cleanup), confirming the list with the user first.
6. Report: how many notes written/updated/removed, per project.

NEVER write a Jira API token into the vault — all Jira access is via the MCP.
```

- [ ] **Step 2: Dry-run the skill for one project**

Invoke the skill scoped to a single project (e.g. "sync jira to vault for CREW only"). Expected: `~/vault/projects/crew/jira/*.md` notes appear with correct frontmatter.

- [ ] **Step 3: Verify the notes are MCP-searchable and token-free**

```bash
ls ~/vault/projects/crew/jira/
grep -ril "token\|api[_-]key" ~/vault/projects/ || echo "clean: no secrets in vault"
```
Expected: Jira notes present; "clean: no secrets in vault".

---

### Task 8: Dataview dashboards (the unified human view)

**Files:**
- Create: `~/vault/dashboards/home.md`
- Create: `~/vault/dashboards/jira.md`

**Interfaces:**
- Consumes: reminders (real files), memory, Jira notes (real files), followups (symlinked, app-readable). Dataview indexes everything the Obsidian app can see.

- [ ] **Step 1: Write the home dashboard**

Create `~/vault/dashboards/home.md`:
````markdown
# Home — what needs doing

## Reminders (this device + global)
```dataview
TABLE scope, device, due, status
FROM "reminders"
WHERE status = "active"
SORT due asc
```

## Open Jira (all projects)
```dataview
TABLE summary, status, file.folder AS project, updated
FROM "projects"
WHERE contains(tags, "jira") AND status != "Done"
SORT updated desc
```

## Followups (per project)
- [[projects/crew/followups|crew]]
- [[projects/home-assistant/followups|home-assistant]]
- [[projects/skadimetric/followups|skadimetric]]
- [[projects/Recipes/followups|Recipes]]
````

- [ ] **Step 2: Write the Jira board dashboard**

Create `~/vault/dashboards/jira.md`:
````markdown
# Jira board

```dataview
TABLE summary, status, file.folder AS project, assignee, updated
FROM #jira
SORT status asc, updated desc
```
````

- [ ] **Step 3 (interactive, GUI): Verify the dashboards render**

Open `dashboards/home.md` in Obsidian (Dataview enabled). Expected: the reminders table populates from your real reminder files; the Jira table populates from Task 7's notes; the followups links open the symlinked repo files. Adjust the followups link list to match the projects that actually have followups.

---

## Self-Review

**Spec coverage:**
- Unified view / mirror role → Tasks 2–8 (existing stores stay canonical). ✓
- Four sources (reminders, memory, followups, Jira) → Tasks 2, 3, 4, 7. ✓
- Symlinks live/no-sync for files; inward direction → Tasks 2, 3. ✓
- Followups git-tracked + outward symlink → Task 4. ✓
- Cloud-sync + `device:` tag + hook filter → Tasks 1 (Sync) & 5 (device). ✓
- Jira MCP snapshot notes, per-project folders, `_jira-only` fallback, no token in vault → Task 7. ✓
- Clean-name mapping (memory + followups + Jira converge) → Global Constraints + Tasks 3, 4, 7. ✓
- MCPVault registration + boundary-guard verification → Task 6. ✓
- Dataview cross-project dashboards → Task 8. ✓
- Sync-engine symlink caveat → Task 1 Step 7. ✓
- Out-of-scope (custom Jira plugin, scheduled refresh) → intentionally not tasked. ✓

**Placeholder scan:** No TBD/TODO; all code and commands are concrete. Per-repo/per-dir loops show the exact command with one worked example and the repeat rule.

**Type consistency:** `selectReminders(reminders, project, device=null)` and `runCheckin({…, device})` used consistently across Task 5 steps and tests; `device` field name matches frontmatter key and `readStore` capture.

## Open items carried from the spec (confirm during execution)
- Vault path `~/vault` + Obsidian Sync (defaulted — change here if desired before Task 1).
- Exact clean-name rows for every active repo/Jira key (table is seeded; extend in Task 3/4/7 as encountered).
- Sync-engine symlink behavior on a second device (Task 1 Step 7).
