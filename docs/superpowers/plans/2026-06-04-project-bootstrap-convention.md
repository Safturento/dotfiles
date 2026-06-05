# Project-Bootstrap Convention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill-authoring note:** Tasks that create or edit a SKILL.md MUST be done with `superpowers:writing-skills` driving the prose. This plan provides each skill's exact frontmatter, required behaviors, bundled templates, and acceptance criteria — writing-skills shapes the SKILL.md body from those requirements.
>
> **Execution context:** All deliverables live under `~/dotfiles` (committed) and are symlinked into `~/.claude`. This is the user-level "handle manually" path — it does NOT go through `crew run` (Claude Code's sensitive-file check blocks writes to `~/.claude/**`). Author in `~/dotfiles`, then run `install.sh` to materialize symlinks. Work on the `project-bootstrap-convention` branch (already created).

**Goal:** Ship a reusable, self-maintaining "establishing a new project" convention — a scaffolding skill + convention doc + global parity hook + README-freshness skill — generalized from crew's `.agents/` system, and prove it by bootstrapping skadimetric.

**Architecture:** Markdown-core doc system (`.agents/` + `AGENTS.md` + thin `CLAUDE.md` shim + human `README.md`) stamped by a user-level skill; doc freshness enforced by three nets (completion-time skills, a global commit-nudge hook that no-ops without `.agents/`, and a per-project Node validator). All artifacts born in `~/dotfiles`, symlinked via `install.sh`.

**Tech Stack:** Markdown, Bash (hook), TypeScript + vitest (validator template, Node consumers only), Claude Code skills/hooks/settings.

---

## File structure (created/modified)

**In `~/dotfiles` (new, version-controlled):**
- `claude/hooks/doc-parity-gate.sh` — global commit/PR parity + README nudge hook
- `claude/skills/establishing-a-new-project/SKILL.md` — the scaffolder
- `claude/skills/establishing-a-new-project/templates/` — stamped artifacts:
  - `agents-README.md`, `AGENTS-root.md`, `CLAUDE.md`, `README.md`,
  - `validate-agents-frontmatter.ts`, `validate-agents-frontmatter.test.ts`
- `claude/skills/readme-freshness-check/SKILL.md` — completion-time README pass
- `claude/conventions/project-scaffolding.md` — the convention doc
- `install.sh` — append `link` lines (MODIFY)

**In `~/.claude` (live, edited directly — not via dotfiles symlink):**
- `settings.json` — add PreToolUse entry for the global hook (MODIFY)
- `CLAUDE.md` — add one line to the conventions library list (MODIFY)

**In `~/Repos/skadimetric` (proving ground):**
- `git init`; `.gitattributes`, `.gitignore`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `.agents/README.md`, `docs/` tree, `docs/DESIGN.md` (moved from `skadis-drawer-system-project.md`)

**Compose-by-reference (NOT duplicated):** `.gitattributes` content comes from `~/.claude/conventions/line-endings.md`; `.gitignore` base from `code-quality.md` (+ `node.md` for Node); the `docs/followups.md` scaffold from the global `CLAUDE.md`. The scaffolding skill instructs the running agent to lift current content from those sources at scaffold time, keeping them the single source of truth.

---

## Phase A — Parity machinery (hook + validator template)

### Task A1: Global doc-parity hook

Generalizes crew's `packages/cli/scripts/hooks/doc-parity-gate.sh`. Changes from crew's version: neutral override env var (`DOC_PARITY_OVERRIDE`), generic default-branch detection (main→master), and a README nudge that runs even in repos without `.agents/`.

**Files:**
- Create: `~/dotfiles/claude/hooks/doc-parity-gate.sh`
- Test fixtures: created in `/tmp` during steps (not committed)

- [ ] **Step 1: Write the hook script**

Create `~/dotfiles/claude/hooks/doc-parity-gate.sh`:

```bash
#!/usr/bin/env bash
#
# Global PreToolUse hook for `gh pr create` and `git commit`. Two soft checks:
#   1. .agents/ parity — warn when changed code matches a topic doc's `covers:`
#      globs but the doc itself was not part of the diff. (No-op without .agents/.)
#   2. README freshness — warn when package.json changed but README.md did not.
#
# Soft gate: exit 1 (warn, non-blocking) on a violation, never exit 2 (block).
# Override with DOC_PARITY_OVERRIDE=1 after stating a reason.
#
# Stdin: Claude Code PreToolUse payload
#   { "cwd": "...", "tool_name": "Bash", "tool_input": { "command": "..." } }

set -euo pipefail

input=$(cat)

command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
case "$command" in
  "gh pr create"*) : ;;
  "git commit"*) : ;;
  *) exit 0 ;;
esac

cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
[[ -z "$cwd" || ! -d "$cwd/.git" ]] && exit 0
cd "$cwd"

# Determine changed files for the active operation.
case "$command" in
  "gh pr create"*)
    base=$(git merge-base HEAD main 2>/dev/null \
        || git merge-base HEAD origin/main 2>/dev/null \
        || git merge-base HEAD master 2>/dev/null \
        || git merge-base HEAD origin/master 2>/dev/null \
        || true)
    if [[ -z "$base" ]]; then
      echo "doc-parity-gate: cannot determine merge base — skipping" >&2
      exit 0
    fi
    changed=$(git diff --name-only "$base" HEAD)
    ;;
  "git commit"*)
    changed=$(git diff --cached --name-only)
    ;;
esac

[[ -z "$changed" ]] && exit 0

shopt -s extglob globstar
violations=""

# --- Check 1: .agents/ parity (only if topic docs exist) ---
if [[ -d "$cwd/.agents" ]]; then
  for doc in .agents/*.md; do
    [[ -e "$doc" ]] || continue
    [[ "$doc" == ".agents/README.md" ]] && continue

    covers=$(awk '
      /^---$/ { fm++; next }
      fm == 1 && /^covers:[[:space:]]*$/ { in_covers = 1; next }
      in_covers && /^[[:space:]]+-[[:space:]]/ {
        line = $0
        sub(/^[[:space:]]+-[[:space:]]*/, "", line)
        gsub(/[\042\047]/, "", line)
        sub(/[[:space:]]+$/, "", line)
        print line
        next
      }
      in_covers && /^[^[:space:]]/ { in_covers = 0 }
      fm == 2 { exit }
    ' "$doc")
    [[ -z "$covers" ]] && continue

    doc_overlaps=false
    while IFS= read -r pattern; do
      [[ -z "$pattern" ]] && continue
      while IFS= read -r changed_file; do
        [[ -z "$changed_file" ]] && continue
        if [[ "$changed_file" == $pattern ]]; then
          doc_overlaps=true
          break 2
        fi
      done <<< "$changed"
    done <<< "$covers"

    if [[ "$doc_overlaps" == true ]] && ! printf '%s\n' "$changed" | grep -Fxq "$doc"; then
      violations="$violations $doc"
    fi
  done
fi

# --- Check 2: README freshness (universal signal: package.json changed) ---
readme_nudge=false
if [[ -f "$cwd/README.md" ]] \
   && printf '%s\n' "$changed" | grep -Fxq "package.json" \
   && ! printf '%s\n' "$changed" | grep -Fxq "README.md"; then
  readme_nudge=true
fi

if [[ -z "$violations" && "$readme_nudge" == false ]]; then
  exit 0
fi

{
  if [[ -n "$violations" ]]; then
    echo "doc-parity-gate: warning — these .agents/ docs cover changed code but were not updated:"
    for v in $violations; do echo "  - $v"; done
    echo "Review each: update it (and bump last_updated), or confirm it's still current."
  fi
  if [[ "$readme_nudge" == true ]]; then
    echo "doc-parity-gate: warning — package.json changed but README.md was not updated."
    echo "Confirm the README's intro/installation/usage are still accurate."
  fi
  echo ""
  echo "Override: re-run with DOC_PARITY_OVERRIDE=1 set, after stating your reason."
} >&2

if [[ "${DOC_PARITY_OVERRIDE:-}" == "1" ]]; then
  echo "doc-parity-gate: override accepted." >&2
  exit 0
fi

exit 1
```

- [ ] **Step 2: Make executable**

Run: `chmod +x ~/dotfiles/claude/hooks/doc-parity-gate.sh`

- [ ] **Step 3: Test — no-op for unrelated commands**

```bash
echo '{"tool_input":{"command":"ls -la"},"cwd":"/tmp"}' | ~/dotfiles/claude/hooks/doc-parity-gate.sh; echo "exit=$?"
```
Expected: `exit=0`, no output.

- [ ] **Step 4: Test — parity violation warns (exit 1)**

```bash
set -e
FX=$(mktemp -d); cd "$FX"; git init -q; git config user.email t@t; git config user.name t
mkdir .agents
printf -- '---\nname: architecture\ndescription: x\nlast_updated: 2026-01-01\ncovers:\n  - "src/**"\n---\n' > .agents/architecture.md
mkdir src; echo "x" > src/a.ts
git add .agents/architecture.md && git commit -qm init
git add src/a.ts   # covered code staged, doc NOT re-staged
echo "{\"tool_input\":{\"command\":\"git commit\"},\"cwd\":\"$FX\"}" | ~/dotfiles/claude/hooks/doc-parity-gate.sh; echo "exit=$?"
```
Expected: stderr warns about `.agents/architecture.md`; `exit=1`.

- [ ] **Step 5: Test — README nudge on package.json change (exit 1)**

```bash
cd "$FX"; echo '{}' > package.json; echo "# Proj" > README.md
git add package.json README.md && git commit -qm "add pkg+readme"
echo '{"x":1}' > package.json; git add package.json   # pkg changed, README not
echo "{\"tool_input\":{\"command\":\"git commit\"},\"cwd\":\"$FX\"}" | ~/dotfiles/claude/hooks/doc-parity-gate.sh; echo "exit=$?"
```
Expected: stderr warns about README; `exit=1`.

- [ ] **Step 6: Test — override + clean case (exit 0)**

```bash
cd "$FX"; DOC_PARITY_OVERRIDE=1 bash -c 'echo "{\"tool_input\":{\"command\":\"git commit\"},\"cwd\":\"'"$FX"'\"}" | ~/dotfiles/claude/hooks/doc-parity-gate.sh'; echo "override_exit=$?"
git add README.md; echo "{\"tool_input\":{\"command\":\"git commit\"},\"cwd\":\"$FX\"}" | ~/dotfiles/claude/hooks/doc-parity-gate.sh; echo "clean_exit=$?"
cd ~ && rm -rf "$FX"
```
Expected: `override_exit=0`; `clean_exit=0` (README now staged).

- [ ] **Step 7: Commit**

```bash
cd ~/dotfiles && git add claude/hooks/doc-parity-gate.sh
git commit -m "Add global doc-parity + README-freshness hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task A2: Validator template (Node consumers)

Vendor crew's `scripts/validate-agents-frontmatter.ts` (+ test) as a skill template. It is already generic; ship verbatim as a template the scaffolding skill stamps into Node projects. **Live test is deferred** to the first Node consumer (skadimetric web app, sub-project 3) — dotfiles has no Node project to run vitest in. Verification here is a faithful-copy diff.

**Files:**
- Create: `~/dotfiles/claude/skills/establishing-a-new-project/templates/validate-agents-frontmatter.ts`
- Create: `~/dotfiles/claude/skills/establishing-a-new-project/templates/validate-agents-frontmatter.test.ts`

- [ ] **Step 1: Copy the validator and its test verbatim**

```bash
mkdir -p ~/dotfiles/claude/skills/establishing-a-new-project/templates
cp ~/Repos/crew/scripts/validate-agents-frontmatter.ts \
   ~/dotfiles/claude/skills/establishing-a-new-project/templates/validate-agents-frontmatter.ts
cp ~/Repos/crew/scripts/validate-agents-frontmatter.test.ts \
   ~/dotfiles/claude/skills/establishing-a-new-project/templates/validate-agents-frontmatter.test.ts
```

- [ ] **Step 2: Verify the copies are byte-identical to source**

```bash
diff ~/Repos/crew/scripts/validate-agents-frontmatter.ts \
     ~/dotfiles/claude/skills/establishing-a-new-project/templates/validate-agents-frontmatter.ts && echo "ts OK"
diff ~/Repos/crew/scripts/validate-agents-frontmatter.test.ts \
     ~/dotfiles/claude/skills/establishing-a-new-project/templates/validate-agents-frontmatter.test.ts && echo "test OK"
```
Expected: both print `OK` with no diff. (The validator is monorepo-aware via the optional `packages/*/AGENTS.md` branch, which no-ops in single-package repos — keep it; it is generic.)

- [ ] **Step 3: Commit**

```bash
cd ~/dotfiles && git add claude/skills/establishing-a-new-project/templates/
git commit -m "Vendor agents-frontmatter validator as scaffold template

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase B — README-freshness skill

### Task B1: `readme-freshness-check` skill

Sibling to `agents-doc-parity-check`. Applies to ANY repo with a root `README.md` (not gated on `.agents/`). Author with `superpowers:writing-skills`.

**Files:**
- Create: `~/dotfiles/claude/skills/readme-freshness-check/SKILL.md`

**Required frontmatter (verbatim):**

```yaml
---
name: readme-freshness-check
description: Use when about to claim any task complete or open a PR in a repo that has a root README.md — even if tests/lint/build pass, even if the change felt unrelated to docs. The README is the human-facing front door; this audit catches it drifting. Maps changed paths to README sections via a trigger set (description↔purpose, installation↔setup/deps/scripts, usage↔user-facing commands/API) and requires reviewing — and updating if affected — each implicated section. Additive to superpowers:verification-before-completion and agents-doc-parity-check, not a replacement. Inert in repos with no root README.md.
---
```

**Required body content (writing-skills shapes the prose; these are the load-bearing pieces):**
- **Announce line:** `"Using readme-freshness-check before claiming this task complete."`
- **Inert clause:** if no root `README.md`, say so and stop — don't fabricate a result.
- **Scope clause:** additive to `verification-before-completion` and `agents-doc-parity-check`; run all that apply.
- **Trigger-set table** mapping change kinds → README sections:

  | Changed | Review README section |
  |---|---|
  | project purpose / scope / what-it-is | Description / intro |
  | dependencies, setup steps, install/build scripts, `package.json` | Installation |
  | user-facing commands, CLI flags, public API, entrypoints, env vars | Usage |

- **Workflow:** (1) confirm `README.md` exists; (2) capture committed/staged/unstaged diffs (same 3-state approach as `agents-doc-parity-check`); (3) for each trigger row, if any changed path matches, read that README section and decide update-or-confirm; (4) gate the completion claim — any implicated section left wrong = not done.
- **Red-flags table** (rationalizations to counter), e.g. "my change was code, not docs" → "installation/usage are defined by code; check them."
- **Related skills** footer pointing at `superpowers:verification-before-completion` and `agents-doc-parity-check`.

- [ ] **Step 1: Author SKILL.md with writing-skills**

Invoke `superpowers:writing-skills`; produce `~/dotfiles/claude/skills/readme-freshness-check/SKILL.md` meeting the frontmatter + body requirements above.

- [ ] **Step 2: Verify frontmatter + structure**

```bash
head -5 ~/dotfiles/claude/skills/readme-freshness-check/SKILL.md
grep -c "Installation\|Usage\|Description" ~/dotfiles/claude/skills/readme-freshness-check/SKILL.md
```
Expected: `name: readme-freshness-check` present; trigger-set sections present.

**Acceptance:** description triggers on completion/PR in repos with a README; inert otherwise; names the three trigger→section mappings; declares additivity to the other two completion skills.

- [ ] **Step 3: Commit**

```bash
cd ~/dotfiles && git add claude/skills/readme-freshness-check/SKILL.md
git commit -m "Add readme-freshness-check skill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase C — Templates, scaffolding skill, convention doc

### Task C1: Scaffold templates (deterministic artifacts)

**Files (all under `~/dotfiles/claude/skills/establishing-a-new-project/templates/`):**
- Create: `CLAUDE.md`, `AGENTS-root.md`, `agents-README.md`, `README.md`

- [ ] **Step 1: `CLAUDE.md` (thin shim)**

```markdown
<!-- Claude Code reads CLAUDE.md, not AGENTS.md. This shim makes the AGENTS.md
     content auto-load. AGENTS.md remains the canonical file; edit that, not this. -->
@AGENTS.md
```

- [ ] **Step 2: `AGENTS-root.md` (root index skeleton)**

```markdown
# AGENTS.md

Conventions for agents working on `<PROJECT>`. Universal Node + documentation
conventions live in `~/.claude/conventions/`; this file covers `<PROJECT>`-specific
rules only.

## What this is

<one-paragraph description of the project — what it is and its current scope>

## Repo layout

<fill in as the repo grows>

## When you need it

Topic docs live in `.agents/`. Load one when your work matches its row.

| Doing | Read |
| ----- | ---- |
| _(none yet — add rows as `.agents/<topic>.md` docs are created)_ | |

See [`.agents/README.md`](.agents/README.md) for how this system works and how to extend it.

## Before claiming work complete

If this repo has `.agents/<topic>.md` docs with `covers:` frontmatter, run the
`agents-doc-parity-check` skill before reporting any task complete or opening a PR.
If it has a root `README.md`, run `readme-freshness-check`. Both are additive to
`superpowers:verification-before-completion`, not replacements.
```

- [ ] **Step 3: `README.md` (human-centered)**

```markdown
# <PROJECT>

<one-to-two sentence description: what this is and who it's for>

## Installation

<prerequisites + setup steps>

## Usage

<how a human runs / uses it — the most common commands or entrypoints>

## Development

<how to work on it: install deps, run tests, build>

## License

<license or "Private — all rights reserved.">
```

- [ ] **Step 4: `agents-README.md` (the system self-description)**

Adapt from crew's `~/Repos/crew/.agents/README.md`, removing crew specifics: drop the monorepo `packages/<pkg>/AGENTS.md` framing from §3's lighter-frontmatter example only if the new project is single-package (keep it as an optional note), and replace §11's crew-specific topic index with an empty "add rows as you create topic docs" placeholder. Preserve verbatim: the frontmatter spec (`name`/`description`/`last_updated`/`covers`), the "when to add a topic file" three criteria, the parity rule, staleness thresholds, naming conventions, and the "what does NOT belong in `.agents/`" taxonomy table. Save the adapted file to the templates dir.

Verification: `grep -q "last_updated" templates/agents-README.md && grep -q "covers" templates/agents-README.md && ! grep -qi "crew" templates/agents-README.md && echo OK`

- [ ] **Step 5: Commit**

```bash
cd ~/dotfiles && git add claude/skills/establishing-a-new-project/templates/
git commit -m "Add scaffold templates (CLAUDE/AGENTS/README/agents-README)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C2: `establishing-a-new-project` skill

The scaffolder. Author with `superpowers:writing-skills`.

**Files:**
- Create: `~/dotfiles/claude/skills/establishing-a-new-project/SKILL.md`

**Required frontmatter (verbatim):**

```yaml
---
name: establishing-a-new-project
description: Use when starting a brand-new project/repo and you want the standard agent-context + docs baseline — phrases like "set up a new project", "scaffold this repo", "bootstrap a new project", "establish project conventions". Stamps git init + hygiene baseline (.gitattributes, .gitignore), the .agents/ + AGENTS.md + CLAUDE.md-shim doc system, a human-centered README.md, and the docs/ structure (followups, superpowers/specs+plans). Composes with existing ~/.claude conventions by reference. Stops short of language/build-stack choices. Do NOT use for an already-scaffolded repo.
---
```

**Required body — the scaffold procedure (writing-skills shapes prose; these steps are load-bearing):**

1. **Preflight:** confirm target dir; if `.git` and `AGENTS.md` already exist, stop ("already scaffolded — nothing to do").
2. **git init** if not already a repo.
3. **Hygiene (compose-by-reference):** read `~/.claude/conventions/line-endings.md`, write its `.gitattributes` template to the repo. Read `~/.claude/conventions/code-quality.md`, write its universal `.gitignore` baseline; append `*:Zone.Identifier` (WSL); if Node, also append `node.md`'s additions. Never inline stale copies — lift current content from those files.
4. **Doc system:** copy templates → `CLAUDE.md` (shim), `AGENTS.md` (from `AGENTS-root.md`), `.agents/README.md` (from `agents-README.md`), `README.md`. Replace `<PROJECT>` placeholders with the real name; fill the description from the user.
5. **docs/ tree:** create `docs/followups.md` (lift the scaffold from the global `~/.claude/CLAUDE.md` "Followup detection" section) and `docs/superpowers/{specs,plans}/.gitkeep`.
6. **Node add-on (only if package.json exists or the project is declared Node):** copy `templates/validate-agents-frontmatter.ts` + `.test.ts` into the project (suggested `scripts/`), and add an `agents:validate` step to the lint script. Tell the user to `npm i -D glob js-yaml micromatch vitest @types/js-yaml` if missing.
7. **Minimal-at-birth rule:** create NO `.agents/<topic>.md` docs. State the three criteria for when the first one should be added.
8. **Closing guidance:** remind that `agents-doc-parity-check`, `readme-freshness-check`, and the global `doc-parity-gate` hook now apply to this repo automatically.

**Bundled templates:** the skill references files in its `templates/` dir (created in A2 + C1).

- [ ] **Step 1: Author SKILL.md with writing-skills**

Invoke `superpowers:writing-skills`; produce the SKILL.md meeting the frontmatter + procedure above. Reference bundled templates by relative path.

- [ ] **Step 2: Dry-run the procedure against a temp dir**

Manually follow the SKILL.md steps against `/tmp/scaffold-test` (skip the Node add-on). Then:

```bash
T=/tmp/scaffold-test
ls -la "$T" "$T/.agents" "$T/docs" "$T/docs/superpowers"
test -f "$T/.gitattributes" && test -f "$T/.gitignore" && test -f "$T/CLAUDE.md" \
  && test -f "$T/AGENTS.md" && test -f "$T/README.md" && test -f "$T/.agents/README.md" \
  && test -f "$T/docs/followups.md" && echo "SCAFFOLD OK"
grep -q "@AGENTS.md" "$T/CLAUDE.md" && echo "shim OK"
test -z "$(ls -A "$T/.agents" | grep -v README.md)" && echo "minimal-at-birth OK"
git -C "$T" rev-parse --is-inside-work-tree && echo "git OK"
rm -rf "$T"
```
Expected: `SCAFFOLD OK`, `shim OK`, `minimal-at-birth OK`, `git OK`.

- [ ] **Step 3: Commit**

```bash
cd ~/dotfiles && git add claude/skills/establishing-a-new-project/SKILL.md
git commit -m "Add establishing-a-new-project scaffolding skill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C3: Convention doc + global CLAUDE.md entry

**Files:**
- Create: `~/dotfiles/claude/conventions/project-scaffolding.md`
- Modify: `~/.claude/CLAUDE.md` (conventions library list)

- [ ] **Step 1: Write the convention doc**

Create `~/dotfiles/claude/conventions/project-scaffolding.md` covering:
- **When to read:** at the start of creating a new repo, or when wiring the doc system into an existing one.
- **The system:** the two-tier `.agents/` + `AGENTS.md` + `CLAUDE.md`-shim model + human `README.md`; pointer to the `establishing-a-new-project` skill as the executable path.
- **Self-maintenance:** the three parity nets (completion skills `agents-doc-parity-check` + `readme-freshness-check`; the global `doc-parity-gate` hook; the per-project Node validator) and the judgment-driven creation criteria.
- **Composition:** defers to `code-quality.md`, `line-endings.md`, `node.md`, and the global followups scaffold — does not duplicate them.
- **dotfiles home:** new user-level artifacts are authored under `~/dotfiles` and symlinked via `install.sh`.

Verification: `grep -qi "agents-doc-parity-check" ... && grep -qi "readme-freshness-check" ... && grep -qi "establishing-a-new-project" ... && echo OK`

- [ ] **Step 2: Add the conventions-library line to global CLAUDE.md**

In `~/.claude/CLAUDE.md`, under the "Conventions library" bullet list, add (alphabetical-ish, near the others):

```markdown
- **`conventions/project-scaffolding.md`** — read when creating a new repo (or wiring the doc system into an existing one). The `.agents/` + `AGENTS.md` + `CLAUDE.md`-shim + human-`README.md` baseline, the `establishing-a-new-project` skill that stamps it, and the self-maintenance nets that keep those docs in sync.
```

- [ ] **Step 3: Verify the edit landed**

```bash
grep -n "project-scaffolding.md" ~/.claude/CLAUDE.md
```
Expected: one match in the conventions library list.

- [ ] **Step 4: Commit dotfiles (convention doc)**

```bash
cd ~/dotfiles && git add claude/conventions/project-scaffolding.md
git commit -m "Add project-scaffolding convention doc

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Note: `~/.claude/CLAUDE.md` is a live file not yet in dotfiles; its edit is not committed here (it folds into the future ~/.claude→dotfiles migration). If the parity/secrets rules require, mention the edit to the user rather than committing it elsewhere.

---

## Phase D — Wire into dotfiles + activate

### Task D1: install.sh link lines + global hook registration

**Files:**
- Modify: `~/dotfiles/install.sh`
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Inspect the install.sh link helper + existing claude lines**

```bash
grep -n "^link\|^link()" ~/dotfiles/install.sh | head; sed -n '1,40p' ~/dotfiles/install.sh
```
Confirm the `link <src> <dst>` signature and where claude links go.

- [ ] **Step 2: Append link lines**

Add to `~/dotfiles/install.sh` (matching existing style; `$DOTFILES` is the repo root, `$HOME` the target):

```bash
link "$DOTFILES/claude/skills/establishing-a-new-project" "$HOME/.claude/skills/establishing-a-new-project"
link "$DOTFILES/claude/skills/readme-freshness-check"     "$HOME/.claude/skills/readme-freshness-check"
link "$DOTFILES/claude/conventions/project-scaffolding.md" "$HOME/.claude/conventions/project-scaffolding.md"
link "$DOTFILES/claude/hooks/doc-parity-gate.sh"          "$HOME/.claude/hooks/doc-parity-gate.sh"
```

- [ ] **Step 3: Run install.sh + verify symlinks**

```bash
cd ~/dotfiles && ./install.sh
ls -la ~/.claude/skills/establishing-a-new-project ~/.claude/skills/readme-freshness-check \
       ~/.claude/conventions/project-scaffolding.md ~/.claude/hooks/doc-parity-gate.sh
```
Expected: each target is a symlink (`->`) pointing into `~/dotfiles`.

- [ ] **Step 4: Register the global hook in settings.json**

Add to `~/.claude/settings.json` `PreToolUse` array a Bash matcher entry running the hook by absolute path. Note the global hooks run from arbitrary cwds, so use an absolute command:

```json
{
  "matcher": "Bash",
  "hooks": [
    { "type": "command", "command": "$HOME/.claude/hooks/doc-parity-gate.sh" }
  ]
}
```
(If `$HOME` is not expanded by the harness, use the literal `/home/safturento/.claude/hooks/doc-parity-gate.sh`. Preserve the existing atuin PreToolUse entry — append, don't replace.)

- [ ] **Step 5: Verify settings.json is valid JSON and contains the hook**

```bash
python3 -c "import json; d=json.load(open('$HOME/.claude/settings.json')); print('valid'); print([h for g in d['PreToolUse'] for h in g['hooks'] if 'doc-parity' in h.get('command','')])"
```
Expected: `valid` + the hook entry listed.

- [ ] **Step 6: Commit dotfiles (install.sh)**

```bash
cd ~/dotfiles && git add install.sh
git commit -m "Link bootstrap skills, convention, and global parity hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase E — Apply to skadimetric (proving ground)

### Task E1: Bootstrap skadimetric with the new skill

**Files:** scaffolds `~/Repos/skadimetric/` (git init + baseline).

- [ ] **Step 1: Run the scaffolding skill against skadimetric**

Invoke the `establishing-a-new-project` skill (now symlinked/active) targeting `~/Repos/skadimetric`. Project name: `skadimetric`. It will `git init`, write hygiene + doc-system + README + docs tree. Skip the Node add-on (no package.json yet — that arrives in sub-project 3).

- [ ] **Step 2: Verify the baseline**

```bash
cd ~/Repos/skadimetric
test -f .gitattributes && test -f .gitignore && test -f CLAUDE.md && test -f AGENTS.md \
  && test -f README.md && test -f .agents/README.md && test -f docs/followups.md && echo "BASELINE OK"
git rev-parse --is-inside-work-tree && echo "git OK"
grep -q "Zone.Identifier" .gitignore && echo "WSL ignore OK"
```
Expected: `BASELINE OK`, `git OK`, `WSL ignore OK`.

### Task E2: Skadimetric content — DESIGN.md, platform framing, gitignore

**Files:**
- Move: `skadis-drawer-system-project.md` → `docs/DESIGN.md`
- Modify: `~/Repos/skadimetric/AGENTS.md`, `.gitignore`

- [ ] **Step 1: Move the brief to docs/DESIGN.md**

```bash
cd ~/Repos/skadimetric && mkdir -p docs && git mv skadis-drawer-system-project.md docs/DESIGN.md 2>/dev/null || mv skadis-drawer-system-project.md docs/DESIGN.md
ls docs/DESIGN.md
```

- [ ] **Step 2: Ensure Zone.Identifier cruft is ignored, not tracked**

```bash
cd ~/Repos/skadimetric
grep -q "Zone.Identifier" .gitignore || printf '\n# WSL download metadata\n*:Zone.Identifier\n' >> .gitignore
rm -f ./*:Zone.Identifier 2>/dev/null || true
ls -1 | grep -i "zone.identifier" || echo "no zone files tracked"
```

- [ ] **Step 3: Write skadimetric's AGENTS.md (Skadis-platform framing)**

Replace the placeholder "What this is" / description in `~/Repos/skadimetric/AGENTS.md` with framing that establishes scope explicitly:

```markdown
## What this is

Skadimetric is a **parametric generator for IKEA-Skadis-mounted, 3D-printable systems** —
a browser app (à la gridfinitygenerator.com) where a user lays out a configuration on a grid,
sees a live 3D preview, and exports printable STLs, with all geometry generated parametrically
in client-side TypeScript (Manifold CSG kernel + three.js).

**Scope, stated up front so it isn't lost:** the **backing-panel grid is the generalized
foundation**, and **drawers are the first product built on it — not the definition of the
project.** Future products (hooks, bins, trays, tool holders, …) mount on the same backing
panel. Design types, parameter models, and UI abstractions should treat "drawer" as one
plugin/product, not a hardwired assumption. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full
living spec; the §5 parameter model is the authoritative names shared by both the Fusion
reference design and the code.

## Repo layout

Pre-implementation. `docs/DESIGN.md` is the living spec; `fusion360-cheat-sheet.md` is hands-on
CAD reference. Code arrives with the web-app build (a later sub-project).
```

- [ ] **Step 4: Verify framing + DESIGN.md link**

```bash
cd ~/Repos/skadimetric
grep -qi "not the definition of the project" AGENTS.md && echo "scope framing OK"
grep -q "docs/DESIGN.md" AGENTS.md && test -f docs/DESIGN.md && echo "DESIGN link OK"
```
Expected: both OK.

- [ ] **Step 5: Commit skadimetric (initial scaffold)**

```bash
cd ~/Repos/skadimetric && git add -A
git commit -m "Bootstrap skadimetric: doc system, hygiene, DESIGN.md, platform framing

Scaffolded via the establishing-a-new-project skill. Frames Skadimetric as a
Skadis platform (backing panel = foundation, drawers = first product).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task E3: Verify self-maintenance is active in skadimetric

- [ ] **Step 1: Parity skill applicability + README freshness inertness check**

```bash
cd ~/Repos/skadimetric
ls .agents/*.md   # only README.md → agents-doc-parity-check is inert (correct: no topic docs yet)
test -f README.md && echo "readme-freshness-check applies here"
```
Expected: only `.agents/README.md` (parity correctly inert until a topic doc is earned); README present.

- [ ] **Step 2: Confirm the global hook is wired (no-op here)**

```bash
echo "{\"tool_input\":{\"command\":\"git commit\"},\"cwd\":\"$HOME/Repos/skadimetric\"}" | ~/.claude/hooks/doc-parity-gate.sh; echo "exit=$?"
```
Expected: `exit=0` (no `.agents/<topic>.md`, no staged package.json change → clean).

- [ ] **Step 3: Note the earmarked first topic doc**

No action — confirm `docs/DESIGN.md §5` is the basis for the eventual `.agents/parameter-model.md` (created when geometry code lands in sub-project 3). Record nothing new; the spec already tracks it.

---

## Final verification (whole-plan)

- [ ] `cd ~/dotfiles && git status` — clean tree; branch `project-bootstrap-convention` ahead with the artifact commits.
- [ ] `ls -la ~/.claude/skills/establishing-a-new-project ~/.claude/skills/readme-freshness-check ~/.claude/hooks/doc-parity-gate.sh` — all symlinks into dotfiles.
- [ ] Global hook registered in `~/.claude/settings.json` (valid JSON, atuin entry preserved).
- [ ] `cd ~/Repos/skadimetric && git log --oneline` — bootstrap commit present; `docs/DESIGN.md` exists; `AGENTS.md` carries the platform framing.
- [ ] Conventions library line for `project-scaffolding.md` present in `~/.claude/CLAUDE.md`.

---

## Notes / deferred (from spec §9)

- **Validator live test** happens at the first Node consumer (skadimetric web app, sub-project 3).
- **Broader `~/.claude`→dotfiles migration** and the **`claude/` vs `.claude/` directory cleanup** remain separate sub-projects. The global `CLAUDE.md` and `settings.json` edits made here are live-file edits that fold into that migration.
- **Fusion MCP integration** (sub-project 2) and the **web-app build** (sub-project 3) are unchanged and out of scope here.
- **Crew double-hook interaction:** crew has its own repo-local `doc-parity-gate.sh` wired in `crew/.claude/settings.json`. Once the global hook lands, crew commits will trigger BOTH (both soft, but the parity warning doubles). Out of scope here; follow up in a crew PR — either remove crew's repo-local hook in favor of the global one, or have the global hook skip when a repo-local `.claude/settings.json` already registers a `doc-parity-gate`. Flag to the user to file as a crew followup.
