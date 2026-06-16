# Reminders store

Cross-session reminders surfaced by the `reminder-checkin.mjs` SessionStart hook.
One `<slug>.md` file per reminder. See the "Reminders (cross-session)" section of
`~/.claude/CLAUDE.md` for the authoring convention and
`docs/superpowers/specs/2026-06-05-cross-session-reminders-design.md` for the design.

Reminder files are **local-only** — gitignored, never committed. The store must
survive branch switches and is never referenced from git history, so its contents
live only on this machine. Only this `README.md` and `archive/.gitkeep` are tracked,
so the directories always exist on a fresh checkout (the `~/.claude/reminders`
symlink would dangle otherwise).

- Active reminders: `*.md` in this directory. The whole active set is a living
  queue — it surfaces in full at the start of *every* session in scope.
- Resolved/dismissed: moved to `archive/` (never surfaced). Archiving is the only
  way to stop an item resurfacing.

## Frontmatter

```yaml
name: <kebab-slug>
scope: global | project:<name>
due: 2026-06-09            # optional deadline only; dated items sort first + flag OVERDUE. NOT a hide-until date.
created: 2026-06-05
source_session: <id>
done_when: <completion condition>   # optional
status: active            # active | done
```
