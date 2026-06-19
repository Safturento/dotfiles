# Reminders store — MOVED

The live reminder store now lives in the Obsidian vault at `~/obsidian/AI/reminders/`.
`~/.claude/reminders` is a symlink into the vault, so the `reminder-checkin.mjs`
SessionStart hook still reads it transparently (it resolves symlinks via `realpathSync`).

See `docs/superpowers/specs/2026-06-18-obsidian-tracking-vault-design.md` for the
design and `docs/superpowers/plans/2026-06-18-obsidian-tracking-vault.md` for the
migration. The earlier file-store design is at
`docs/superpowers/specs/2026-06-05-cross-session-reminders-design.md`.

**Note:** reminders are no longer local-only — the vault is cloud-synced via Obsidian
Sync (E2E encrypted) so they reach the Windows client and mobile. Per-machine
filtering is handled by the optional `device:` frontmatter field (see the
"Reminders (cross-session)" section of `~/.claude/CLAUDE.md`).

This directory is retained only for git history; **do not add reminders here.**
