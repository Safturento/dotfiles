# Obsidian tracking vault — design

**Date:** 2026-06-18
**Status:** Approved (brainstorm complete) — ready for implementation plan
**Scope:** User-level infra (`~/.claude` + `~/dotfiles` + a new Obsidian vault). Per the "Don't ticket — handle manually" convention, this ships **without a Jira ticket** and is executed **interactively**, not via `crew run`.

## Problem

Tracking of "things to do / not lose" is spread across four mechanisms with no single human-friendly view:

1. **Reminders** — `~/.claude/reminders/*.md` (symlink → `~/dotfiles/claude/reminders`), local-only/gitignored, surfaced by the `reminder-checkin.mjs` SessionStart hook.
2. **Followups** — `<repo>/docs/followups.md`, versioned with the code so PR review can spot/add/triage them.
3. **Jira** — Epics/tickets, the trackable source of truth for planning intentions.
4. **Memory** — `~/.claude/projects/<url-encoded-path>/memory/*.md`, user-level patterns + index.

Each store has a *machine consumer* (hook parses reminders, PR review reads followups, crew/Jira track planning), but there is no place a *human* can browse all of it at once — across projects, on desktop or mobile, with search/graph/backlinks.

## Goal

An Obsidian vault that is the **unified human view** over these stores, **without breaking the machine consumers**. The vault should be browsable on desktop and mobile, support cross-project rollups, and let edits flow back to canonical where safe.

## Approach decisions (resolved during brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Vault role | Unified view; existing stores stay canonical | Don't break the hook / PR review / Jira |
| Sources aggregated | Reminders, Memory, Followups, Jira | All four |
| Staying current | **Symlinks** (live, no sync step) for files; MCP snapshots for Jira | Zero staleness for file sources |
| Symlink direction | **Inward** (real bytes in vault) for reminders + memory | MCPVault blocks out-of-vault symlinks; inward keeps MCP fully capable |
| Followups | Stay **git-tracked** in-repo; **outward** symlink into vault | Preserve atomic PR-coupled resolution, PR-review visibility, crew-dispatch access; outward symlink still gives the full Obsidian-app view |
| Vault storage | **Cloud-synced** (mobile access); `device:` frontmatter tag to filter per machine | Mobile is the human-friendliness payoff; device tag discriminates multi-machine items |
| Jira | **MCP snapshot notes** via the existing Atlassian MCP | No token ever enters the synced vault (token stays in MCP config); mobile-safe; backlinkable |
| Jira folder | Per-project, under each project folder | One-stop project view |

## The governing constraint: MCPVault's vault-boundary guard

MCPVault (`@bitbonsai/mcpvault`, filesystem-based, no auth) enforces: *"Resolved paths are checked against vault boundaries."* A symlink **inside** the vault that resolves **outside** it is **blocked from the MCP** (read/write/search refuse it). The **Obsidian desktop/mobile app follows those symlinks fine** — the guard only bites Claude-via-MCP.

This is why direction is chosen per-source:

| Source | Real bytes | Canonical path | Vault entry | MCP | App | Live |
|---|---|---|---|---|---|---|
| Reminders | in vault | `~/.claude/reminders` → vault | real dir | ✅ | ✅ | live |
| Memory | in vault | `~/.claude/projects/<enc>/memory` → vault | real dir | ✅ | ✅ | live |
| Followups | in repo (git) | unchanged (`<repo>/docs/followups.md`) | outward symlink → repo | ❌ | ✅ | live |
| Jira | Jira | n/a | MCP snapshot notes | ✅ | ✅ | ⟳ refresh |

Losing MCP search over followups costs almost nothing: Claude already reads `docs/followups.md` directly in-repo, where the PR-coupling lives.

### Symlink-direction sync subtlety
- **Inward** symlinks (`~/.claude/...`) live *outside* the vault, so they are **not synced**. Each machine keeps its own pointer into its local copy of the synced vault; the vault holds only real files (sync-friendly).
- **Outward** followup symlinks live *inside* the vault, so they **do sync** but only resolve on the machine that has that repo at that path (dangle elsewhere). Acceptable — followups are a desktop-dev concern.
- **Verify in planning:** confirm the chosen sync engine handles symlinks-inside-the-vault without corrupting them (some engines copy/break symlinks). If problematic, exclude the outward symlinks from sync or accept they're desktop-only.

