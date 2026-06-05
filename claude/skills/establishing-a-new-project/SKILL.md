---
name: establishing-a-new-project
description: Use when starting a brand-new project/repo and you want the standard agent-context + docs baseline — phrases like "set up a new project", "scaffold this repo", "bootstrap a new project", "establish project conventions". Stamps git init + hygiene baseline (.gitattributes, .gitignore), the .agents/ + AGENTS.md + CLAUDE.md-shim doc system, a human-centered README.md, and the docs/ structure (followups, superpowers/specs+plans). Composes with existing ~/.claude conventions by reference. Stops short of language/build-stack choices. Do NOT use for an already-scaffolded repo.
---

# Establishing a New Project

## Overview

Bootstraps a brand-new repo with the standard agent-context + docs baseline. The skill **stamps files** (copies bundled templates, lifts content from current convention files) and runs `git init`. It composes with `~/.claude/conventions/` **by reference** — convention files are read at scaffold time so the output always reflects the current canonical content, never a stale inline copy.

Stops short of language/build-stack decisions (no `package.json`, no `tsconfig`, no CI). The Node add-on in step 6 is the only exception and is gated on explicit Node intent.

---

## Preflight (Step 1)

Confirm the target directory with the user before touching anything.

If **both** `.git/` AND `AGENTS.md` already exist in the target directory, **STOP** and tell the user: "Already scaffolded — nothing to do." Do not proceed.

If only `.git/` exists (no `AGENTS.md`), continue — the repo exists but the doc system is absent.

---

## Step 2 — git init

If the target directory is not already a git repo, run:

```bash
git init <target-dir>
```

---

## Step 3 — Hygiene (compose-by-reference)

**READ `~/.claude/conventions/line-endings.md`** and write the `.gitattributes` template from its "Part 1" section into the repo root. The load-bearing lines are `* text=auto eol=lf` and the explicit `*.sh eol=lf` rule; include the full template from the convention file.

**READ `~/.claude/conventions/code-quality.md`** and write the universal `.gitignore` baseline from its "Git hygiene baseline → `.gitignore`" section. After writing that content, **append** one extra line:

```gitignore
# WSL download metadata
*:Zone.Identifier
```

**If the project is Node** (either `package.json` exists or the user declared it as Node): also **READ `~/.claude/conventions/node.md`** and append the `.gitignore` additions from its "`.gitignore` additions for Node" section.

**Critical:** Never inline a stale snapshot of these patterns. Always lift the current content from the convention files at scaffold time. The conventions evolve; the scaffold must reflect today's version.

---

## Step 4 — Doc system

Copy the four bundled templates (paths relative to this skill's own directory):

| Source | Destination |
|--------|-------------|
| `templates/CLAUDE.md` | `<project>/CLAUDE.md` |
| `templates/AGENTS-root.md` | `<project>/AGENTS.md` |
| `templates/agents-README.md` | `<project>/.agents/README.md` |
| `templates/README.md` | `<project>/README.md` |

Then **fill placeholders**:

- Gather the project name and a one-to-two sentence description from the user (ask if not already stated).
- In `AGENTS.md`: replace every `<PROJECT>` with the real project name; replace the `<one-paragraph description…>` block with the user's description.
- In `README.md`: replace `<PROJECT>` with the project name; replace the `<one-to-two sentence description…>` block with the user's description. Leave the `## Installation`, `## Usage`, `## Development`, and `## License` section bodies as stubs — those are for the user to fill.
- Verify no raw `<PROJECT>` or `<...>` placeholders remain after substitution.

---

## Step 5 — docs/ tree

Create `docs/followups.md` by lifting the **followups scaffold** from the "Followup detection" section of the user's global `~/.claude/CLAUDE.md` — specifically the "File scaffold" block. The scaffold starts with `# Followups` and contains the `## Contents`, `## Active`, `## Resolved`, and `## Abandoned` sections.

Then create the empty placeholder files:

```bash
mkdir -p <project>/docs/superpowers/specs
mkdir -p <project>/docs/superpowers/plans
touch <project>/docs/superpowers/specs/.gitkeep
touch <project>/docs/superpowers/plans/.gitkeep
```

---

## Step 6 — Node add-on (conditional)

**Only execute this step if `package.json` already exists in the target OR the user explicitly declares the project is Node.**

1. Copy the validator scripts from this skill's bundled templates into the project:
   - `templates/validate-agents-frontmatter.ts` → `scripts/validate-agents-frontmatter.ts`
   - `templates/validate-agents-frontmatter.test.ts` → `scripts/validate-agents-frontmatter.test.ts`
2. In `package.json`, add an `agents:validate` script to the lint/CI pipeline (suggested: add alongside the existing `lint` script or as a standalone entry).
3. Tell the user to install the required dev dependencies if missing:
   ```
   npm i -D glob js-yaml micromatch vitest @types/js-yaml
   ```

If the project has no `package.json` and the user has not declared it as Node, skip this step entirely.

---

## Step 7 — Minimal-at-birth rule

Create **no** `.agents/<topic>.md` topic docs. The `.agents/` directory contains only `README.md` after scaffolding.

When the user asks when to add the first topic doc, state the three criteria (all must be true):

1. **Repo-specific** — universal coding/Node/git conventions belong in `~/.claude/conventions/`, not here.
2. **Referenced by ≥2 places** — one AGENTS.md row or one PR-review mention isn't enough; that's inline-doc material.
3. **Has a clear `covers:` scope** — you can name path globs.

Point the user to `.agents/README.md` for the full system description.

---

## Step 8 — Closing guidance

Tell the user that the following skills and hooks now apply to this repo automatically:

- **`agents-doc-parity-check`** — run before claiming any task complete or opening a PR if `.agents/<topic>.md` docs exist with `covers:` frontmatter.
- **`readme-freshness-check`** — run before PRs since a root `README.md` is now present.
- **Global `doc-parity-gate` hook** — walks the diff on commit/PR and warns if a `.agents/<topic>.md`'s `covers:` overlaps a changed path without the doc being touched.

These are additive to `superpowers:verification-before-completion`, not replacements for it.

---

## Quick reference — output file tree

```
<project>/
├── .git/
├── .gitattributes          ← from line-endings.md (lifted at scaffold time)
├── .gitignore              ← from code-quality.md + WSL line + optional Node additions
├── CLAUDE.md               ← thin shim: @AGENTS.md
├── AGENTS.md               ← root doc system entry point (placeholders filled)
├── README.md               ← human-centered (placeholders filled)
├── .agents/
│   └── README.md           ← system self-description (no topic docs yet)
└── docs/
    ├── followups.md        ← scaffold from ~/.claude/CLAUDE.md
    └── superpowers/
        ├── specs/.gitkeep
        └── plans/.gitkeep
```

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Inlining `.gitattributes` / `.gitignore` content from memory | Always READ the convention files at scaffold time |
| Leaving `<PROJECT>` in `AGENTS.md` or `README.md` | Verify with `grep -r '<PROJECT>' <target>` after step 4 |
| Creating `.agents/<topic>.md` files at scaffold time | Minimal-at-birth: only `README.md` goes in `.agents/` |
| Running the Node add-on for non-Node projects | Step 6 is gated — `package.json` present OR explicit user declaration |
| Scaffolding over an already-scaffolded repo | Preflight check: stop if both `.git/` AND `AGENTS.md` exist |
