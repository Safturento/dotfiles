# Documentation conventions

Applies to any project. Read when authoring plan docs, ticket scratchpads, or design specs.

## `docs/plans/` — durable design decisions

Notable design decisions — the kind that would take a long conversation to arrive at again — are written up as markdown docs in `docs/plans/`. One file per topic, named after the decision (e.g., `service-layer-and-di.md`, `hybrid-config.md`), not after the project or the date.

Every planning conversation that produces a real design decision should end with a plan doc either created or updated in that folder. The plan-mode file at `~/.claude/plans/*.md` is ephemeral and gets overwritten by the next planning session — treat copying the approved content into `docs/plans/` as part of completing the plan.

### Plan doc structure

Plans should read usefully in a different codebase, not just this one. Use this structure:

1. **Context** — the generic problem/pressure that motivates this kind of change. What signals tell you it's time? When is it premature?
2. **Options considered** — alternatives with pros/cons, written generically. Include options that weren't chosen; the reasoning is as valuable as the conclusion.
3. **Recommendation by context** — which option fits which situation (project size, team size, stage, constraints). A solo hobby project and a 30-engineer product don't want the same answer.
4. **Chosen approach** — what was picked for *this* project, and the reasoning that tipped it. The one section that's inherently project-flavored.
5. **Implementation outline** — concrete steps. Generic where possible; specific where necessary.
6. **Verification** — how to confirm it works end-to-end.
7. **Non-goals** — explicitly out of scope, so future readers don't re-litigate.
8. **Forward path** — what the next evolution looks like if the chosen approach outgrows itself.

### Marking project-specific content

Anything tied to one repo specifically — file paths, exact package versions, command names, existing architectural choices the reader wouldn't have — must be marked so future readers (in a different project) can tell what transfers and what doesn't. Use a blockquote prefixed with `**Project-specific:**`:

```markdown
> **Project-specific:** In this repo, the services live under `packages/backend/src/services/` and register in `container.ts`.
```

Everything outside those blockquotes should read as useful guidance to a reader on a different project. If a paragraph is entirely project-specific, wrap the whole thing in the blockquote; don't bury generic wisdom inside it.

### When to reference a plan

Before starting work that matches one of the plan topics, read the relevant plan in `docs/plans/`. The plans encode decisions — if you're about to re-litigate one, either you've found a reason the plan is wrong (update it) or you're duplicating past reasoning (don't).

## `docs/tickets/` — ephemeral working scratchpads

One file per ticket, named by the key (e.g., `docs/tickets/KAN-3.md`). Working-context scratchpads — decisions made mid-implementation, files touched, open questions, dead ends ruled out. Not a duplicate of the ticket tracker (Jira remains the source of truth for scope, acceptance criteria, and status).

Workflow:

1. When the user names a ticket, read `docs/tickets/<KEY>.md` if it exists.
2. If the ticket is non-trivial and the file doesn't exist, offer to create one. A `_template.md` in the same folder is useful if you find yourself re-deriving the structure.
3. If scope/comments matter and the user confirms, pull the live ticket via the Atlassian MCP tools (`mcp__atlassian__jira_get_issue`).
4. As work progresses, append notable decisions, ruled-out approaches, and open questions. It's a living doc, not write-once.

When a ticket ships, durable knowledge graduates: design-level decisions go to `docs/plans/`, change rationale goes into the commit message / PR description. The ticket file itself can be deleted or pruned — it's intentionally short-lived.

Don't create a ticket file for one-shot work that finishes in a single session. The signal: "would we forget this if we paused for a week?" — if no, skip it.

## `docs/designs/` — visual hand-offs

When a project has a visual hand-off — typically generated from `claude design` (frontend-design skill) or a similar source — it lives in `docs/designs/<topic>/` with this shape:

- `README.md` — the visual contract: design tokens, component anatomy, behavior contracts, layout rules. The authoritative source for what the UI should look and feel like.
- `source/` — reference implementation (JSX, HTML, CSS, etc.). Use as visual ground truth, **not verbatim**. The reference may use libraries or patterns that don't fit the project's component layer; the README is what binds, the source is what you check fidelity against.

