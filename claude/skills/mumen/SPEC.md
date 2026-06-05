---
name: Mumen — middle-tier planning workflow
description: A user-level skill that sits between trivial fixes and full superpowers planning. One discussion, then ticket-or-implement, then PR.
type: design-spec
created: 2026-04-29
---

# Mumen — Design Spec

## Goal

Provide a "tier 2" planning workflow for unit-of-work-sized tasks (roughly one Jira ticket). Lighter than `superpowers:brainstorming` + `writing-plans` (which are calibrated for epic-sized scopes), but still enforces a single solid design discussion so implementation matches intent. Output is either a Jira ticket (and stop) or a finished PR — never both, never main.

## Why this exists

The user has the superpowers workflow for epic-sized work and "just do it" for trivial fixes. The middle tier — ticket-sized work — currently has no enforced discipline, so it tends to default to "let Claude run with it." Mumen fills that gap with a single discussion gate that mirrors the rigor of superpowers brainstorming, but completes in one round instead of multiple architecting steps.

## The three-tier workflow

| Tier | Trigger | Output |
|---|---|---|
| Trivial | "just do it" / one-line fix | Direct edit |
| **Mumen** | `/mumen` or "use mumen" — explicit only | One discussion → ticket OR implement → PR |
| Superpowers | `/brainstorm` / "use superpowers" | Spec → plan → epic + tickets → STOP |

Mumen is **explicit-invocation only**. No auto-trigger. This avoids Mumen and superpowers clashing on ambiguous-scope work.

## Phase 1 — The discussion

When invoked:

1. **Confirm scope** — restate the request in one sentence; user corrects if wrong.
2. **Walk the six sections** of the artifact, asking targeted questions only where uncertain:
   - **Goal** — one sentence: what we deliver and why
   - **Approach** — paragraph: chosen design / mechanism
   - **Files / surfaces touched** — bullet list
   - **Edge cases** — bullets, or "_none_" if genuinely none after asking
   - **Out of scope** — bullets, or "_none_" if no creep risk
   - **Test plan** — how we verify (manual, unit, e2e)
3. **Mini-riff allowed** — if a sub-question opens up that needs back-and-forth, riff inline within that section. No new ceremony; resolve the sub-question, then move on.
4. **Empty sections are fine** — Edge cases and Out of scope can be "_none_" if the discipline of asking yielded nothing. The discipline is asking, not filling.

### Scope-creep escalation valve

Either Mumen or the user can call "this is bigger than Mumen-sized" at any time. Mumen flags it when it sees signals: files-list growing past ~10, multi-day estimate, multiple uncertain mechanisms, crosses package boundaries with new abstractions.

On escalation:

- **Refine** — cut features / defer scope, re-confirm Mumen-sized.
- **Hand off to superpowers** — move the partial Mumen artifact from `docs/mumen/...` to `docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md`, swap frontmatter to spec format, then invoke `superpowers:brainstorming` picking up where we left off. The partial Mumen doc becomes the spec seed — no work lost.

## Phase 2 — Artifact write + branch

Once the six sections settle:

1. **Branch-first check** — run `git branch --show-current`. If on `main`, create a feature branch matching the project's existing convention (peek at `git log --oneline -10` if unsure) and switch *before* staging. Per the user's global CLAUDE.md.
2. **Write artifact** to `docs/mumen/YYYY-MM-DD-<slug>.md`:
   ```markdown
   ---
   type: mumen
   created: YYYY-MM-DD
   path: ticket | implement   # set after the fork
   key: <jira-key>            # added if ticket path
   ---

   # <Title>

   ## Goal
   ## Approach
   ## Files / surfaces touched
   ## Edge cases
   ## Out of scope
   ## Test plan
   ```
3. **Commit** the artifact to the feature branch as the first commit. This gives the work a recoverable anchor — if the session crashes, the agreed plan survives.

## Phase 3 — The fork

After the artifact is committed, ask:

> "Ticket this up in Jira, or implement it directly? My read: <suggestion based on scope, file count, immediate availability cues, Jira project context>."

Always ask. Always offer a suggestion. The user always decides.

**Strict OR**: ticket path → STOP. Implement path → no Jira ticket gets made.

## Phase 4a — Ticket path

1. **Verify project mapping** — repo matches the Jira project being filed against (CREW-* in crew, KAN-* in Recipes). If unclear, ask. (Per user's `feedback_verify_repo_matches_ticket` memory.)
2. **Create Jira ticket** using the artifact content as the description. Sections map cleanly to ticket fields.
3. **Update artifact frontmatter** with the new key (`key: CREW-99`); optionally rename file to `docs/mumen/CREW-99-<slug>.md` if project convention prefers. Amend the commit so artifact + key land together.
4. **Stop.** Mirror user's existing planning workflow: don't dispatch implementer subagents, don't write feature code, don't keep going. The artifact + ticket are the gate. User triggers implementation via `crew run <KEY>` when ready.

## Phase 4b — Implement path

1. **Branch already exists** from Phase 2.
2. **TDD by default, argue-out allowed** — write failing test first for behavioral changes. For non-behavioral work (CSS tweaks, config, copy edits, doc updates) Mumen can argue out; user can override.
3. **Implement** following the artifact's Approach. If the work diverges materially from what was agreed, stop and re-discuss rather than improvise.
4. **Verification before claiming done** — mandatory. Run the project's tests + typecheck + lint. For UI work, exercise the feature in a browser. No "I think it works" — only "I ran X, it passed."
5. **Mid-flight notes** — append surprises, dead ends, or decisions to the Mumen artifact under a `## Notes` section at the end. Avoids a second file.
6. **Open the PR** — match project convention (`gh pr create` with HEREDOC body). The Mumen artifact is part of the diff so reviewers see the agreed approach.
7. **Done state** — report PR URL and stop. Do not merge.

### Force-push policy on the implement path

Plain `--force` is forbidden. **`--force-with-lease` is allowed** but only after a clean `git rebase main`. On rebase conflict:

- Resolve trivial conflicts (whitespace, import-order, non-overlapping edits) inline.
- Anything substantive — stop and flag to the user.

## What Mumen does NOT do

- Auto-detect "this is Mumen-sized" — explicit invocation only.
- Skip verification-before-completion — non-negotiable on the implement path.
- Push to `main`, plain force-push, or merge PRs.
- Run both ticket and implement paths for the same artifact.
- Replace `superpowers:brainstorming` for epic-sized work — escalation hands off cleanly.

## Implementation

The skill itself lives at `~/.claude/skills/mumen/SKILL.md`. Frontmatter `name: mumen` with a description that:

- States "explicit invocation only" up front
- Names the trigger phrases (`/mumen`, "use mumen", "let's mumen this")
- Closes loopholes by mentioning what NOT to use it for (trivial fixes, epic-sized work)

The skill body walks through Phases 1–4 in order with tight checklists.
