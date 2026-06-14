---
name: establishing-a-new-project
description: Use when starting a brand-new project/repo and you want the standard agent-context + docs baseline — phrases like "set up a new project", "scaffold this repo", "bootstrap a new project", "establish project conventions". Probes the environment (git remote, Jira prefix, crew usage, stack) then stamps git init + hygiene (.gitattributes, .gitignore), the .agents/ + AGENTS.md + CLAUDE.md-shim doc system, a human-centered README.md, the docs/ structure (followups, superpowers/specs+plans), and a discovery-tailored .agents/workflow.md. Composes with existing ~/.claude conventions by reference. Stops short of language/build-stack choices beyond a minimal Node footprint. Do NOT use for an already-scaffolded repo.
---

# Establishing a New Project

## Overview

Bootstraps a brand-new repo with the standard agent-context + docs baseline. The skill **discovers** the project's context (a few quick probes + questions), then **stamps files** — copies bundled templates, lifts content from current convention files, and assembles a `.agents/workflow.md` tailored to the discovery answers. It runs `git init`.

It composes with `~/.claude/conventions/` **by reference** — convention files are read at scaffold time so the output always reflects the current canonical content, never a stale inline copy.

Stops short of language/build-stack decisions (no `tsconfig`, no CI, no lint config). The Node add-on (step 9) is the only stack exception and is gated on explicit Node intent.

---

## Step 1 — Preflight

Confirm the target directory with the user before touching anything.

If **both** `.git/` AND `AGENTS.md` already exist in the target directory, **STOP** and tell the user: "Already scaffolded — nothing to do." Do not proceed.

If only `.git/` exists (no `AGENTS.md`), continue — the repo exists but the doc system is absent.

---

## Step 2 — Discovery (auto-detect, then ask the gaps)

The scaffold is tailored by a handful of facts. **Auto-detect first, then ask the user only what you couldn't infer.** Every dimension is optional and skippable — a "no/none" answer just prunes the matching parts of the output.

| Dimension | Auto-detect by | If undetected, ask |
|-----------|----------------|--------------------|
| **Project name + description** | dir name; `package.json` `name`/`description` | "What's the project called, and a one-to-two sentence description?" |
| **Git remote / GitHub** | `git -C <dir> remote -v`; a configured `origin` | "Is there (or will there be) a GitHub remote? `main` protected?" |
| **Jira prefix** | nearby sibling repos' `.agents/workflow.md`; user phrasing ("we track work in JIRA under KEY") | "Does this project use Jira? What's the project key?" |
| **Crew usage** | a `.crew/` dir or crew config nearby; user phrasing ("run it through crew") | "Will this project be run through crew for autonomous dispatch?" |
| **Stack / language** | `package.json` → Node; other manifest files | "What language/build stack? (drives `.gitignore` and the Node add-on)" |

**If Jira is in play, confirm the board convention.** The default is a kanban board with five columns — **Backlog → Ready for Development → In Progress → In Review → Done** — where a ticket's column is its planning/execution state (Backlog = parked/not-yet-planned, promote to Ready for Development once a spec + plan exist). Show the user these defaults and ask: "Good as-is, or does this project need different columns/semantics?" Record the confirmed column set — step 7 stamps it into the board section and step 8 sanity-checks the live Jira project against it.

Then ask one open question: **"Any other workflow section you want in `.agents/workflow.md`?"** (CI conventions, release process, env setup, etc.) Capture the answer for the `IF:OTHER` block in step 7.

Record the answers — steps 4, 7, 8, and 9 consume them. **Crew usage almost always implies Jira**; if the user says crew-yes / Jira-unstated, confirm the Jira key rather than assuming none.

---

## Step 3 — git init

If the target directory is not already a git repo, run:

```bash
git init <target-dir>
```

---

## Step 4 — Hygiene (compose-by-reference)

**READ `~/.claude/conventions/line-endings.md`** and write the `.gitattributes` template from its "Part 1" section into the repo root. The load-bearing lines are `* text=auto eol=lf` and the explicit `*.sh eol=lf` rule; include the full template from the convention file.

**READ `~/.claude/conventions/code-quality.md`** and write the universal `.gitignore` baseline from its "Git hygiene baseline → `.gitignore`" section. After writing that content, **append** one extra line:

```gitignore
# WSL download metadata
*:Zone.Identifier
```

**If discovery flagged crew:** also append `.planning-worktrees/` (the worktree-per-planning-session path is gitignored).

**If discovery flagged Node** (either `package.json` exists or the user declared it): also **READ `~/.claude/conventions/node.md`** and append the `.gitignore` additions from its "`.gitignore` additions for Node" section.

**Critical:** Never inline a stale snapshot of these patterns. Always lift the current content from the convention files at scaffold time. The conventions evolve; the scaffold must reflect today's version.

---

## Step 5 — Doc system

