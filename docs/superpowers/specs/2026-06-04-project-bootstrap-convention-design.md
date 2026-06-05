# Project-Bootstrap Convention — Design Spec

**Date:** 2026-06-04
**Status:** Approved (brainstorming complete; pending implementation plan)
**Author:** brainstorming session (safturento + Claude)

## 1. Purpose

Establish a reusable, self-maintaining convention for "establishing a new project" — a single
trigger that scaffolds any new repo with the agent-context doc system (`.agents/` + `AGENTS.md` +
thin `CLAUDE.md` shim), a human-centered `README.md`, git hygiene, and a `docs/` structure, where
the resulting docs stay in sync with the code **automatically** as work happens.

This generalizes the mature `.agents/` system currently living only inside the `crew` repo, so
every future project starts from the same well-worn basis instead of re-deriving it.

**Skadimetric is the first consumer and the proving ground.** We develop the convention by
applying it to skadimetric, then extract anything skadimetric-specific back out.

## 2. Background & context

- **crew** has a mature two-tier progressive-disclosure system for agent context: a thin
  `CLAUDE.md` shim (`@AGENTS.md` import) → root `AGENTS.md` with a "When you need it" index →
  on-demand `.agents/<topic>.md` topic docs carrying `name` / `description` / `last_updated` /
  `covers` frontmatter. See `~/Repos/crew/.agents/README.md` — already written generically (it
  describes the *system*, not crew internals), so it is a strong template basis.
- **Self-maintenance already half-exists and is already generalized:** the
  `agents-doc-parity-check` skill lives at `~/.claude/skills/` (user-level) and works in any repo
  with a `.agents/` directory today. It is the completion-time audit that catches doc drift.
- **Still crew-local:** the commit-time parity hook (`doc-parity-gate.sh`, wired in crew's
  `.claude/settings.json`) and the `validate-agents-frontmatter.ts` validator (wired into crew's
  `npm run lint`). These are what a fresh repo does *not* inherit automatically.
- **Hygiene baselines already exist** in `~/.claude/conventions/`: `code-quality.md` (the
  universal `.gitignore` block + git hygiene), `line-endings.md` (the `.gitattributes` LF
  template), `node.md` (Node-specific ignores). The scaffold composes with these **by reference**,
  never duplicating them.
- **dotfiles is the version-control home.** `~/dotfiles` is a git repo (origin
  `github.com/Safturento/dotfiles`) with a custom idempotent `install.sh` (`link <src> <dst>`
  helper: backs up an existing non-symlink to `.bak`, then `ln -s`). Today it only links
  `claude/themes/`. The live `~/.claude/{conventions,skills,CLAUDE.md,settings.json}` are real
  files, **not yet symlinks** — the migration mechanism is staged but the content has not moved.

## 3. Goals / non-goals

### Goals
- One reusable skill that fully bootstraps a new repo.
- The agent-context doc system generalized out of crew.
- Human-centered `README.md` kept fresh automatically (it has been observed drifting).
- All new artifacts version-controlled from birth (authored in `~/dotfiles`, symlinked in).
- Compose with existing conventions by reference; zero duplication.

### Non-goals (this sub-project)
- Migrating *existing* `~/.claude` content (other conventions, global `CLAUDE.md`, other skills,
  settings) into dotfiles — see §9.
- Settling the dotfiles `claude/` vs `.claude/` directory inconsistency — see §9.
- Choosing or scaffolding any language/build stack (Vite, React, etc.) — that is per-project and
  belongs to the consumer project's own work (for skadimetric, sub-project 3, the web app build).
- Building a non-Node validator path — documented as "validator optional / Node-flavored," not
  built (YAGNI; all near-term projects are Node).

## 4. Deliverables and where they live

All authored under `~/dotfiles`, symlinked into `~/.claude` via new `link` lines in `install.sh`.

