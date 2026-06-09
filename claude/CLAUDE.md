# User-level conventions

Applies across every project unless a project's own `CLAUDE.md` overrides.

## Planning workflow

Substantial work — anything bigger than a single trivial change — follows this shape:

1. **Brainstorm.** Use `superpowers:brainstorming` to settle scope, requirements, and design. Output is a spec.
2. **Plan.** Use `superpowers:writing-plans` to translate the spec into an implementation plan. Output is a markdown file under `docs/superpowers/plans/`.
3. **Ticket the work in Jira.** Create one **Epic** for the whole effort, then create child tickets in that epic. Each ticket maps to a *logical grouping* of plan tasks — bundle TDD-cycle-sized steps into coherent units (matches the existing convention where one ticket covers multiple related modules/commands). Don't create one ticket per plan task.
4. **Link dependencies.** Use Jira's "blocks" / "is blocked by" links so the dependency graph is explicit. If two tickets can run in parallel, leave them unlinked.
5. **Discuss parallelism.** Once the tickets exist with their dependency edges, lay out the optimal parallel-vs-sequential schedule and confirm it with me before any implementation begins.
6. **Stop. Wait for me.** I trigger implementation when I'm ready, via `crew run <KEY>` (or equivalent). **Do not** dispatch implementer subagents, write feature code, or otherwise start the work on your own. Reviews of completed work are different — I'll ask explicitly when I want one.

The boundary: you do the **planning** end-to-end, and you stop at the planning/ticketing stage. Implementation execution is mine to start.

## Why

I've been burned by autonomous "let me just keep going" execution that landed code I didn't review against. Tickets + an explicit go-signal are the gate. They also make work resumable across sessions: the Epic + tickets survive a terminal crash; in-flight subagent state does not.

## Park planning intentions in Jira, not memory

The moment we decide something is worth planning — a followup graduating, a fresh scope, a "we should plan X" — create the Jira artifact immediately. Don't cache the intention in a session memory or leave it only in a followups file. Memories are point-in-time snapshots with no verification loop; they get recalled and quoted back stale long after the work has shipped (I have been burned by exactly this: answering "what's queued for planning?" from a two-week-old memory whose items had already shipped under tickets I didn't check). Jira is the trackable source of truth.

- **Park as** an Epic (large effort), a child of an existing Epic, or a standalone ticket — sized to the work. It sits in the project's "needs-planning" backlog status until brainstorm + spec + plan are done, then moves to the "planned / ready" status and onto the board.
- **Stamp the originating followup** with its ticket key when it graduates (see "Followup detection" → "Ticketing a followup").
- **Keep the followup and its ticket in sync.** Once stamped, the followup and its ticket are two copies of the same pre-planning intent. If you revise one — the followup body or the ticket description — mirror the change into the other in the same pass, so their contexts never drift apart.
- **When I ask what's queued for planning, query the tracker first** — not session memories, not the followups file. Reconcile every candidate against Jira *and* code before reporting anything as queued or done. Project-specific status names + the exact query live in that project's planning docs (for crew: `.agents/workflow.md`).

## Reminders (cross-session)

A reminder is a note-to-future-self that should surface in the right **project** (or globally), even one set from a different project. The canonical home is the file store at `~/.claude/reminders/` — surfaced by the `reminder-checkin.mjs` SessionStart hook. The store is a **living queue**: every active item (global + items for the current repo) surfaces at the start of *every* session — no per-day throttle, no hiding until a date. Items leave the queue only by being archived. When the hook surfaces reminders, raise them as the first action of the session, before engaging the user's request.

`due` is a **deadline / priority signal, not a visibility gate.** Most items have no `due` and just ride the queue, getting pushed back session after session until done — that's expected. Set `due` only when something genuinely must happen by a specific date. Dated items sort to the top (soonest first, then undated) and a passed deadline is flagged `OVERDUE` — meaning: do these before the undated ones, don't ignore them until the date arrives.

**Creating one.** When I say "remind me [next time in X / tomorrow / on DATE] to …" (or equivalent), write a file `~/.claude/reminders/<slug>.md`:

