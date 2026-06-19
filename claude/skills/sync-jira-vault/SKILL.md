---
name: sync-jira-vault
description: Use when asked to refresh the Jira mirror in the Obsidian vault — phrases like "sync jira to vault", "refresh jira notes", "update the jira mirror". Pulls open/planning-queue issues via the Atlassian MCP and writes per-project snapshot notes into ~/obsidian/AI/projects/<clean>/jira/. No Jira token ever touches the vault.
---

# Sync Jira → Obsidian vault

Mirrors Jira issues into the Obsidian tracking vault as plain-markdown snapshot
notes, one file per issue, grouped by project. The vault is cloud-synced (Windows
+ mobile) so this gives a human-browsable Jira view without a live plugin and
**without ever putting a Jira API token in the vault** — all Jira access is via
the already-authenticated Atlassian MCP; notes are written as local files (the
`obsidian-headless` daemon syncs them).

See `~/dotfiles/docs/superpowers/specs/2026-06-18-obsidian-tracking-vault-design.md`
for the design.

## Project key → vault folder mapping

| Jira key | Vault folder |
|---|---|
| `CREW` | `projects/crew/jira/` |
| `KAN` | `projects/Recipes/jira/` |
| `HAI` | `projects/home-assistant/jira/` |
| (any other key) | `projects/_jira-only/<KEY>/` |

If you encounter a key not in this table, check whether a `~/Repos/<name>` /
`projects/<name>/` already exists for it (worktrees like `Recipes-KAN-35` reveal
the key↔repo link); if so add it to this table and the spec's mapping. Otherwise
fall back to `projects/_jira-only/<KEY>/`.

## Steps

1. **Scope.** These are mostly **solo projects where issues are unassigned**, so
   an `assignee = currentUser()` filter usually returns nothing — don't lead with
   it. Default JQL: `statusCategory != Done ORDER BY updated DESC`, scoped to a
   project when named ("sync jira for CREW" → `project = CREW AND statusCategory
   != Done`). Confirm scope with the user on the first run or when ambiguous.
   (A whole-account run can be large; per-project keeps batches reviewable.)

2. **Resolve the cloud id** via the Atlassian MCP (`getAccessibleAtlassianResources`).

3. **Query** with `searchJiraIssuesUsingJql` (fields: key, summary, status,
   issuetype, assignee, updated, description). Page through all results.

4. **Write one note per issue** to `~/obsidian/AI/projects/<clean>/jira/<KEY>.md`
   using the Write tool (create the `jira/` dir if missing). Frontmatter + body:

   ```markdown
   ---
   key: <KEY>
   summary: <summary>
   status: <status>
   type: <issue type>
   assignee: <name>
   updated: <ISO date>
   url: https://safturento.atlassian.net/browse/<KEY>
   tags: [jira, <clean>]
   synced: <today's date>
   ---

   # <KEY> — <summary>

   <description rendered as markdown>

   **Links:** [[followups]] · [open in Jira](https://safturento.atlassian.net/browse/<KEY>)
   ```

5. **Prune stale snapshots.** List existing `*.md` under each touched
   `projects/<clean>/jira/`; any whose `<KEY>` is no longer in the result set AND
   whose live status is Done → offer to delete (confirm the list with the user
   first). This keeps the mirror from accumulating closed issues forever.

6. **Report:** counts of notes written / updated / pruned, per project, and note
   that the daemon will sync them to Windows + mobile within seconds.

## Guardrails

- **NEVER** write a Jira API token, auth header, or credential into any vault
  file. All Jira data comes from the Atlassian MCP; the vault holds only issue
  content.
- Notes are snapshots, not live — they're as fresh as the last run. Re-run this
  skill to refresh (a scheduled `/schedule` job is a possible future upgrade).
- Use the `obsidian-vault` MCP `search_notes` (when available) to check for an
  existing note before deciding create-vs-update, but always perform the write as
  a direct file write so the skill works even when that MCP isn't loaded.