| Artifact | Source path (dotfiles) | Symlink target |
|---|---|---|
| Scaffolding skill | `claude/skills/establishing-a-new-project/SKILL.md` (+ `templates/`) | `~/.claude/skills/establishing-a-new-project/` |
| Convention doc | `claude/conventions/project-scaffolding.md` | `~/.claude/conventions/project-scaffolding.md` |
| Global parity hook | `claude/hooks/doc-parity-gate.sh` | `~/.claude/hooks/doc-parity-gate.sh` |
| README-freshness skill (sibling) | `claude/skills/readme-freshness-check/SKILL.md` | `~/.claude/skills/readme-freshness-check/` |

Plus:
- `~/.claude/settings.json` — add the PreToolUse entry invoking the global hook.
- Global `CLAUDE.md` conventions library list — add one line pointing at `project-scaffolding.md`.

> **Workflow note.** These deliverables live under `~/.claude` / `~/dotfiles`, which cannot run
> through the `crew run` autonomous flow (the hardcoded sensitive-file check blocks writes there).
> Per the user-level "Don't ticket — handle manually" rule, this sub-project is authored directly
> in chat and committed by hand to `~/dotfiles` — **no Jira ticket.** (Sub-project 3, the
> skadimetric web app, *will* need a skadimetric Jira project + Epic.)

## 5. The baseline scaffold (what a fresh repo gets)

Deliberately minimal — topic docs are *earned*, not stamped at birth.

```
<repo>/
├── .gitattributes            # LF baseline (from line-endings.md template)
├── .gitignore                # universal baseline (code-quality.md) + WSL *:Zone.Identifier
│                             #   (+ node.md additions when Node)
├── CLAUDE.md                 # thin shim: @AGENTS.md
├── AGENTS.md                 # root index: empty "When you need it" table +
│                             #   "before claiming complete" parity note
├── README.md                 # human-centered: title/description, Installation, Usage,
│                             #   project-appropriate extras (Development, License)
├── .agents/
│   └── README.md             # the system's self-description (generalized from crew)
└── docs/
    ├── followups.md          # the existing followups scaffold
    └── superpowers/
        ├── specs/.gitkeep
        └── plans/.gitkeep
```

Plus `git init` if the directory is not already a repo.

**Node projects additionally get:** `validate-agents-frontmatter.ts` (+ its test) generalized
from crew, wired into `npm run lint`. This is the only language-flavored piece; the markdown core
is language-agnostic.

**Minimal-at-birth rationale:** no topic docs, no per-package `AGENTS.md`, no validator beyond the
Node case, until the project grows into needing them. A topic doc is added only when it meets the
three criteria from the `.agents/README.md`: repo-specific, referenced by ≥2 places, and has a
clear `covers:` glob scope.

## 6. Self-maintenance model ("grows correctly")

Honest framing: this is **enforced parity + judgment-driven creation**, not a script that writes
docs.

1. **Creation pressure (judgment).** The convention doc + `.agents/README.md` instruct any agent
   to add a `.agents/<topic>.md` when work crosses the three criteria. A script cannot decide a
   topic is durable and repo-specific; this stays human/agent judgment.

2. **Parity pressure (enforced, three nets).**
   - **Completion** — `agents-doc-parity-check` skill (already user-level; fires before any "done"
     claim in any repo with `.agents/`; inert otherwise).
   - **Commit** — the new **global** hook (`doc-parity-gate.sh` in `~/.claude/`, registered in
     `~/.claude/settings.json`). Walks the diff and warns if a commit touches a `covers:` path
     without touching the doc. **No-ops unless the cwd repo has a `.agents/` directory**, so it is
     free to run everywhere — new repos need zero hook wiring.
   - **CI** — the per-project `validate-agents-frontmatter.ts` validator (Node), wired into
     `npm run lint`. Hard-fails on malformed or mismatched frontmatter. Travels with the repo.

   Split rationale: the **skill** carries the portable/dispatch/CI-adjacent enforcement (it runs
   wherever completion is claimed, including crew dispatches); the **hook** is a local-dev
   convenience nudge that, being global, covers every local repo automatically; the **validator**
   is the hard gate that must travel with the repo's own CI.

### 6.1 README freshness