## Vault layout

```
vault/
  reminders/                 # REAL dir; ~/.claude/reminders symlinks in
    <slug>.md
    archive/
  projects/
    crew/
      memories/              # REAL dir; canonical memory dir symlinks in
        MEMORY.md
        <fact>.md
      followups.md           # OUTWARD symlink → ~/Repos/crew/docs/followups.md
      jira/
        CREW-94.md           # MCP snapshot notes for this project's Jira space
    <project>/ …
  projects/_jira-only/
    <KEY>/                   # Jira spaces with no corresponding code project
  dashboards/
    home.md                  # Dataview rollup across ALL projects (todo view)
    jira.md                  # optional cross-project Jira board view
```

### Clean-name mapping
A single mapping converges three identifiers onto one project folder:
- Memory's URL-encoded path (`-home-safturento-Repos-crew`)
- The repo's followups location (`~/Repos/crew/docs/followups.md`)
- The Jira project key (`CREW`)

→ all map to `projects/crew/`.

Clean name derived from the trailing segment of the memory path; the mapping table is defined as part of the implementation plan and handles: the bare-home dir (`-home-safturento`), collisions, and Jira keys with no code project (fall back to `projects/_jira-only/<KEY>/`).

## Frontmatter additions

- **Reminders** gain `device:` (which machine — discriminator for the synced multi-device case) and a `project:` tag (alongside existing `scope:`), so the app and Dataview can filter.
- **Memory / Jira notes** carry tags enabling Dataview rollups.

### Reminder hook change (consequence of cloud-sync)
Because `~/.claude/reminders` on each machine now symlinks into a **shared** synced vault, the `reminder-checkin.mjs` hook must **filter by `device`** so it only surfaces this machine's + global reminders, not every synced machine's. The hook lives in `~/dotfiles/claude/hooks/` (user-level), so this is a manual edit within this effort, not a separate ticket.

## Refresh & sync model

- Reminders / memory / followups: **no refresh step** — symlinks make them inherently live and bidirectional (edit in Obsidian/mobile → writes straight to canonical; a new note in `vault/reminders/` *is* a real reminder the hook surfaces).
- Jira: MCP snapshot notes refreshed **on-demand** via a small skill to start. A scheduled `/schedule` agent is a later upgrade if staleness bites.
- Vault is **cloud-synced** via the user's sync engine of choice for mobile access.

## Tooling

- Register **MCPVault** in `~/.claude.json` `mcpServers`, pointing `npx @bitbonsai/mcpvault@latest <vault-path>`. Gives Claude read/write/search over reminders + memory + Jira notes (followups remain read-via-repo).
- Obsidian **Dataview** plugin for the cross-project dashboards — the core human-friendliness payoff (all followups / reminders / Jira in one queryable table).

## Out of scope / future enhancements

- **Custom Obsidian Jira plugin** using Obsidian's native secrets-vault API. The maintained community option (`obsidian-jira-issue`) is abandoned and predates Obsidian's secrets-vault feature, so it would require a Jira API token in the (now cloud-synced) vault config — against the secrets posture. A purpose-built plugin reading the token from Obsidian's secrets vault would give live JQL rendering without exposing the token. Revisit if MCP snapshots prove too stale.
- **Scheduled Jira-refresh agent** (`/schedule`) — upgrade from on-demand refresh.

## Open items to resolve in the plan

- **Vault path + sync engine.** Proposed default: `~/vault` synced via Obsidian Sync. Confirm before implementing.
- **Reminder real-bytes relocation.** Reminders currently real-live in `~/dotfiles/claude/reminders` (with tracked `README.md` + `archive/.gitkeep`). Moving real bytes into the vault means deciding the fate of that dotfiles dir (retire it, or repoint `~/.claude/reminders` directly at the vault and keep the README as documentation). Detail for the plan.
- **Exact clean-name mapping table** for the 5 existing memory dirs + active repos + Jira keys.
- **Sync-engine symlink behavior** verification (see subtlety above).