Copy the four bundled templates (paths relative to this skill's own directory):

| Source | Destination |
|--------|-------------|
| `templates/CLAUDE.md` | `<project>/CLAUDE.md` |
| `templates/AGENTS-root.md` | `<project>/AGENTS.md` |
| `templates/agents-README.md` | `<project>/.agents/README.md` |
| `templates/README.md` | `<project>/README.md` |

Then **fill placeholders** using the discovery answers:

- In `AGENTS.md`: replace every `<PROJECT>` with the real project name; replace the `<one-paragraph description…>` block with the user's description. Leave the workflow row in the "When you need it" table — step 7 stamps the doc it points at.
- In `README.md`: replace `<PROJECT>` with the project name; replace the `<one-to-two sentence description…>` block with the user's description. Leave the `## Installation`, `## Usage`, `## Development`, and `## License` section bodies as stubs.
- **Do not** stuff Jira/crew/remote facts into the AGENTS.md "What this is" paragraph — those belong in `workflow.md` (step 7). The paragraph describes *what the project is*, not how work flows through it.
- Verify no raw `<PROJECT>` or `<...>` placeholders remain.

---

## Step 6 — docs/ tree

Create `docs/followups.md` by lifting the **followups scaffold** from the "Followup detection" section of the user's global `~/.claude/CLAUDE.md` — specifically the "File scaffold" block (starts with `# Followups`, contains `## Contents`, `## Active`, `## Resolved`, `## Abandoned`).

Then create the placeholder dirs:

```bash
mkdir -p <project>/docs/superpowers/specs
mkdir -p <project>/docs/superpowers/plans
touch <project>/docs/superpowers/specs/.gitkeep
touch <project>/docs/superpowers/plans/.gitkeep
```

**If discovery flagged Jira:** also create `mkdir -p <project>/docs/tickets` and `touch <project>/docs/tickets/.gitkeep` (workflow.md's taxonomy will point ticket work logs here).

---

## Step 7 — Stamp `.agents/workflow.md` (discovery-tailored)

`workflow.md` is the **one near-universal topic doc** — a repo-specific overlay that names this project's instances of the user-level planning/followup/branching rules. Always stamp it (even a no-Jira/no-crew project benefits from the taxonomy + branching + followups pointer).

1. Copy `templates/workflow.md` → `<project>/.agents/workflow.md`.
2. **Prune by discovery answers.** The template ships with every conditional section wrapped in markers (`IF:JIRA`, `IF:CREW`, `IF:REMOTE`, `IF:OTHER`). Read the assembly-notes comment at the top of the template, then for each block:
   - Condition **holds** → delete only the marker lines, keep the content.
   - Condition **fails** → delete the markers **and** the content between them.
3. **Fill** `<PROJECT>`, `<KEY>` (Jira key), `<DATE>` (today, ISO), and the `IF:OTHER` section if the user requested one. If Jira is kept, the template's "Board + planning statuses" section ships the default five-column board — **edit it to match whatever columns/semantics the user confirmed in step 2** (rename/add/drop rows and fix the column references in the crew block + the "what's queued" JQL).
4. **Prune frontmatter** to match: if no Jira, drop `docs/tickets/**` from `covers:` and reword `description:` to omit tickets.
5. Delete the assembly-notes comment block.
6. **Verify** no `<!-- IF:`, no raw `<PROJECT>`/`<KEY>`/`<DATE>`, and no orphaned `<...>` remain:
   ```bash
   grep -nE '<!-- /?IF:|<PROJECT>|<KEY>|<DATE>' <project>/.agents/workflow.md
   ```
   (Empty output = clean. `<topic>`/`<n>`/`<scope>` are intentional literals in the doc — leave them.)

`workflow.md` is already registered in the bundled AGENTS.md "When you need it" table and the `.agents/README.md` index — no extra wiring needed.

---

## Step 8 — Jira board sanity check (conditional)

**Only if discovery flagged Jira.** Reconcile the live Jira project against the board convention you just stamped into `workflow.md` — the doc shouldn't promise a workflow the project can't actually perform.

1. **If the Jira project already exists**, enumerate its real statuses (via your Jira MCP — `jira_get_transitions` on any issue in the project, or the project's workflow/status metadata) and compare against the confirmed columns (default: Backlog, Ready for Development, In Progress, In Review, Done).
2. **Report mismatches** to the user: missing columns (e.g. no `Backlog`), extras, or differently-named statuses. Call out `Backlog` specifically — it's frequently a *custom* status a stock Jira workflow lacks, and the parking convention depends on it.
3. **If the project doesn't exist yet** (or you can't reach it), output the target column list and tell the user to create the board with those columns before the convention takes effect. The skill does **not** create or reconfigure Jira projects/boards — that's the user's to do.
4. **Don't silently "fix" `workflow.md` to match a misconfigured board.** The doc records the *intended* convention; surface the gap and let the user decide whether to fix the board or amend the doc.

If discovery did not flag Jira, skip this step entirely.

---

## Step 9 — Node add-on (conditional)

**Only execute if discovery flagged Node** (`package.json` exists OR the user declared the project Node).

1. If **no `package.json` exists yet**, create a minimal one so the validator and its script have a home — name, `"private": true`, `"type": "module"`, and an empty `scripts` block. Keep it minimal; do **not** add a tsconfig, eslint, or pin a runtime — that's the user's stack choice.
2. Copy the validator scripts from this skill's bundled templates:
   - `templates/validate-agents-frontmatter.ts` → `scripts/validate-agents-frontmatter.ts`
   - `templates/validate-agents-frontmatter.test.ts` → `scripts/validate-agents-frontmatter.test.ts`
3. In `package.json`, add an `agents:validate` script to the lint/CI pipeline (alongside `lint` if present, else standalone).
4. Tell the user to install the dev deps if missing — do **not** run `npm install` yourself:
   ```
   npm i -D tsx glob js-yaml micromatch vitest @types/js-yaml
   ```

If discovery did not flag Node, skip this step entirely.

---

## Step 10 — Minimal-at-birth rule

Beyond `workflow.md` (step 7), create **no** `.agents/<topic>.md` topic docs. After scaffolding, `.agents/` contains only `README.md` and `workflow.md`.

`workflow.md` is the deliberate exception because it is near-universal — every planning-driven repo has the same overlay, only the instances differ. Language/framework docs (architecture, testing, design-system, etc.) are **not** stamped; they earn their place later when all three criteria hold:

1. **Repo-specific** — universal coding/Node/git conventions belong in `~/.claude/conventions/`, not here.
2. **Referenced by ≥2 places** — one AGENTS.md row or one PR-review mention isn't enough.
3. **Has a clear `covers:` scope** — you can name path globs.

Point the user to `.agents/README.md` for the full system description.

---

## Step 11 — Closing guidance

Tell the user that the following now apply to this repo automatically:

- **`agents-doc-parity-check`** — run before claiming any task complete or opening a PR (`.agents/workflow.md` already carries `covers:` frontmatter, so this is live from day one).
- **`readme-freshness-check`** — run before PRs since a root `README.md` is present.
- **Global `doc-parity-gate` hook** — warns on commit/PR if a `.agents/<topic>.md`'s `covers:` overlaps a changed path without the doc being touched.

These are additive to `superpowers:verification-before-completion`, not replacements.

If discovery surfaced a GitHub remote that doesn't exist yet, remind the user it's theirs to create + wire (`git remote add origin …`) — the skill does not create remotes or push.

---

## Quick reference — output file tree

```
<project>/
├── .git/
├── .gitattributes          ← from line-endings.md (lifted at scaffold time)
├── .gitignore              ← from code-quality.md + WSL line + optional crew/Node additions
├── CLAUDE.md               ← thin shim: @AGENTS.md
├── AGENTS.md               ← root doc system entry point (placeholders filled)
├── README.md               ← human-centered (placeholders filled)
├── .agents/
│   ├── README.md           ← system self-description
│   └── workflow.md         ← discovery-tailored planning/branching overlay
└── docs/
    ├── followups.md        ← scaffold from ~/.claude/CLAUDE.md
    ├── tickets/.gitkeep    ← only if Jira
    └── superpowers/
        ├── specs/.gitkeep
        └── plans/.gitkeep
```

(Plus `scripts/validate-agents-frontmatter.*` + a minimal `package.json` only if Node.)

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Skipping discovery and scaffolding blind | Step 2: auto-detect, then ask the gaps. Jira/crew/remote/stack tailor the output |
| Jamming Jira/crew/remote facts into AGENTS.md "What this is" | Those are workflow facts — they live in `.agents/workflow.md` (step 7) |
| Not stamping `workflow.md` (treating it like a language-specific doc) | `workflow.md` is the universal exception to minimal-at-birth — always stamp it |
| Leaving `IF:` markers or `<KEY>`/`<PROJECT>` in workflow.md | Run the step-7 grep; empty output = clean |
| Inlining `.gitattributes` / `.gitignore` from memory | Always READ the convention files at scaffold time |
| Leaving `<PROJECT>` in `AGENTS.md` or `README.md` | Verify with `grep -r '<PROJECT>' <target>` after step 5 |
| Stamping language/framework topic docs at birth | Minimal-at-birth: only `README.md` + `workflow.md` in `.agents/` |
| Establishing Jira board conventions without checking the live project | Step 8: reconcile the real Jira statuses against the stamped board; surface mismatches (esp. a missing `Backlog`) |
| Running the Node add-on for non-Node projects | Step 9 is gated on discovery flagging Node |
| Node declared but no `package.json` | Step 9.1: create a minimal one so the validator + script have a home |
| Scaffolding over an already-scaffolded repo | Preflight: stop if both `.git/` AND `AGENTS.md` exist |
```
