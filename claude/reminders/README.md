# Reminders store

Cross-session reminders surfaced by the `reminder-checkin.mjs` SessionStart hook.
One `<slug>.md` file per reminder. See the "Reminders (cross-session)" section of
`~/.claude/CLAUDE.md` for the authoring convention and
`docs/superpowers/specs/2026-06-05-cross-session-reminders-design.md` for the design.

- Active reminders: `*.md` in this directory (git-tracked).
- Resolved/dismissed: moved to `archive/` (git-tracked, never surfaced).
- `.state/`: per-project daily-throttle timestamps (gitignored, machine-local).

## Frontmatter

```yaml
name: <kebab-slug>
scope: global | project:<name>
due: 2026-06-09            # optional; omit = "next session in scope"
created: 2026-06-05
source_session: <id>
done_when: <completion condition>   # optional
status: active            # active | done
```
