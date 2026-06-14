---
name: workflow
description: <KEY>-* tickets, followups, specs/plans, branching
last_updated: <DATE>
covers:
  - 'docs/followups.md'
  - 'docs/superpowers/**'
  - 'docs/tickets/**'
---

<!--
ASSEMBLY NOTES (delete this whole comment block when done):
This template ships with every conditional section present. The establishing-a-new-project
skill prunes it to the project's discovery answers. Sections/lines are wrapped in markers:
  <!-- IF:JIRA -->   … keep if the project uses Jira; else delete marker-to-marker.
  <!-- IF:CREW -->   … keep if the project runs through crew.
  <!-- IF:REMOTE --> … keep if a git remote (GitHub) exists or is planned.
  <!-- IF:OTHER -->  … placeholder for a user-requested extra section; fill or delete.
Rule: condition holds → delete only the marker lines, keep the content.
      condition fails → delete the markers AND the content between them.
Then fill <PROJECT>, <KEY>, <DATE>, and verify no `<!-- IF:` or raw `<...>` placeholders remain.
Crew implies Jira in almost all cases — if IF:CREW is kept, IF:JIRA usually is too.
-->

# Workflow

Repo-specific overlay on the user-level `~/.claude/CLAUDE.md` "Planning workflow" + "Followup detection" sections. **Read those first** — this doc only names `<PROJECT>`'s instances (prefixes, file locations, branch shapes) and does **not** restate the rules.

## Doc taxonomy (where things live)

| Content | Location |
| ------- | -------- |
| Design spec (from `superpowers:brainstorming`) | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| Implementation plan (from `superpowers:writing-plans`) | `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` |
| Followups queue | `docs/followups.md` (single file) |
| Agent-actionable repo rules | `.agents/<topic>.md` |
<!-- IF:JIRA -->| Per-ticket work log | `docs/tickets/<KEY>-<n>.md` |<!-- /IF:JIRA -->

## Followups

- The queue lives at `docs/followups.md`. Format (entry template, ticketing protocol, Active/Resolved/Abandoned) is defined in user-level `~/.claude/CLAUDE.md` "Followup detection" — follow it verbatim.
- Skim it at the start of substantial new work; move entries to Resolved in the same PR that ships the fix.

<!-- IF:JIRA -->
## Jira prefix

This repo's Jira project key is `<KEY>`. Every ticket is `<KEY>-<n>`. When mixing repos in one session, confirm `<KEY>-*` before implementing anything in this worktree.

## Tickets

- For any non-trivial ticket, keep a work log at `docs/tickets/<KEY>-<n>.md` — Goal, Relevant files, Decisions, Open questions, Ruled out. It is the ticket's working memory; commit history captures _what_ changed, this captures _why_.

## Board + planning statuses

Work tracks on a kanban board with five columns. A ticket's column **is** its planning/execution state:

| Column | Meaning |
| ------ | ------- |
| **Backlog** | Parked — captured but **not yet planned**. The queue of things to brainstorm + spec + plan. New tickets land here by default. |
| **Ready for Development** | Brainstorm + spec + plan done; on the board, awaiting implementation. |
| **In Progress** | Being implemented. |
| **In Review** | Implementation complete; PR open, under review. |
| **Done** | Merged / shipped. |

- **New tickets land in `Backlog`.** Promote to `Ready for Development` only once a spec + plan exist (user-level "Park planning intentions in Jira, not memory" — park the intention as a Jira ticket the moment it's worth planning, not in session memory).
- **"What's queued for planning?"** = `project = <KEY> AND status = "Backlog" ORDER BY updated DESC`. Query Jira first — never session memory or `followups.md` alone. Reconcile each candidate against the code before reporting it as still-queued.
- **Operational note:** get transition ids live from `jira_get_transitions` — never hard-code them — and verify the move actually took (some workflows carry no-op transitions that silently leave the status unchanged).
<!-- /IF:JIRA -->

## Specs and plans

- Specs come out of `superpowers:brainstorming` → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
- Plans come out of `superpowers:writing-plans` → `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`.
- The date prefix is the authoring day, not the ship day. Both directories are flat — no nesting.

## Branching

Never commit on `main` (user-level "Branching"). Branch before staging anything.<!-- IF:REMOTE --> `main` is protected on the remote, so a direct commit can't be pushed anyway — catch it at branch time, not push time. PRs are the integration path.<!-- /IF:REMOTE -->

| Source | Branch shape | Example |
| ------ | ------------ | ------- |
<!-- IF:JIRA -->| Ticketed work | `<KEY>-<n>` | `<KEY>-12` |<!-- /IF:JIRA -->
| Doc-only PR | `docs/<scope>` | `docs/readme-pass` |
| Chore (config, gitignore) | `chore/<scope>` | `chore/gitignore-tweak` |
| Bug fix without a ticket | `fix/<scope>` | `fix/null-deref` |
| Feature without a ticket | `feat/<scope>` | `feat/payload-parser` |

<!-- IF:CREW -->
## Crew dispatch

This repo runs through crew's autonomous dispatch.

- **Stop after planning + ticketing.** Brainstorm + plan produce a spec and a plan doc; translate them into an Epic + child tickets in Jira with "blocks" / "is blocked by" edges; then **stop**. The user triggers implementation via `crew run <KEY>-<n>` (one ticket at a time). Don't dispatch implementer subagents from the planning session.
- **`crew run <KEY>-<n>`** creates the `<KEY>-<n>` branch for you. Dispatch keys off the **`Ready for Development`** column — the user triggers `crew run` on tickets sitting there (see "Board + planning statuses" above).
- **Worktree-per-planning-session.** Provision a dedicated git worktree before any brainstorm / writing-plans flow so concurrent sessions can't clobber each other. Path under `.planning-worktrees/<topic>/` (gitignored), branched off `origin/main`. Remove it when the planning session ends.
<!-- /IF:CREW -->

<!-- IF:OTHER -->
## <user-requested section title>

<user-requested content — fill from the discovery conversation, or delete this block>
<!-- /IF:OTHER -->

## See also

- User-level `~/.claude/CLAUDE.md` — "Planning workflow", "Followup detection", "Branching"<!-- IF:JIRA -->, "Park planning intentions in Jira, not memory"<!-- /IF:JIRA -->.
- User-level `~/.claude/conventions/documentation.md` — generic plan/spec structure<!-- IF:JIRA -->, ticket workflow, and Jira description authoring<!-- /IF:JIRA -->.