```yaml
name: <kebab-slug>
scope: global | project:<name>     # project:<name> = the target repo's directory name
due: 2026-06-09                    # OPTIONAL deadline only — omit for ordinary queue items. Set just when there's a real do-by date (resolve "tomorrow"/"Friday" to absolute); dated items sort first + flag OVERDUE. NOT a hide-until date.
created: <today>
source_session: <this session id>
done_when: <plain-language completion condition>   # optional but encouraged
status: active
```

…followed by the reminder body (what to do, why, links to `[[followup-anchor]]` / `CREW-NNN` / file paths). A reminder set from one project for another is just `scope: project:<other>` — the file lives in the global store, so it surfaces there regardless of where it was authored.

**Never** stash a cross-session reminder as a claude-mem memory, and **never** hand-edit a `SessionStart` hook blob in a project's `settings.local.json`. Both have silently failed before; the store + hook is the only mechanism.

**Resolving one.** Proactively mark a reminder done the moment there's **concrete evidence** its work shipped — its `done_when` is satisfied, or the described task lands this session (a commit, an opened/merged PR, the edits shipping). Don't wait to be told. Move the file to `~/.claude/reminders/archive/` with `status: done`, a `resolved: <date>` line, and a one-line outcome, then report it in passing ("✓ resolved reminder `<slug>` — landed in PR #NN"). Resolve only on concrete evidence (not mere discussion); when unsure, ask. Archiving (not deleting) makes erring toward done safe.

**Reviewing.** "review reminders" → discuss the surfaced set; per item act / defer (leave it — the queue re-raises it next session) / reprioritize (set or clear `due`) / dismiss (archive — the only way to stop an item resurfacing). "show all reminders" → read the whole store and list global + every project's active items, bypassing the per-project filter.

## When to skip planning

- Trivial fixes (one-line bug, a typo, a config tweak).
- Exploratory questions that don't change code.
- Small refactors I've explicitly authorized.

If a request is ambiguous, ask whether it's "trivial / go ahead" or "let's plan this."

## Don't ticket — handle manually

Work whose deliverable lives under `~/.claude/**` (user-level skills, global `CLAUDE.md` edits, settings tweaks) can't run through the autonomous `crew run` flow — Claude Code's hardcoded sensitive-file check blocks writes there even with `--dangerously-skip-permissions`. Brainstorm scope as usual, but author these directly in the chat rather than creating a Jira ticket.

## Branching

Code or content changes meant to ship through a PR never go on `main`. Before any commit:

1. Run `git branch --show-current`.
2. If on `main`, create a feature branch and switch to it *before* staging anything.
3. Branch naming: match the project's existing convention. If unsure, peek at recent branches/PR titles (`git log --oneline -10`) and mirror the pattern.

`main` is protected on the remotes I push to, so a direct commit can't be pushed anyway — catch it at branch time, not at push time. Exceptions only when I explicitly say "commit on main."

## Secrets

Don't read files that have `secret`, `secrets`, `credentials`, `token`, or `.env*` in the name, or that you have any reason to suspect contain secrets (private keys, API tokens, passwords). This applies to every tool that surfaces file contents — `Read`, `Bash` with `cat`/`head`/`tail`/`grep -v`, `Edit` against an unread file, etc. Listing paths (`ls`, `find` without `-exec cat`) is fine; pulling the contents into the transcript is not.

When I'm asking about such a file, ask me to paste the relevant lines with sensitive values masked (`CREW_JIRA_API_TOKEN="<redacted>"`). Same when you'd otherwise need to open the file to debug — describe what you'd want to see, and I'll provide it masked.

The only override is me saying explicitly: "go ahead and read it" / "open the secrets file" / equivalent. Inferring permission from the surrounding task is not enough.

**Why:** anything in your transcript is effectively leaked — it lives in conversation logs, may flow to subagents, and can resurface in future contexts. A real token I had to revoke is the cost of getting this wrong once.

## Followup detection

Substantial design work surfaces items that don't belong in the current scope but shouldn't be lost: side tangents during brainstorming, deferred concerns in spec out-of-scope sections, "we should think about X" moments, small feature requests, gaps noticed during code review. These need to land somewhere or they evaporate — and a thin bullet captures *that* an idea existed without preserving the analysis that made it interesting. Aim for entries that survive being read cold months later.

Capture pattern: project-scoped, in `<repo>/docs/followups.md`. Versioned with the code so PR review can spot, add, and triage them. Not memory entries — memory is for user-level patterns (how I work, what I prefer); followups are project-scoped deferred work tied to specific code, tickets, or conversations.