### Citing the hand-off in plans and tickets

When authoring a plan, spec, or ticket for a surface covered by a hand-off:

1. **Plan / spec docs MUST cite the hand-off inline** — link to `docs/designs/<topic>/README.md` in the inputs / required-reading section, and reference specific sections of the README when describing component anatomy or layout decisions.
2. **Per-component implementation tickets MUST link to the relevant hand-off section** in their description. The visual contract is part of acceptance criteria, not just background reading.
3. The reference implementation in `source/` is for visual verification only. Don't ship it verbatim, and don't paste fragments into the code as comments — the README is the durable contract.

### Why this matters

Textual specs describe components in prose; visual hand-offs describe them as a contract. Skipping the hand-off citation means tickets ship against the prose alone, and the visual contract drifts silently. Easy to miss because the prose can sound complete on its own — the gap only surfaces when the user opens the dashboard and compares to the design they remember asking for.

If you're authoring a plan and a `docs/designs/` folder exists for the surface in question, treat citing it as a non-negotiable input — same weight as citing the spec doc.

## Branch naming for doc-only PRs

Plan docs, spec docs, design docs, and standalone followup entries don't have a Jira key at the time they're committed — the ticket gets created *from* the plan, or never (followups can stand alone). That makes the project's keyed-branch convention (`CREW-23`, `KAN-7`) a bad fit for these PRs.

**Convention:** name the branch `docs/<descriptive-kebab-slug>`. Slug describes the document's topic, not the surrounding initiative or date.

Examples observed in practice:

- `docs/slice-1c-design` — design spec for a feature slice
- `docs/crew-dockerization-plan` — implementation plan for an Epic
- `docs/crew-dockerization-spec` — paired spec doc, separate PR
- `docs/agent-dispatch-preflight` — design doc that hadn't been ticketed yet
- `docs/followup-model-selection` — single `followups.md` entry that warranted its own PR
- `docs/followup-mcp-playwright-chrome-path` — same shape, different topic

When the work *is* keyed to a specific ticket — e.g., `docs/tickets/CREW-23.md` scratchpad updates landing alongside CREW-23's implementation, or a `docs/mumen/<slug>.md` artifact tied to a Jira-backed Mumen ticket — use the keyed branch. The `docs/<slug>` prefix is for PRs whose entire payload is documentation that pre-dates or stands outside any single ticket.

## Jira Epic structure

When a piece of work breaks down into multiple tickets, model it as one **Epic** + N child tickets in Jira. The Epic is the place future-you (and any other reader) reconstructs *why* this initiative existed, *what* was decided, and *how* the pieces relate. Treat the Epic description as the durable surface — chat history evaporates, comments scatter, but the Epic description survives and gets surfaced wherever Jira data is rendered (dashboards, reports, MCP fetches).

### Required sections

Every Epic description includes, in this order:

