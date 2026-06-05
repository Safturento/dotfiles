---
name: visual-fidelity-check
description: Use when about to claim any UI-touching task complete or open a PR — even if tests/lint/build pass, even if you already screenshotted the rendered output, even if it "looks fine to me", even if you think the change is too small to need verification. Triggers on any change under a project's componentDir or any new/modified .figma.tsx file. Required when finishing UI work in a project that has a Figma source of truth wired up (`<repo>/.crew/visual-fidelity.json` or `[visual_fidelity]` in the project's crew TOML). Required IN ADDITION TO `superpowers:verification-before-completion` — that skill covers tests, lint, and build correctness; this one covers visual fidelity. They are not interchangeable. Running one does not replace the other.
---

# visual-fidelity-check

A mandatory pre-completion gate for UI work in projects with a Figma source of truth. Compares rendered output to the Figma design and surfaces mismatches that self-graded eyeball smoke misses.

**Announce when invoking:** "Using visual-fidelity-check before claiming this task complete."

**Fail-closed rule:** if the snapshot can't be found, or comparison can't run, do NOT claim done. Surface the blocker and stop. Don't treat "couldn't run" as "passed."

## Red flags — STOP and run the skill

| Thought | Reality |
|---|---|
| "All tests pass, ready to merge" | Tests don't catch visual regressions. Run the skill. |
| "I already screenshotted, looked correct" | Self-graded against nothing. Run the skill. |
| "The classes I emit are what the spec says" | The spec might be wrong — Figma is the source. Run the skill. |
| "Visual smoke via Playwright MCP passes" | That's "the page didn't crash," not "the design matches." Run the skill. |
| "It's a small change to one variant" | Small visual changes are exactly what self-grading misses. Run the skill. |
| "The dashboard already had this issue" | Then surface it in the report; don't skip the run. |
| "Snapshot isn't there / I can't find it" | Fail closed — surface as blocker, don't proceed. |
| "I'll re-check after the user reviews the PR" | The user's time isn't a fallback for self-verification. Run the gate. |

## Workflow

Detailed step-by-step procedure lives in **`workflow.md`** — read it when invoking the skill. It covers:

1. Read project config (`<repo>/.crew/visual-fidelity.json` or TOML block)
2. Identify touched components via `git diff`
3. Map each to a Figma node via the matching `.figma.tsx`
4. **Structural check** — what classes does the code emit per variant? Compare to Figma's resolved tokens
5. **Caller check** — what props do call sites pass? Compare to Figma's variant choices for the same context
6. **Visual check** (optional) — render + screenshot + compare to Figma screen
7. Compile the findings report (markdown, grouped by severity)
8. **Decide whether to claim done** — any high-severity = stop, fix, re-run

Examples of what reports look like: `examples/findings-report-example.md` and `examples/good-report-example.md`.

## Three kinds of findings

| Kind | What | Where to fix |
|---|---|---|
| **Structural** | Helper/cva produces wrong Tailwind class for a Figma variant (e.g. `bg-neutral-200` where Figma binds `zinc/50`) | Helper/component source |
| **Caller** | Component call site uses wrong prop vs Figma's design intent (e.g. `intensity="muted"` where Figma uses `intensity="mid"`) | The caller file |
| **Visual** | Rendered screenshot diverges from Figma screenshot in a way structural+caller didn't catch (icon glyph, layout subtlety) | Investigate root cause — could be either |

Every finding must cite **file:line + actual code snippet + Figma reference (node + tokenAlias or hex) + the diff**. A finding without all four is incomplete — sharpen or drop.

### Read the `enrichment` field first

Each per-node JSON in `<snapshotPath>` has two data tiers: `raw` (REST API, always present) and `enrichment` (Plugin-API, present when snapshot was enriched successfully). **Always prefer `enrichment`** when available:

- `enrichment.componentProperties` — exact variant config + resolved `Icon` INSTANCE_SWAP names (e.g. `Icon: { name: "lucide/circle" }`)
- `enrichment.mainComponent.name` — resolved master variant key (e.g. `"type=pill, color=waiting, intensity=mid"`)
- `enrichment.boundVariables` — per-paint `{ resolvedAlias, resolvedHex }` for direct color comparison

If `enrichment` is absent on a node you need to check, log a verification gap and degrade to `raw` inference. Don't pretend you have data you don't.

### Icon findings are NEVER judgment calls

If code's icon (Unicode glyph, wrong lucide variant, CSS-only span standing in for an SVG) doesn't match the Figma reference's icon, flag it. Severity ≥ medium. Naming the *specific* expected icon is part of the fix — write "use `lucide/arrow-up-right`" not "use an SVG." Read the specific name from `enrichment.componentProperties.Icon.name` — set-level defaults are unreliable (the Pill set's default Icon is `lucide/git-pull-request`, but individual instances use `lucide/circle`, `lucide/x`, `lucide/arrow-up-right`, `lucide/plus`, etc. depending on the instance's `Icon` INSTANCE_SWAP override). See workflow.md Step 4 for sub-cases.

## Rationalizations to counter

| Rationalization | Reality |
|---|---|
| "I already ran Playwright MCP" | Rendering ≠ comparing to Figma. |
| "The cva matches the spec doc" | The spec might be wrong. Figma is source. |
| "User catches stuff in PR review" | User's time ≠ self-verification fallback. |
| "Plan said visual smoke was deferred" | If the work touched UI, run the gate anyway. |
| "Snapshot failed but my work is fine" | Fail closed. Surface the snapshot failure. |
| "Findings are pre-existing, not from my change" | Then say so explicitly in the report. Don't skip the run. |

## Failure modes

- **No snapshot:** project has `[visual_fidelity]` config but no `.crew/figma-snapshot/`. Likely the snapshot generator didn't run pre-dispatch. **Block** — tell user to run `crew figma-snapshot` and re-dispatch.
- **No config:** project has visual surfaces but no `[visual_fidelity]` config. Flag as "project should be wired up" — don't block this task on it.
- **Component has no `.figma.tsx`:** flag as "no Code Connect mapping" — fall through to caller/parent context.

## Related skills

- `superpowers:writing-skills` — for iterating this skill
- `figma:figma-use` — only if you need to fetch live Figma data (the on-disk snapshot covers normal runs)