Triggers — watch for:

- "We should follow up on X" / "worth revisiting Y" mid-conversation
- Side tangents that deserve their own focused thinking but don't fit current scope
- Small feature requests that aren't substantial enough to ticket immediately but shouldn't be lost
- Gaps noticed during code review that are out of scope for the current PR
- Jira tickets containing "follow up" or equivalent language
- Spec sections marked "out of scope" that name a *specific* deferred concern (not vague "future work" hand-waves)

Action when noticed:

1. Append a structured entry to `<repo>/docs/followups.md` under `## Active`, creating the file (with the scaffold below) if absent. Use the entry template — thin bullets become "dotted outlines of where an idea used to be" within weeks; useless when revisited.
2. Update the `## Contents` ToC with a link to the new entry.
3. Tell me, one line: "noted in docs/followups.md".

Entry template (each entry is an `###` header so the ToC can link to it via GitHub's auto-anchor):

````markdown
### YYYY-MM-DD — short title

**Ticket:** [KEY-123](https://safturento.atlassian.net/browse/KEY-123) — *omit this line until the followup is ticketed; add at ticket-creation time, remove on resolution.*

**What:** the gap or opportunity in one or two sentences.

**Why noticed:** what triggered surfacing this. PR/ticket sources can link out — the source carries the recoverable context. Conversation sources MUST summarize the surrounding context so "oh right, that thread" lands cold.

**Anchors:** file paths, ticket keys, PR numbers, dashboard views, session paths. What you'd grep for to re-orient.

**What's been considered:** alternatives discussed, tradeoffs surfaced, recommendations already formed. Skip when nothing was discussed.

**Shape of work:** rough decomposition — not a plan, just enough to size it ("small refactor in X" / "needs design pass on Y" / "two tickets, one for parser one for UI").

**Open questions:** things you'd need to decide before this could become a ticket. Skip when there are none.
````

File scaffold (use when creating `docs/followups.md` from scratch):

````markdown
# Followups

A queue between "noticed it" and "decided what to do about it." Items might become Jira tickets, get fixed inline during related work, or be explicitly abandoned. Triage periodically.

Format: see the user-level `~/.claude/CLAUDE.md` "Followup detection" section.

## Contents

- [Active](#active)
- [Resolved](#resolved)
- [Abandoned](#abandoned)

## Active

(entries here, newest at top)

## Resolved

(items move here when ticketed and shipped, or fixed inline — keep for historical context, prune when the file gets long)

## Abandoned

(items move here when explicitly decided against — note the reason in a one-line addendum so the decision is recoverable)
````

ToC maintenance: each entry's H3 title gets a child bullet under its parent section in `## Contents`. Use GitHub's slug rules (lowercase, spaces → `-`, em-dashes preserved as `--`, punctuation stripped) — easiest to copy the slug from the rendered view's "copy link" hover after a first commit if uncertain.

Ticketing a followup — bidirectional link + atomic resolution:

When a followup graduates into a Jira ticket, mirror the link both directions and bake the move into the implementing PR so resolution is transactional rather than a thing-to-remember-later.

1. **Add `**Ticket:** [KEY-123](url)` line to the entry**, right under the H3 title (before "What:"). Lets a reader skim the file and instantly tell which entries are in flight vs still sitting.
2. **Include a "move to Resolved" acceptance criterion in the ticket description**, naming the followup file + anchor, e.g. `> Move the followup entry at \`docs/followups.md\` (anchor `2026-05-03--playwrightmcp-ignores-crews---executable-path-override`) to Resolved as part of this PR.` This makes the move part of the ticket's deliverable, so the agent (or human) implementing it can't forget — the PR that ships the fix is also the PR that updates the file.
3. **The implementing PR moves the entry atomically.** Cut from `## Active` to `## Resolved`, update both ToC links, append `**Resolved YYYY-MM-DD:** one-line summary` to the entry body, and remove the `**Ticket:**` line (the Resolved section is the historical record — no need to keep an Active-state pointer once the work shipped). Same diff as the fix means the followup state can never drift from reality.

**Epic exception.** When a followup leads to a multi-ticket Epic rather than a single ticket, the rules shift:

- The `**Ticket:**` line points at the **Epic key** (e.g. `[CREW-94](url)`), not any individual child. Add a brief note that resolution is gated on Epic completion.
- Multiple followups can legitimately point at the same Epic — different concerns naturally fold into the same Epic during planning. That's expected, not a sign of mis-scoping.
- Don't move the followup to Resolved when individual children ship. Wait for the Epic itself to transition to Done. A followup represents user-facing scope; the Epic is the tracking unit for that scope.
- Trigger shifts from "implementing PR" to **Epic close ritual**: when transitioning an Epic to Done in Jira, scan `docs/followups.md` for any entries whose `**Ticket:**` line names that Epic and move them all to Resolved in a follow-on doc-only commit (or fold into the last child PR if timing allows). The Resolved addendum names the Epic and which child tickets covered the followup's scope.

Section transitions: when an entry moves between Active / Resolved / Abandoned, update the ToC link too. When abandoning, append a one-line `**Abandoned YYYY-MM-DD:** reason.` to the entry body so future readers can recover the decision.

Source-decay rule: PR/ticket-sourced entries can be thin (the source is the recoverable context). Conversation-sourced entries MUST be self-contained — the conversation evaporates otherwise.

At the start of substantial new work in a repo: skim `docs/followups.md` for items relevant to the current task. Some may be ready to fold in; others worth flagging to me before scoping.

## Conventions library

Topic-scoped guidance lives in `~/.claude/conventions/`. Each file declares when to read it. Don't preload them all — pull in the relevant ones based on the work at hand.

- **`conventions/code-quality.md`** — read once at the start of any non-trivial work in any repo. Cleanliness philosophy + universal git hygiene (`.gitattributes`, `.gitignore` baseline).
- **`conventions/line-endings.md`** — read when setting up a new repo (needs `.gitattributes`) or when troubleshooting CRLF symptoms on WSL/Windows (`bad interpreter: /usr/bin/env\r`, "LF will be replaced by CRLF" warnings, formatter churn). Includes the full `.gitattributes` template and a `normalize-line-endings.sh` fixer script for worktrees that already got CRLF'd.
- **`conventions/project-scaffolding.md`** — read when creating a new repo (or wiring the doc system into an existing one). The `.agents/` + `AGENTS.md` + `CLAUDE.md`-shim + human-`README.md` baseline, the `establishing-a-new-project` skill that stamps it, and the three self-maintenance nets (completion skills, the global `doc-parity-gate` hook, the per-project Node validator) that keep those docs in sync.
- **`conventions/documentation.md`** — read when authoring plan docs, spec docs, ticket scratchpads, or any Jira description. Covers `docs/plans/` structure, the project-specific blockquote convention, `docs/tickets/` workflow, Jira Epic structure (required sections, parallelism plan, dependency links), and Jira description authoring (Rovo MCP with ADF, the common node types, and the verify-after-send rule).
- **`conventions/designer-collaboration.md`** — read when preparing a prompt to brief an external design source (typically claude.ai acting as designer) on a new page or redesign.
- **`conventions/node.md`** — read when working in a Node/TypeScript project (signal: `package.json` exists). Covers workspaces, `tsconfig`, ESLint/Prettier configs, standard scripts, testing, and frontend component composition.
- **`conventions/figma.md`** — read before non-trivial Figma work via `use_figma` / the Figma Plugin API. Gotchas the figma-use skill doesn't already cover: auto-layout conversion timing, sticky nested instance overrides, adding variants to existing COMPONENT_SETs, font-binding limitations.
- **`conventions/crew-dispatch.md`** — read when investigating a `crew run <KEY>` failure or planning a dispatch-flow change. Covers: local-CLI-vs-origin/main (a fix on origin/main needs a `git pull` before the next dispatch picks it up), bare worktrees silently no-op `npx <tool>` until `npm install` runs in them, Playwright pins to a specific Chromium revision.
- **`conventions/self-improvement.md`** — read at the start of any non-trivial work, and revisit when wrapping up. The meta-convention: when you encounter a non-obvious behavior or workaround, capture it somewhere durable (usually another file in this directory). Future-you will hit the same thing again unless it's written down.

Each convention file is generic and reusable; project-specific overrides go in that project's own `CLAUDE.md`.