README has no `covers:` globs (it is human-facing markdown; embedding agent frontmatter would be
ugly). Instead it is maintained via a **defined trigger set** that maps README sections to the
kinds of change that invalidate them:

| README section | Stays in sync with |
|---|---|
| Description / intro | project purpose / scope |
| Installation | setup steps, dependencies, top-level scripts |
| Usage | user-facing commands / API / entrypoints |

Enforcement reuses the parity *pattern*:
- **Completion-time pass** via a **sibling skill** `readme-freshness-check` (kept separate from
  `agents-doc-parity-check` because README upkeep must apply to *any* repo with a root `README.md`,
  not only repos with a `.agents/` directory — the existing skill is deliberately inert without
  `.agents/`).
- **Commit nudge** folded into the global hook: when a commit touches a trigger-set path, warn if
  `README.md` is untouched.

The exact wiring (whether the README nudge is a second function in the same hook script or a
sibling hook; the precise trigger globs) is finalized during writing-plans, using
`superpowers:writing-skills` for the skill authoring.

## 7. Implementation approach notes

- **Skills are authored with `superpowers:writing-skills`** — both the new scaffolding skill and
  the README-freshness skill. Non-negotiable for this sub-project.
- **Generalize, do not reinvent.** Start from crew's `.agents/README.md`,
  `validate-agents-frontmatter.ts` (+ test), and `doc-parity-gate.sh`; strip crew specifics; keep
  the generic system.
- **Compose by reference.** The scaffold's `.gitignore` / `.gitattributes` come from the existing
  conventions; the skill cites `code-quality.md`, `line-endings.md`, `node.md` rather than
  inlining their content.
- **install.sh wiring.** Append `link` lines for each new artifact; the helper is idempotent and
  backs up any pre-existing real file to `.bak`. Run `install.sh` to materialize symlinks.

## 8. Skadimetric application (proving ground)

Done inline in the same pass as developing the convention:

- `git init` (skadimetric is not yet a git repo).
- Stamp the §5 baseline.
- Move `skadis-drawer-system-project.md` → `docs/DESIGN.md` (the living spec, as the brief itself
  recommends). Keep `fusion360-cheat-sheet.md`. Gitignore the WSL `*:Zone.Identifier` cruft.
- Write skadimetric's `AGENTS.md` framing the project as a **Skadis platform**: the backing panel
  is the generalized foundation; **drawers are the first product, not the definition of the
  project.** This bakes the long-term-scope caveat in at the doc level so future agents do not
  over-couple to drawers.
- **First topic doc deferred** until code exists. Earmark: `.agents/parameter-model.md` capturing
  the DESIGN.md §5 authoritative-names / Fusion↔code sync rule (textbook repo-specific,
  two-track-referenced, with a clear `covers:` scope once the geometry modules land).

## 9. Deferred / future sub-projects

Recorded so they are not lost; each warrants its own brainstorm later.

1. **Broader `~/.claude` → dotfiles migration.** Move existing content (the 8 conventions, the
   ~16k-line global `CLAUDE.md`, the ~9 user-level skills, `settings.json`) under version control
   via the same link pattern this sub-project establishes. Substantial; its own spec.
2. **Settle dotfiles `claude/` vs `.claude/` inconsistency.** dotfiles currently has both
   (`claude/themes/`, `.claude/settings.local.json`). The migration above should pick one
   convention.
3. **Skadimetric Fusion MCP integration** (sub-project 2 from the original decomposition):
   evaluate the candidate Fusion 360 MCP servers, select one, wire it into MCP config, document
   usage in skadimetric's `.agents/`. Independent; can run in parallel.
4. **Skadimetric web app build** (sub-project 3): the DESIGN.md §6.5 milestone (Vite + three.js +
   Manifold pipeline → BP → BP-grid). Needs the scaffold from this sub-project; benefits from #3.

## 10. Open questions

None blocking. The README-freshness wiring details (§6.1) are intentionally left to the
implementation-plan stage where `writing-skills` guides the skill structure.
