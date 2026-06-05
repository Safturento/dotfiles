# Project scaffolding

Read this **when creating a new repo**, or when wiring the agent-context doc system into an
existing repo that lacks it. For the executable path, use the **`establishing-a-new-project`**
skill — it stamps everything described here. This doc is the *why* and *what stays in sync*; the
skill is the *how*.

## The system

A new repo gets a two-tier, progressive-disclosure context system plus a human-facing front door:

- **`CLAUDE.md`** — a thin shim (`@AGENTS.md`). Claude Code auto-loads `CLAUDE.md`, not
  `AGENTS.md`; the shim pulls `AGENTS.md` into context at launch. Edit `AGENTS.md`, not the shim.
- **`AGENTS.md`** — the root index. A "what this is" description + a "When you need it" table
  pointing at on-demand topic docs. Repo-specific rules only; universal conventions stay in
  `~/.claude/conventions/`.
- **`.agents/<topic>.md`** — topic docs loaded on demand when work matches their row. Each
  declares `name` / `description` / `last_updated` / `covers` frontmatter. `.agents/README.md`
  documents the system itself and is exempt from the topic-doc frontmatter.
- **`README.md`** — the human-facing front door: intro/description, Installation, Usage. Distinct
  audience from `AGENTS.md` (humans, not agents).
- **`docs/`** — `followups.md` (deferred-work queue) and `superpowers/{specs,plans}/` (brainstorm
  + plan artifacts).

**Minimal at birth.** A fresh repo gets NO topic docs. Add the first `.agents/<topic>.md` only
when all three hold: (1) repo-specific (not a universal convention), (2) referenced by ≥2 places,
(3) has a clear `covers:` glob scope. See the scaffolded `.agents/README.md` for the full rules.

## Self-maintenance — how the docs stay in sync

This is **enforced parity + judgment-driven creation**, not a script that writes docs.

- **Creation is judgment.** Agents add topic docs when the three criteria above are met. No
  automation decides that.
- **Parity is enforced by three nets:**
  1. **Completion-time skills** — `agents-doc-parity-check` (any repo with `.agents/`; matches
     changed paths against each doc's `covers:` globs) and `readme-freshness-check` (any repo with
     a root `README.md`; maps change kinds to README sections). Both run before any "done" claim,
     additive to `superpowers:verification-before-completion`.
  2. **Global commit hook** — `~/.claude/hooks/doc-parity-gate.sh` (registered in
     `~/.claude/settings.json`). On `git commit` / `gh pr create` it warns (soft, non-blocking)
     when changed code overlaps a `covers:` glob without the doc being touched, or when
     `package.json` changed without `README.md`. No-ops in repos without `.agents/`/`README.md`,
     so it costs nothing where it doesn't apply.
  3. **Per-project validator (Node)** — `validate-agents-frontmatter.ts`, wired into the project's
     lint. A hard gate on malformed/mismatched frontmatter. Travels with the repo's own CI.

  Split logic: the **skills** carry portable enforcement (run wherever completion is claimed); the
  **hook** is a local-dev nudge that's free everywhere; the **validator** is the hard CI gate that
  travels with the repo.

## Composition — defer, don't duplicate

The scaffold pulls hygiene + scaffolding content from existing sources at scaffold time rather
than carrying its own copies:

- **`code-quality.md`** — the universal `.gitignore` baseline + git hygiene philosophy.
- **`line-endings.md`** — the `.gitattributes` LF template.
- **`node.md`** — Node-specific `.gitignore` additions (Node projects only).
- The global **`~/.claude/CLAUDE.md`** "Followup detection" section — the `docs/followups.md`
  scaffold.

If one of those evolves, the next scaffold reflects it automatically. Never inline stale snapshots.

## dotfiles home

These user-level artifacts (the skill, this convention, the global hook) are authored under
`~/dotfiles` and symlinked into `~/.claude` via `install.sh` — version-controlled from birth. New
user-level conventions/skills/hooks follow the same author-in-dotfiles-then-link pattern.