1. **One-paragraph summary** — what the initiative does, in plain language. No jargon a future reader (possibly on a different project) wouldn't recognize.
2. **Background / motivation** — why now? What signal or incident prompted this? If a specific transcript, ticket, or PR drove the decision, name it (e.g. `CREW-24` or `KAN-37`).
3. **Inputs** — links to the spec doc, plan doc, and any branch where they live (`docs/superpowers/specs/…`, `docs/superpowers/plans/…`, branch name).
4. **Architecture summary** — 2–4 sentences on the chosen approach. Enough that a reviewer can sanity-check whether a child ticket they're about to pick up still aligns with the design.
5. **Child tickets** — each child listed with its key, a one-line description, and its plan-task reference. Even if you'd otherwise rely on Jira's parent/child links, restating the children inline gives the description a self-contained narrative.
6. **Parallelism plan** *(see below — this is the section most often omitted; don't skip it)*.
7. **Definition of done** — observable outcomes, not implementation details. What's the smoke test that the Epic is shippable?
8. **Out of scope** — explicit non-goals. Future-you will try to re-litigate these; pre-empt it.

### The parallelism plan

The parallelism plan goes **inside the Epic description**, not just in chat. It's the section that tells future-you (and any tool that surfaces Epics) the optimal order to run the children. Without it, the dependency edges in Jira tell you what *can* run in parallel but not what *should*.

Required content:

- **Phase table** — markdown table with columns `Phase | Tickets | Sequence`. Each row covers one parallel-eligible group, in execution order. Use the actual ticket keys (e.g. `CREW-28`), not descriptive names — the keys link automatically in most Jira renderers and are searchable.
- **Recommended sequence** — one line stating the practical order, e.g. `crew run CREW-28 → wait for merge → crew run CREW-29 and CREW-30 in parallel worktrees`. This is the line a human copy-pastes when starting work.
- **Tradeoffs considered** — at minimum, the bundling tradeoff: *why is this split into N tickets instead of one mega-ticket?* and, if relevant, *why not bundle two of the children?* Future-you will second-guess the split; pre-empt that.

### Dependency links

After creating the children, add Jira `blocks` / `is blocked by` links between any pair where one must finish before the other starts. The phase table tells humans what to run when; the link metadata tells tooling. Both should agree.

### Updating the Epic mid-flight

If scope changes — a child ticket is split, a new dependency is discovered, the parallelism plan turns out wrong — update the Epic description, not just the chat. The Epic is the durable surface; chat is not.

### When to skip

Don't make an Epic for a single ticket's worth of work — Jira's parent/child machinery is overhead the work doesn't need. The signal: if there's no parallelism choice to document and no architecture summary worth writing, you're describing a single Task, not an Epic.

## Authoring Jira descriptions

Applies to every Jira description (Epics, Tasks, Bugs) authored programmatically. **Use the Rovo MCP server with `contentFormat: "adf"` exclusively.** Do not use the simpler Atlassian MCP's markdown path for descriptions — that path goes through markdown → wiki-markup conversion which mangles language hints, escapes underscores in code identifiers, drops nested-list nesting, and silently degrades on any subsequent UI edit. Reserve the simpler MCP for non-description fields (assignee, status transitions, labels, etc.) where wiki conversion isn't in play.

ADF (Atlassian Document Format) is Jira's canonical storage format — the same format the web UI editor reads and writes. Sending it directly gives full programmatic fidelity and round-trip stability across UI edits.

### The call shape

Create:

```
mcp__claude_ai_Atlassian_Rovo__createJiraIssue
  cloudId: "https://safturento.atlassian.net"   # site URL works as cloudId
  projectKey: "CREW"
  issueTypeName: "Task"
  summary: "..."
  description: <ADF doc> | string
  contentFormat: "adf"
  additional_fields: { labels: [...], priority: { name: "Medium" }, ... }
```

Edit:

```
mcp__claude_ai_Atlassian_Rovo__editJiraIssue
  cloudId: "https://safturento.atlassian.net"
  issueIdOrKey: "CREW-67"
  contentFormat: "adf"
  fields: {
    description: { version: 1, type: "doc", content: [ ...adf nodes... ] }
    # any other fields to update
  }
```

The `description` value is an ADF JSON object, not a stringified blob. Pass it as a real object via the `fields.description` parameter.

### Common node types

The 90% case fits inside this set. Examples below show one node each — compose them in the doc's `content` array.

**Heading** (use levels 2 and 3; Jira reserves level 1 for the ticket title):

```json
{ "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Reproduction" }] }
```

**Paragraph with mixed inline marks** (`code`, `strong`, `em`):

```json
{ "type": "paragraph", "content": [
  { "type": "text", "text": "Calls " },
  { "type": "text", "text": "writeMcpFile", "marks": [{ "type": "code" }] },
  { "type": "text", "text": " on the worktree and asserts " },
  { "type": "text", "text": "result.existed", "marks": [{ "type": "code" }] },
  { "type": "text", "text": " is " },
  { "type": "text", "text": "true", "marks": [{ "type": "strong" }] },
  { "type": "text", "text": "." }
]}
```

**Code block with language hint** (drives syntax highlighting in the rendered view):

```json
{ "type": "codeBlock", "attrs": { "language": "typescript" }, "content": [
  { "type": "text", "text": "const x = 1;\nconst y = x || 0;" }
]}
```

`language` accepts standard names: `typescript`, `javascript`, `python`, `bash`, `json`, `sql`, `yaml`, `markdown`, etc. Omit `attrs.language` (or set to `null`) for plain preformatted text. Shell sessions can use `bash` or no language.

**Bullet list with nesting**:

```json
{ "type": "bulletList", "content": [
  { "type": "listItem", "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "outer" }] },
    { "type": "bulletList", "content": [
      { "type": "listItem", "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "nested" }] }
      ]}
    ]}
  ]}
]}
```

For ordered lists, swap `bulletList` → `orderedList`. Same structure.

**Table** (header row + body rows; cells can hold any block content):

```json
{ "type": "table", "content": [
  { "type": "tableRow", "content": [
    { "type": "tableHeader", "content": [
      { "type": "paragraph", "content": [{ "type": "text", "text": "Pattern" }] }
    ]},
    { "type": "tableHeader", "content": [
      { "type": "paragraph", "content": [{ "type": "text", "text": "Effect" }] }
    ]}
  ]},
  { "type": "tableRow", "content": [
    { "type": "tableCell", "content": [
      { "type": "paragraph", "content": [
        { "type": "text", "text": "EOL_CHAR", "marks": [{ "type": "code" }] }
      ]}
    ]},
    { "type": "tableCell", "content": [
      { "type": "paragraph", "content": [
        { "type": "text", "text": "Renders code in cell, plus " },
        { "type": "text", "text": "bold", "marks": [{ "type": "strong" }] },
        { "type": "text", "text": " inline." }
      ]}
    ]}
  ]}
]}
```

Inline marks (`code`, `strong`, `em`, `link`) work inside cells.

**Hyperlink** (link mark on a text node):

```json
{ "type": "text", "text": "PR #62", "marks": [{ "type": "link", "attrs": { "href": "https://github.com/Safturento/crew/pull/62" }}] }
```

For more node types (panels, expand, blockquote), see Atlassian's ADF spec — but the set above covers nearly every ticket.

### Verify after every send

Always fetch back via Rovo immediately after a create or edit:

```
mcp__claude_ai_Atlassian_Rovo__getJiraIssue
  cloudId: "..."
  issueIdOrKey: "..."
  responseContentFormat: "adf"
  fields: ["description"]
```

Compare the returned ADF structure to what was sent. Acceptable diffs: Jira adds `localId` attributes to most nodes (cosmetic, generated server-side, ignore them). Anything else — missing nodes, mark loss, escaped chars in code blocks — means something went wrong and the rendered view will be broken. Fix and re-send.

### What NOT to do

- Don't use `mcp__atlassian__jira_create_issue` / `..._update_issue` for descriptions. That path mangles language hints, escapes underscores in identifiers, and degrades on UI edit. The simpler MCP is fine for non-description fields.
- Don't pass the description as a stringified JSON blob — it must be the JSON object directly.
- Don't include `localId` attributes in your input. Jira generates them; they're returned on fetch but ignored on send.
- Don't try to use markdown shorthand inside ADF text nodes (`**bold**` won't be parsed as bold — text content is literal). Use the `marks` array on the text node to apply formatting.

## Plan vs ticket vs commit

Three places durable thought lives, in decreasing order of permanence:

| Surface | Lifespan | Audience | Belongs here |
|---|---|---|---|
| `docs/plans/` | Indefinite | Future contributors (incl. on other projects) | Design decisions, architectural rationale, options considered |
| `docs/tickets/<KEY>.md` | Until the ticket ships | This week's me | Mid-flight decisions, files touched, dead ends |
| Commit / PR description | Forever, but in `git log` | Reviewer + future archaeologist | Why this change exists, how it differs from what was there |

When something graduates from one tier to the next, remove it from the lower tier. Don't leave duplicates.
