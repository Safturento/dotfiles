# Obsidian Tracking Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **NOTE — this is interactive, user-level infra.** Deliverables live under `~/.claude`, `~/dotfiles`, and a new `~/obsidian/AI` (WSL ext4). Per the "Don't ticket — handle manually" convention there is **no Jira ticket**. Some steps run on the **Windows Obsidian desktop client** (GUI) and a few (`ob login`) need the user's Obsidian credentials, so this is **driven live in session, not via `crew run`**. Do not auto-start; wait for the go-signal.
>
> **Sync topology:** canonical files live on WSL at `~/obsidian/AI`; the `obsidian-headless` `ob sync --continuous` daemon (systemd user service) watches them and drives Obsidian Sync. The Windows desktop client opens the same remote vault at `C:/Obsidian/AI` for editing. Neither side reads across the WSL/Windows boundary.

**Goal:** Stand up an Obsidian vault that is the unified, mobile-capable human view over reminders, memory, followups, and Jira — without breaking the SessionStart hook, PR-review of followups, or the Jira source-of-truth.

**Architecture:** Reminders and memory physically relocate *into* the vault with canonical paths becoming inward symlinks (so MCPVault can read/write/search them and the hook/harness keep working through the links). Followups stay git-tracked in their repos and appear via outward symlinks (Obsidian-app-visible, MCP-blind). Jira is mirrored as plain-markdown snapshot notes written by Claude through the existing Atlassian MCP (no token ever enters the synced vault).

**Tech Stack:** Obsidian Sync via the `obsidian-headless` continuous-sync daemon (WSL) + Windows desktop client; Dataview plugin; MCPVault (`@bitbonsai/mcpvault`) MCP server; the existing dependency-free Node SessionStart hook (`reminder-checkin.mjs`); the existing Atlassian MCP.

## Global Constraints

- **Vault path:** `~/obsidian/AI` on WSL ext4 (mirrors Windows `C:/Obsidian/AI`).
- **Sync:** Obsidian Sync, driven on WSL by `obsidian-headless` (`ob sync --continuous`) as a **systemd user service**; Windows desktop client is a second device of the same remote vault. Requires an active **Obsidian Sync subscription**.
- **Environment (verified):** Node v24.15 (headless needs ≥22 ✓); systemd is PID 1 (user services available ✓). The systemd unit references Node/`ob` through the **fnm default alias** (`~/.local/share/fnm/aliases/default/bin`) so it tracks the default Node automatically. Caveat: global npm packages are per-Node-version, so after a default-Node bump you must `npm install -g obsidian-headless` under the new version or the alias path won't have `ob`.
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

### Task 1: Create the vault skeleton and stand up headless continuous sync

**Files:**
- Create: `~/obsidian/AI/` and the folder skeleton below
- Create: `~/.config/systemd/user/obsidian-sync.service`

