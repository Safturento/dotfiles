---
name: agents-doc-parity-check
description: Use when about to claim any task complete or open a PR in a repo that has a `.agents/` directory — even if tests, lint, and build all pass, even if the change feels unrelated to documentation, even if you think a topic doc is out of scope. Triggers on any committed or staged file change in such a repo. Each `.agents/<topic>.md` declares a `covers` glob list; a change touching a covered path means that doc must be reviewed and, if affected, updated. Required IN ADDITION TO `superpowers:verification-before-completion` — that skill covers tests, lint, and build correctness; this one covers agent-doc parity. They are not interchangeable. Running one does not replace the other. Inert in repos with no `.agents/` directory.
---

# agents-doc-parity-check

When a repo carries `.agents/<topic>.md` topic docs, each doc's `covers` frontmatter is a contract: "these paths are mine." Changing a covered file without reviewing its doc lets the doc rot. This skill is the completion-time audit that catches that before you claim done.

**Announce when invoking:** "Using agents-doc-parity-check before claiming this task complete."

**Scope rule:** additive to `superpowers:verification-before-completion`, not a replacement. Run both. This skill does not check tests/lint/build; that skill does not check doc parity.

**Inert without `.agents/`:** if the repo has no `.agents/` directory, say "no `.agents/` in this repo — parity audit not applicable" and move on. Don't fabricate a result.

## Red flags — STOP and run the audit

| Thought | Reality |
|---|---|
| "Tests pass, ready to commit" | Tests don't read docs. Run the audit. |
| "My change was code, not docs" | Code changes are exactly what `covers` tracks. Run it. |
| "The commit hook will catch stale docs" | The hook is the *second* net and only warns. Don't outsource your audit to it. |
| "This topic doc is obviously unrelated" | The `covers` glob decides scope, not your gut. Check the glob. |
| "Small change — the doc still reads fine" | Then confirm that by reading the doc. Don't assume it. |
| "I'll review docs after the PR is open" | Parity is part of done, not a follow-up. |

## Workflow

1. **Confirm applicability.** `ls .agents/*.md`. None → skill inert; note it and stop.

2. **Determine the diff base.** Capture all three change states — committed, staged, unstaged. For committed work the base is the branch you'll merge into (usually `main`/`master`; `git remote show origin` shows the default). If your work isn't on a feature branch yet — still uncommitted on the base branch itself — the `<base>...HEAD` diff is simply empty and the staged/unstaged diffs carry everything. That's expected; run all three regardless.

3. **Match changed files to docs.** For each `.agents/<topic>.md`, read its `covers` list. For each glob, ask git directly — git's `:(glob)` pathspec magic handles `**` and `*` correctly, so you don't hand-roll glob matching. Run all three; an empty result from any one is fine:

   ```sh
   git diff --name-only <base>...HEAD -- ":(glob)<glob>"   # committed on this branch
   git diff --cached    --name-only   -- ":(glob)<glob>"   # staged
   git diff             --name-only   -- ":(glob)<glob>"   # unstaged
   ```

   Any non-empty result → that doc is **in scope**. One changed file can match several docs — that is the overlap case; record *every* match, not just the closest fit.

4. **Review each in-scope doc.** Read it. Decide per doc: does my change make any statement in it wrong, incomplete, or newly missing?
   - **Yes** → update the doc, and bump `last_updated` to today's ISO date in the same change.
   - **No** → leave it untouched (including `last_updated`).

5. **Gate the completion claim.** Any in-scope doc that needs an edit you have not made = not done. Either make the edit, or state explicitly which doc you are deferring and why.

## Rationalizations to counter

| Rationalization | Reality |
|---|---|
| "No `.agents/` doc is *about* my feature" | `covers` is a path glob, not a topic vibe. A match is a match. |
| "I bumped `last_updated`, so I'm covered" | The date is a freshness signal, not the work. Update the *content*. |
| "The hook didn't complain" | The hook runs later, only on commit/PR, and only warns. This audit runs now. |
| "Overlap means I pick the best-fit doc" | No — update every doc whose `covers` glob matches. |
| "Couldn't resolve the diff base" | Fail closed: surface the blocker, don't skip the audit. |

## Related skills

- `superpowers:verification-before-completion` — the parent completion gate; run it too.
- `superpowers:writing-skills` — for iterating this skill.
