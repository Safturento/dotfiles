# Cross-session reminders — design spec

**Date:** 2026-06-05
**Status:** approved (brainstorm complete; pending implementation)
**Deliverable location:** `~/.claude/**` (authored in-session, tracked via `~/dotfiles`; no Jira ticket / no `crew run` per global CLAUDE.md)

## Problem

"Remind me next time I'm in crew" and "remind me tomorrow" reminders keep failing to set up
properly — it has happened several times. Two distinct root causes, both seen in the
2026-06-04→05 incident:

1. **No canonical mechanism, so the agent improvises.** Last night's "make two crew edits next
   time you're in crew" reminder was saved as a **claude-mem memory in skadimetric's project
   scope**. claude-mem memories are project-scoped and don't reliably surface cross-project, so it
   never appeared in the crew session it was meant for. The assistant even flagged the caveat at
   creation time — there was no better-known home to put it in.
2. **Hand-built delivery hooks never self-clear.** Earlier reminders were hardcoded
   `SessionStart` hook blobs in a project's `.claude/settings.local.json` with `"once": true`.
   The 2026-05-15 reminder blob was never cleaned up and **replayed three weeks later** (on
   2026-06-05), masking the absence of the real reminder.

We want a **strong, global convention** that works **within a project** ("next time I'm in this
repo") and **cross-project** ("leave a note for crew while I'm in skadimetric"), so this stops
happening.

## Requirements (from brainstorm)

- **Targeting:** each reminder can carry a target **project** (fires on next session in that
  repo) and/or a **due date** (fires on/after that date). The two combine.
- **Not fire-once, not every-session.** A **daily check-in**: at most once a day, surface "here's
  what's queued — want to discuss any of it?", filtered to **global items + items relevant to the
  current project**. Items persist until resolved; daily visibility (not auto-deletion) is what
  prevents silent rot.
- **On-demand expansion** to all projects' reminders.
- **Dedicated store.** The check-in draws only from the reminder store. A reminder may *link* to a
  `followups.md` anchor or a Jira ticket, but `followups.md` and Jira keep their own surfacing.
- **Deterministic delivery.** Surfacing + throttling are done by code at session start, never
  dependent on the agent noticing something.
- **Proactive resolution.** The agent marks a reminder done the moment it has concrete evidence
  the work shipped — the user shouldn't have to say "mark it done" to avoid lingering reminders.
- **Git-tracked** active reminders (backup + accessible from other machines).

## Architecture

Approach **A — flat files + a global hook script + a `CLAUDE.md` convention**. Chosen over a
`remind` CLI (a new binary is its own setup-fragility risk — the exact failure class we're killing)
and over folding into `crew` (a global concern shouldn't couple to one project's tooling; crew's
hooks aren't loaded in a skadimetric session).

### Prerequisite: config consolidation (Phase 0)

This work surfaced that `~/.claude/CLAUDE.md`, `~/.claude/settings.json`, and most of
`~/.claude/conventions/` + `~/.claude/skills/` are **not** tracked in `~/dotfiles` — the same
"untracked config silently drifts" class of failure this spec fights. So a **Phase 0** precedes
the reminders feature: bring all user-authored agent config under dotfiles management.

- **Track + symlink** into `~/dotfiles/claude/`: `CLAUDE.md`, the 8 untracked conventions, the 9
  untracked skills (skip the empty `learned/` dir). Hooks are already fully tracked.
- **`settings.json` stays local** (machine-specific allowlist + absolute paths; `dotfiles` is a
  **public** repo). Instead, `install.sh` gains an **idempotent `ensure_session_start_hook`
  helper** that registers a hook command into `~/.claude/settings.json` if absent — mirroring the
  existing `git config --add include.path` idempotent pattern.

The reminders feature (below) then lands *on top of* this: the "Reminders" convention edits the
now-tracked `CLAUDE.md`, and the check-in hook is registered via the new install.sh helper rather
than a manual settings.json edit.

Five units, each independently understandable:

### Unit 1 — Reminder file format

One markdown file per reminder, mirroring the existing memory-file pattern:

```markdown
---
name: <short-kebab-slug>
scope: global | project:<name>        # who it's for
due: 2026-06-09                       # optional; omit ⇒ "next session in scope"
created: 2026-06-05
source_session: <session-id>          # where created, for back-reference
done_when: <plain-language completion condition>   # optional; drives proactive resolution
status: active                        # active | done
---

<body — what to do, why, links to [[followup-anchor]] / CREW-NNN / file paths>
```

- `scope` + `due` are independent and combine. Examples:
  - `scope: project:crew`, no `due` ⇒ next crew session.
  - `scope: global`, `due: 2026-06-06` ⇒ any session on/after the 6th.
  - `scope: project:crew`, `due: 2026-06-09` ⇒ next crew session on/after the 9th.
- `done_when` lets a reminder declare its own satisfaction condition so resolution is recognizable
  (e.g. "both followups.md edits landed in a crew PR").

### Unit 2 — Store layout

```
~/.claude/reminders/
├── <slug>.md                       # active reminders  (git-tracked)
├── archive/<slug>.md               # resolved/dismissed (git-tracked; never surfaced)
└── .state/checkin-<project>.json   # last check-in date per project context (gitignored)
```

- Physically lives in `~/dotfiles/claude/reminders/`, symlinked to `~/.claude/reminders/` — same
  tracked-via-dotfiles mechanism as `claude/hooks/` and `claude/conventions/`.
- Active + archived reminder files are **git-tracked** (backup, cross-machine access).
- `.state/` is **gitignored** — throttle timestamps are machine-local transient state.

### Unit 3 — Delivery hook (`reminder-checkin.mjs`)

A dependency-free Node script (only Node builtins: `fs`, `path`, `child_process`), at
`~/dotfiles/claude/hooks/reminder-checkin.mjs`, symlinked to `~/.claude/hooks/`. Registered as a
**global `SessionStart` hook** in `~/.claude/settings.json`.

On each session start it:

1. Reads the hook's stdin JSON (`{ cwd, ... }`) for the session's working directory.
2. Resolves **project identity**: basename of the git superproject root, so worktrees
   (`crew-CREW-185`) resolve to `crew`. Computed via `git -C <cwd> rev-parse --git-common-dir` →
   the main worktree's parent dir name. Falls back to `basename(cwd)` outside a git repo.
3. Selects `active` reminders where `scope == global` **or** `scope == project:<current>`, **and**
   (`due` absent **or** `due <= today`).
4. Checks the per-project **daily throttle** in `.state/checkin-<project>.json`: if a check-in
   already fired for this project on today's calendar date, emit nothing and exit 0.
5. If there are matches and the throttle is clear: emit the standard SessionStart hook JSON —
   `systemMessage` one-liner ("📌 N queued reminder(s) — say 'review reminders' to discuss") and
   `hookSpecificOutput.additionalContext` listing the matched reminders (slug, scope, due, body) —
   then stamp today's date into the throttle file.

Throttle semantics: **at most one check-in per project per calendar day**, each showing global +
that-project items. (Global items can therefore appear in two different projects' check-ins on the
same day if you switch projects — accepted as a mild, tolerable repeat; revisit only if noisy.)

Output JSON shape (matches the existing hook contract):

```json
{
  "systemMessage": "📌 2 queued reminders — say 'review reminders' to discuss",
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<rendered list of matched reminders>"
  }
}
```

Performance: reads a small directory; must stay well under ~100ms since it runs on **every**
session in **every** project.

### Unit 4 — Creation convention (`~/.claude/CLAUDE.md` "Reminders" section)

A new section in the global CLAUDE.md that makes the store the **one canonical home**:

- **Trigger recognition:** when the user says *"remind me [next time in X / tomorrow / on DATE]
  to …"* (or equivalent), the agent writes a reminder **file** to `~/.claude/reminders/` — full
  stop. Resolve relative dates to absolute `due:` at write time.
- **Cross-project correctness:** a reminder created *from skadimetric, for crew* is just
  `scope: project:crew`. The file lives in the global store, so it surfaces in crew regardless of
  where it was authored. (This is the exact case that failed.)
- **Explicit prohibitions** (the two root causes):
  - Never stash a cross-session reminder as a claude-mem memory.
  - Never hand-edit a `SessionStart` hook blob in any project's `settings.local.json`. That
    pattern is **deprecated**; the store + global hook replaces it.

### Unit 5 — Resolution, dismissal & show-all (agent operations)

- **Review:** "review reminders" ⇒ agent reads the surfaced set, discusses, and per item: acts,
  snoozes (bump `due`), or dismisses.
- **Proactive resolution** (requirement c): the agent watches for **concrete evidence** that an
  active reminder's work is complete — its `done_when` being satisfied, or the described task
  landing **this session** (a commit, a merged/opened PR, the file edits shipping). On such
  evidence it **proactively** resolves the reminder and **reports** the action in passing
  ("✓ resolved reminder `crew-doc-parity-followup` — landed in PR #NN"), rather than waiting to be
  told. Guardrail: resolve only on concrete evidence, never on mere discussion; when uncertain,
  ask. Safe to err toward done because resolution **archives** (status `done` + `resolved: <date>`
  + one-line outcome), it does not delete — a wrongly-closed reminder is one sentence to restore.
- **Show all projects on demand:** "show all reminders" ⇒ agent reads the whole store and lists
  global + every project's active items, bypassing the per-project filter.

## Data flow

```
creation:   user says "remind me…"  ──►  agent writes ~/.claude/reminders/<slug>.md (scope/due/done_when)
delivery:   session start  ──►  SessionStart hook  ──►  reminder-checkin.mjs
                 reads cwd → project, filters store, checks daily throttle
                 ──►  emits matched reminders as additionalContext (≤ once/project/day)
review:     user "review reminders"  ──►  agent discusses surfaced set
resolution: concrete evidence work shipped  ──►  agent archives reminder (status: done) + reports
show-all:   user "show all reminders"  ──►  agent lists every project's active items
```

## Error handling

- **Malformed reminder file** (bad frontmatter): the hook skips it and continues — one bad file
  must never suppress the whole check-in. (Optionally note the skip in `additionalContext`.)
- **Not in a git repo / git missing:** fall back to `basename(cwd)` for project identity; global
  reminders still surface.
- **Missing/corrupt `.state` file:** treat as "no check-in today yet" and proceed (fail open —
  better a possible duplicate check-in than a silently-swallowed one).
- **Empty store / no matches:** emit nothing, exit 0. Never block or slow session start.
- **Hook script error:** must exit 0 with no output on any unexpected exception — a reminder
  failure must never break session startup.

## Testing

- **Unit (pure logic):** factor selection (scope/due filtering), project resolution (incl.
  worktree → superproject), and throttle (same-day suppression, new-day pass, missing-state fail
  open) as pure functions tested over fixture stores + injected `today`/`cwd`. No real Node deps.
- **Malformed-input cases:** bad frontmatter skipped; non-git cwd; corrupt state file.
- **Integration smoke:** pipe a representative `{cwd}` stdin into `reminder-checkin.mjs` against a
  `/tmp` fixture store, assert the emitted hook JSON and the stamped throttle file.
- No automated test can cover the *convention* (Units 4–5) — those are agent-followed prose,
  verified by dogfooding (the first real use is migrating last night's two crew followup edits into
  a reminder if not done inline).

## Decisions resolved in brainstorm

- Targeting = project + time, unified (not every-session). ✔
- Daily check-in cadence, persistent queue, on-demand all-projects expansion. ✔
- Dedicated reminder store (not a unified followups/Jira digest). ✔
- Approach A (files + hook + convention), not a CLI, not crew-coupled. ✔
- Active reminders git-tracked; Node hook; proactive agent resolution with `done_when`. ✔

## Out of scope (candidate followups)

- A `remind` CLI / structured store — revisit only if the flat-file convention proves fiddly.
- Folding `followups.md` / Jira backlog into the check-in (explicitly declined for now).
- Snooze ergonomics beyond "bump `due` by hand."
- Global-item throttling separate from per-project (only if same-day repeats prove noisy).
```