**Interfaces:**
- Produces: the `~/obsidian/AI` directory tree every later task writes into; a running `obsidian-headless` continuous-sync daemon keeping it synced to the remote vault. (Vault is not git; synced via Obsidian Sync. The Windows desktop client + Dataview are wired in Task 8, when there's content to view.)

- [x] **Step 1: Create the folder skeleton**

```bash
mkdir -p ~/obsidian/AI/reminders/archive \
         ~/obsidian/AI/projects/_jira-only \
         ~/obsidian/AI/dashboards
```

- [x] **Step 2: Verify the skeleton exists**

```bash
find ~/obsidian/AI -type d | sort
```
Expected: lists `~/obsidian/AI`, `~/obsidian/AI/dashboards`, `~/obsidian/AI/projects`, `~/obsidian/AI/projects/_jira-only`, `~/obsidian/AI/reminders`, `~/obsidian/AI/reminders/archive`.

- [x] **Step 3: Install the headless client**

```bash
npm install -g obsidian-headless
command -v ob && ob --version
```
Expected: `ob` resolves (under the fnm node path) and prints a version. Record the absolute path from `command -v ob` — the systemd unit (Step 6) needs it.

- [x] **Step 4 (interactive — user runs; needs Obsidian credentials): Authenticate**

The user runs this themselves (it prompts for email/password/MFA; do not type their credentials). Suggest they run it in-session with the `!` prefix:
```
! ob login
```
Expected: "Logged in" confirmation. The auth token is written under `~/.config` (NOT in the vault) — never read or echo it.

- [x] **Step 5 (interactive — user enters the E2E password): Connect to the existing remote vault and do the initial sync**

The remote vault **`AI` already exists** (created + connected from the Windows client) and is **end-to-end encrypted**, so `sync-setup` will **connect** to it (not create) and will prompt for the **encryption password** — the user enters it manually; never read, echo, or store it. Suggest running these in-session with the `!` prefix so the prompt is interactive:
```
! cd ~/obsidian/AI && ob sync-setup --vault "AI"
! cd ~/obsidian/AI && ob sync
```
Expected: `sync-setup` connects to the existing `AI` remote and accepts the E2E password; the one-shot `ob sync` reports an initial sync with 0 conflicts. Since the Windows vault is essentially empty, the about-to-be-populated WSL files (Tasks 2–3) will flow WSL → remote → Windows with no merge conflicts.

- [x] **Step 6: Install the continuous-sync systemd user service**

Create `~/.config/systemd/user/obsidian-sync.service`, referencing `ob`/Node through the **fnm default alias** so it tracks the default Node:
```ini
[Unit]
Description=Obsidian headless continuous sync for ~/obsidian/AI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=%h/obsidian/AI
# fnm default alias — repoints automatically when the default Node changes.
# NOTE: global npm packages are per-Node-version, so after a default-Node bump
# you must `npm install -g obsidian-headless` under the new version or `ob` here
# will be missing (the service will fail and Restart=on-failure will retry).
Environment=PATH=/home/safturento/.local/share/fnm/aliases/default/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/safturento/.local/share/fnm/aliases/default/bin/ob sync --continuous
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

- [x] **Step 7: Enable + start the service, and enable lingering so it survives logout/WSL idle**

```bash
systemctl --user daemon-reload
systemctl --user enable --now obsidian-sync.service
loginctl enable-linger "$USER"
systemctl --user status obsidian-sync.service --no-pager
```
Expected: service `active (running)`. *(`enable-linger` lets the user service keep running without an interactive login — needed so Claude's writes sync even when you're only on the Windows client. May require one `sudo` for `loginctl enable-linger`; if it prompts, the user runs that line with `!`.)*

**E2E caveat — verify the daemon runs unattended:** because the vault is end-to-end encrypted and a systemd service can't answer a password prompt, the continuous-sync daemon only works if the manual unlock in Step 5 **cached the E2E key** under `~/.config` (so subsequent `ob sync` runs are non-interactive). Check `journalctl --user -u obsidian-sync.service -n 30` right after start: if it's **waiting on an encryption-password prompt** rather than syncing, the key wasn't cached. Fallback options, in order: (a) check `ob sync --help` for a non-interactive key/password flag or env var and add it to the unit's `Environment=`; (b) if none exists, drop the daemon and instead trigger `ob sync` from the SessionStart hook / a `/schedule` job after a manual unlock per boot. Record which path was taken.

- [x] **Step 8: Verify continuous sync picks up a change**

```bash
echo "sync canary $(date)" > ~/obsidian/AI/dashboards/_synctest.md
sleep 5
journalctl --user -u obsidian-sync.service -n 20 --no-pager
```
Expected: the log shows the daemon detecting + uploading `_synctest.md`. Then remove it: `rm ~/obsidian/AI/dashboards/_synctest.md` (the deletion should also sync).

---

### Task 2: Relocate reminders into the vault (inward symlink)

**Files:**
- Move: `~/dotfiles/claude/reminders/*.md` + `archive/*` → `~/obsidian/AI/reminders/`
- Replace symlink: `~/.claude/reminders` → `~/obsidian/AI/reminders`
- Modify: `~/dotfiles/claude/reminders/README.md` (becomes a pointer doc)

**Interfaces:**
- Consumes: `~/obsidian/AI/reminders/` (Task 1).
- Produces: live reminder store at `~/obsidian/AI/reminders/`, readable by the hook through the repointed `~/.claude/reminders` symlink.

- [x] **Step 1: Snapshot the current hook output (baseline to diff against)**

```bash
echo '{"cwd":"'"$HOME"'/Repos/crew"}' | node ~/.claude/hooks/reminder-checkin.mjs
```
Expected: JSON listing the current reminders. Save this output to compare after the move.

- [x] **Step 2: Copy the real reminder files into the vault**

```bash
cp -a ~/dotfiles/claude/reminders/. ~/obsidian/AI/reminders/
ls ~/obsidian/AI/reminders/ ~/obsidian/AI/reminders/archive/
```
Expected: the `*.md` reminders + `README.md` + `archive/` contents now present under `~/obsidian/AI/reminders/`.

- [x] **Step 3: Repoint the canonical symlink to the vault**

`~/.claude/reminders` currently points at `~/dotfiles/claude/reminders`. Repoint it at the vault:
```bash
rm ~/.claude/reminders
ln -s ~/obsidian/AI/reminders ~/.claude/reminders
readlink ~/.claude/reminders
```
Expected: `/home/safturento/vault/reminders`.

- [x] **Step 4: Verify the hook reads identical reminders from the new location**

```bash
echo '{"cwd":"'"$HOME"'/Repos/crew"}' | node ~/.claude/hooks/reminder-checkin.mjs
```
Expected: same reminder set as the Step 1 baseline (the hook resolves symlinks via `realpathSync`, so this proves the repoint works).

- [x] **Step 5: Convert the dotfiles reminders dir into a pointer doc**

Replace the body of `~/dotfiles/claude/reminders/README.md` so future readers aren't misled — the live store now lives in the vault:

```markdown
# Reminders store — MOVED

The live reminder store now lives in the Obsidian vault at `~/obsidian/AI/reminders/`.
`~/.claude/reminders` is a symlink into the vault. See
`docs/superpowers/specs/2026-06-18-obsidian-tracking-vault-design.md`.

This directory is retained only for git history; do not add reminders here.
```

- [x] **Step 6: Commit the dotfiles change**

```bash
cd ~/dotfiles
git add claude/reminders/README.md
git commit -m "chore(reminders): store moved into Obsidian vault; README is now a pointer"
```

---

### Task 3: Relocate memory into the vault (inward symlinks) with clean names

**Files:**
- Move: each `~/.claude/projects/<enc>/memory/` → `~/obsidian/AI/projects/<clean>/memories/`
- Replace symlink: each `~/.claude/projects/<enc>/memory` → the vault location

**Interfaces:**
- Consumes: `~/obsidian/AI/projects/` (Task 1), the clean-name mapping (Global Constraints).
- Produces: per-project `memories/` dirs in the vault, readable by the harness through inward symlinks.

- [x] **Step 1: List the real memory dirs to migrate**

```bash
find ~/.claude/projects -maxdepth 2 -name memory -type d
```
Expected: the 5 dirs. For each, derive its clean folder name from the mapping table.

- [x] **Step 2: Migrate one memory dir (repeat per dir)**

For the primary one (`-home-safturento` → `home`); repeat the same four commands for each remaining dir with its mapped clean name:
```bash
ENC=-home-safturento ; CLEAN=home
mkdir -p ~/obsidian/AI/projects/$CLEAN
cp -a ~/.claude/projects/$ENC/memory ~/obsidian/AI/projects/$CLEAN/memories
rm -rf ~/.claude/projects/$ENC/memory
ln -s ~/obsidian/AI/projects/$CLEAN/memories ~/.claude/projects/$ENC/memory
```

- [x] **Step 3: Verify each canonical memory path still resolves to MEMORY.md**

```bash
for d in $(find ~/.claude/projects -maxdepth 2 -name memory); do
  echo "$d -> $(readlink -f "$d")"; ls "$d/MEMORY.md" 2>/dev/null || echo "  (no MEMORY.md)";
done
```
Expected: every `memory` path is now a symlink resolving under `~/obsidian/AI/projects/<clean>/memories`, and the ones that had a `MEMORY.md` still show it.

- [x] **Step 4: Sanity-check the harness still loads memory**

Start a fresh Claude session in `~` and confirm the memory index still appears in context (the `# claudeMd` / memory block referencing `MEMORY.md`). Expected: unchanged from before the move.

---

### Task 4: Surface followups via outward symlinks

**Files:**
- Create: `~/obsidian/AI/projects/<clean>/followups.md` → symlink to `<repo>/docs/followups.md` for each active repo

**Interfaces:**
- Consumes: `~/obsidian/AI/projects/` (Task 1); the repo list (`~/Repos/*/docs/followups.md`).
- Produces: Obsidian-app-visible followups per project (MCP-blind by design).

- [x] **Step 1: List repos with a followups file**

```bash
for d in ~/Repos/*/; do [ -f "$d/docs/followups.md" ] && echo "$d"; done
```
Expected: e.g. `Recipes`, `crew`, `home-assistant`, `skadimetric`, plus active worktrees. Map each to its clean folder; worktrees (`crew-CREW-242`) collapse to the base project (`crew`) — link only the main checkout's followups, not each worktree's.

- [x] **Step 2: Create one outward symlink per base project (repeat per repo)**

```bash
CLEAN=crew ; REPO=~/Repos/crew
mkdir -p ~/obsidian/AI/projects/$CLEAN
ln -s "$REPO/docs/followups.md" ~/obsidian/AI/projects/$CLEAN/followups.md
```

- [x] **Step 3: Verify the symlinks resolve**

```bash
for f in ~/obsidian/AI/projects/*/followups.md; do echo "$f -> $(readlink -f "$f")"; done
```
Expected: each resolves to a real `docs/followups.md` in its repo.

- [x] **Step 4: Confirm how the sync daemon treats the in-vault symlinks (answers the Task 8 open question)**

```bash
sleep 6 && journalctl --user -u obsidian-sync.service -n 15 --no-pager | grep -iE "followup|upload|synced"
for f in ~/obsidian/AI/projects/*/followups.md; do [ -L "$f" ] && echo "still symlink ✓ $f" || echo "REPLACED ✗ $f"; done
```
**Observed (2026-06-18):** the headless daemon **dereferences** each symlink and uploads the **content** (not a broken stub), while the WSL side **stays a symlink**. So followups appear as readable real files on the Windows client + mobile — better than the "broken stub" risk the plan originally hedged against.

**Guidance (write-back caveat):** sync is bidirectional, so editing a followup on Windows/mobile would propagate back toward WSL — at best writing through the symlink into the repo file, at worst replacing the WSL symlink with a real file (decoupling it from the repo). This matches the convention anyway: **view followups on Windows; edit them in the repo via the PR flow.** Optional one-time check: edit a followup on Windows and confirm whether WSL writes through the symlink or replaces it; if it replaces, exclude `**/followups.md` from sync and treat them as WSL-only.

---

### Task 5: Add `device:` filtering to reminders and the hook

**Files:**
- Modify: `~/dotfiles/claude/hooks/reminder-checkin.mjs` (readStore, selectReminders, runCheckin, main)
- Modify: `~/dotfiles/claude/hooks/reminder-checkin.test.mjs` (new tests)

**Interfaces:**
- Consumes: existing exported `readStore`, `selectReminders`, `runCheckin`.
- Produces: `selectReminders(reminders, project, device)` — third positional arg; `device` defaults to `null` meaning "no device filter". `runCheckin({ remindersDir, cwd, today, device })` — new `device` field.

- [x] **Step 1: Write the failing tests**

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

- [x] **Step 2: Run the tests to verify they fail**

Run: `cd ~/dotfiles && node --test claude/hooks/reminder-checkin.test.mjs`
Expected: FAIL — `reminders[0].device` is `undefined` and `selectReminders` ignores the third arg / wrong arity.

- [x] **Step 3: Capture `device` in `readStore`**

In `reminder-checkin.mjs`, in the `reminders.push({ ... })` object inside `readStore`, add the field:
```javascript
      device: parsed.data.device || null,
```
(Place it next to `scope`, before `due`.)

- [x] **Step 4: Add the device filter to `selectReminders`**

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

- [x] **Step 5: Thread `device` through `runCheckin` and `main`**

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

- [x] **Step 6: Run the tests to verify they pass**

Run: `cd ~/dotfiles && node --test claude/hooks/reminder-checkin.test.mjs`
Expected: PASS (all tests, including the pre-existing ones — the new `device` arg is optional so old `selectReminders(rs, 'crew')` calls still pass).

- [x] **Step 7: Smoke-test the live hook**

```bash
echo '{"cwd":"'"$HOME"'/Repos/crew"}' | node ~/.claude/hooks/reminder-checkin.mjs
```
Expected: still lists your reminders (all current ones are device-agnostic, so none are filtered out).

- [x] **Step 8: Document the new field in the reminders convention**

In `~/dotfiles/claude/CLAUDE.md`, in the "Reminders (cross-session)" frontmatter block, add a line after `scope:`:
```
device: <hostname>                 # OPTIONAL — restrict surfacing to one machine; omit = all machines.
```
*(This is a `~/.claude` deliverable — edited directly, no ticket.)* Mirror the same addition into `~/.claude/reminders/README.md`'s frontmatter example.

- [x] **Step 9: Commit**

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
- Consumes: the `~/obsidian/AI` path; the real files placed by Tasks 2–3.
- Produces: MCP tools (`read_note`, `write_note`, `search_notes`, `update_frontmatter`, …) scoped to the vault, used by Task 7.

- [ ] **Step 1: Add the server (user scope)**

```bash
claude mcp add obsidian-vault --scope user -- npx -y @bitbonsai/mcpvault@latest ~/obsidian/AI
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
description: Use when asked to refresh the Jira mirror in the Obsidian vault ("sync jira to vault", "refresh jira notes"). Pulls the planning-queue + open issues via the Atlassian MCP and writes per-project snapshot notes into ~/obsidian/AI/projects/<clean>/jira/. No Jira token ever touches the vault.
---

# Sync Jira → Obsidian vault

1. Resolve the cloud id via `getAccessibleAtlassianResources`.
2. Run `searchJiraIssuesUsingJql` for the tracked set, e.g.
   `assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC`.
   (Adjust JQL with the user if they want a different scope.)
3. For each issue, map its project key to a clean folder via the table in
   `docs/superpowers/specs/2026-06-18-obsidian-tracking-vault-design.md`
   (CREW → projects/crew). Unmapped keys → projects/_jira-only/<KEY>/.
4. Write `~/obsidian/AI/projects/<clean>/jira/<KEY>.md` via the obsidian-vault MCP
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

Invoke the skill scoped to a single project (e.g. "sync jira to vault for CREW only"). Expected: `~/obsidian/AI/projects/crew/jira/*.md` notes appear with correct frontmatter.

- [ ] **Step 3: Verify the notes are MCP-searchable and token-free**

```bash
ls ~/obsidian/AI/projects/crew/jira/
grep -ril "token\|api[_-]key" ~/obsidian/AI/projects/ || echo "clean: no secrets in vault"
```
Expected: Jira notes present; "clean: no secrets in vault".

---

### Task 8: Windows client + Dataview dashboards (the unified human view)

**Files:**
- Create: `~/obsidian/AI/dashboards/home.md`
- Create: `~/obsidian/AI/dashboards/jira.md`

**Interfaces:**
- Consumes: reminders (real files), memory, Jira notes (real files), followups (symlinked, app-readable). Dataview indexes everything the Obsidian app can see. By now Tasks 2/3/4/7 have populated the vault and the headless daemon (Task 1) has synced it to the remote.

- [ ] **Step 1 (interactive, Windows GUI): Connect the Windows desktop client**

On Windows, open Obsidian → Sync → log in to the same account → connect the remote vault `AI` to a local folder at `C:/Obsidian/AI`. Confirm it downloads the synced content (reminders/, projects/, dashboards/) and shows "Fully synced".

- [ ] **Step 2 (interactive, Windows GUI): Install + enable Dataview**

On the Windows client: Settings → Community plugins → Browse → install **Dataview** → enable it. Its config syncs down to the WSL replica automatically.

- [ ] **Step 3: Verify the symlink-over-sync behavior on Windows (mostly answered in Task 4 Step 4)**

Already established on the WSL/daemon side (Task 4 Step 4): the daemon dereferences the symlinks and uploads followup **content**, so Windows should show real, readable followup files. On the Windows client, just confirm `projects/<proj>/followups.md` renders the expected content. Per the write-back caveat, **don't edit followups on Windows** — edit them in the repo. (Optional: run the one-time Windows-edit write-back check from Task 4 Step 4.)

- [ ] **Step 4: Write the home dashboard**

Create `~/obsidian/AI/dashboards/home.md`:
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

- [ ] **Step 5: Write the Jira board dashboard**

Create `~/obsidian/AI/dashboards/jira.md`:
````markdown
# Jira board

```dataview
TABLE summary, status, file.folder AS project, assignee, updated
FROM #jira
SORT status asc, updated desc
```
````

- [ ] **Step 6 (interactive, Windows GUI): Verify the dashboards render**

Open `dashboards/home.md` on the Windows client (Dataview enabled). Expected: the reminders table populates from your real reminder files; the Jira table populates from Task 7's notes. Adjust the followups link list to match the projects that actually have followups (and per Step 3, followups links may be WSL-only). Cross-check on mobile if desired.

---

## Self-Review

**Spec coverage:**
- Unified view / mirror role → Tasks 2–8 (existing stores stay canonical). ✓
- Four sources (reminders, memory, followups, Jira) → Tasks 2, 3, 4, 7. ✓
- Symlinks live/no-sync for files; inward direction → Tasks 2, 3. ✓
- Followups git-tracked + outward symlink → Task 4. ✓
- Cloud-sync via headless continuous-sync daemon + `device:` tag + hook filter → Task 1 (headless sync) & Task 5 (device). ✓
- Jira MCP snapshot notes, per-project folders, `_jira-only` fallback, no token in vault → Task 7. ✓
- Clean-name mapping (memory + followups + Jira converge) → Global Constraints + Tasks 3, 4, 7. ✓
- MCPVault registration + boundary-guard verification → Task 6. ✓
- Windows desktop client + Dataview cross-project dashboards → Task 8. ✓
- Sync-engine symlink-over-sync caveat → Task 8 Step 3. ✓
- Out-of-scope (custom Jira plugin, scheduled refresh) → intentionally not tasked. ✓

**Placeholder scan:** No TBD/TODO; all code and commands are concrete. Per-repo/per-dir loops show the exact command with one worked example and the repeat rule.

**Type consistency:** `selectReminders(reminders, project, device=null)` and `runCheckin({…, device})` used consistently across Task 5 steps and tests; `device` field name matches frontmatter key and `readStore` capture.

## Open items carried from the spec (confirm during execution)
- Exact clean-name rows for every active repo/Jira key (table is seeded; extend in Task 3/4/7 as encountered).
- Sync-engine symlink-over-sync behavior on the Windows client (Task 8 Step 3) — determines whether `**/followups.md` needs selective-sync exclusion.
- ✅ Remote vault resolved: `AI` already exists (Windows-created, connected to Sync, **E2E encrypted**). `sync-setup` connects to it; the user enters the E2E password manually (Task 1 Step 5).
- **E2E vs. unattended daemon** (Task 1 Step 7): confirm the headless client caches the E2E key so `ob sync --continuous` runs without a prompt; fall back to hook/scheduled `ob sync` if not.
