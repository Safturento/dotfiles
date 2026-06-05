---
name: readme-freshness-check
description: Use when about to claim any task complete or open a PR in a repo that has a root README.md — even if tests/lint/build pass, even if the change felt unrelated to docs. The README is the human-facing front door; this audit catches it drifting. Maps changed paths to README sections via a trigger set (description↔purpose, installation↔setup/deps/scripts, usage↔user-facing commands/API) and requires reviewing — and updating if affected — each implicated section. Additive to superpowers:verification-before-completion and agents-doc-parity-check, not a replacement. Inert in repos with no root README.md.
---

# readme-freshness-check

A project's root `README.md` is its human-facing front door. It describes what the project is, how to install it, and how to use it. Every code change is a potential readme staleness event — new flags, new deps, renamed entrypoints. This skill is the completion-time audit that catches drift before you claim done.

**Announce when invoking:** "Using readme-freshness-check before claiming this task complete."

**Scope rule:** additive to `superpowers:verification-before-completion` AND `agents-doc-parity-check` — run all that apply. These skills are not interchangeable. `verification-before-completion` covers tests/lint/build correctness. `agents-doc-parity-check` covers `.agents/` topic doc parity. This skill covers the human-facing README. None replaces either of the others.

**Inert without `README.md`:** if there is no `README.md` at the repo root, say "no root README.md in this repo — freshness audit not applicable" and move on. Do not fabricate a result.

## Trigger set — what maps to what

| Changed | Review README section |
|---|---|
| Project purpose, scope, what-it-is, repo name/tagline | Description / intro |
| Dependencies, setup steps, install/build scripts, `package.json`, `requirements.txt`, lock files | Installation |
| User-facing commands, CLI flags, public API, entrypoints, env vars, configuration keys | Usage |

## Red flags — STOP and run the audit

| Thought | Reality |
|---|---|
| "My change was code, not docs" | Installation and Usage are *defined* by code. New dep = Installation change. New flag = Usage change. |
| "README still reads fine" | Then confirm by reading the relevant sections. Don't assume. |
| "Tests pass, so everything's consistent" | Tests don't read your README. The audit does. |
| "It was a small refactor" | Renamed entrypoint, dropped a script, changed a command — small is how README rot starts. |
| "I'll update the README after the PR is open" | Freshness is part of done, not a follow-up. |
| "This section isn't really about my change" | The trigger table decides scope, not your gut. Check each row. |

## Workflow

1. **Confirm applicability.** Check for `README.md` at repo root — e.g. `ls README.md`. None → skill inert; note it and stop.

2. **Determine the diff base.** Capture all three change states — committed, staged, unstaged. For committed work the base is the branch you'll merge into (usually `main`/`master`; `git remote show origin` shows the default). If your work isn't on a feature branch yet — still uncommitted on the base branch itself — the `<base>...HEAD` diff is simply empty and the staged/unstaged diffs carry everything. That's expected; run all three regardless.

3. **Collect changed paths.** Run all three diff commands:

   ```sh
   git diff --name-only <base>...HEAD   # committed on this branch
   git diff --cached    --name-only     # staged
   git diff             --name-only     # unstaged
   ```

   Deduplicate the combined list.

4. **Apply the trigger set.** For each row in the trigger table, ask: do any changed paths represent that kind of change? Use judgment on the nature of the file — `package.json` means deps/install, a CLI source file with new flags means usage, a `README.md` section rename means description. A single change can hit multiple rows; record every match.

5. **Review each implicated section.** For every matched row, read the corresponding README section. Decide: does my change make any statement in it wrong, incomplete, or newly missing?
   - **Yes** → update the README section to reflect reality.
   - **No** → leave it untouched and note "confirmed still accurate."

6. **Gate the completion claim.** Any implicated section left inaccurate = not done. Either make the edit, or state explicitly which section you are deferring and why.

## Rationalizations to counter

| Rationalization | Reality |
|---|---|
| "The trigger table doesn't mention my exact file type" | Judge by what the file *does*, not its extension. A `Makefile` target is a user-facing command; it maps to Usage. |
| "I updated the README as part of the change, so I'm covered" | Re-read it anyway. Intent and reality diverge. Confirming takes 30 seconds. |
| "Couldn't resolve the diff base" | Fail closed: surface the blocker, don't skip the audit. |
| "The README has a badge that auto-updates; it's fresh" | Badges don't write prose. Read the prose sections. |
| "I only touched tests" | Test changes can reveal that a documented API or command no longer exists. Check Usage. |

## Related skills

- `superpowers:verification-before-completion` — the parent completion gate; run it too.
- `agents-doc-parity-check` — sibling audit for `.agents/` topic docs; run it in repos that have `.agents/`.
