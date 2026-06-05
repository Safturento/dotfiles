# Self-improvement

Read at the start of any non-trivial work, and revisit when you wrap up a task. The aim is to capture learnings as they happen so future-you doesn't re-learn them.

Most of what you encounter is recoverable from documentation, code, or `--help`. Capture only what isn't — the non-obvious behaviors, the API quirks, the workarounds, the wrong-turns that took more than one try to undo.

## Triggers — capture when

- You think "lesson for next time" or "note for future me"
- A bug took more than one wrong-turn to fix
- You had to read documentation or experiment to find the right API/pattern
- A user correction reveals an assumption you got wrong
- You discover a constraint that's not obvious from the API surface
- A tool's behavior surprised you (atomic vs incremental, sticky overrides, etc.)

If any of these fire, **stop and write it down before moving to the next thing**. The user shouldn't have to remind you.

## Where to write it

| What you learned | Where it goes |
| --- | --- |
| Gotcha for a specific tool / library / domain | `~/.claude/conventions/<domain>.md` — create the file if absent; add a one-line entry to the Conventions library in `~/.claude/CLAUDE.md` |
| Project-specific tribal knowledge (history, decisions, contacts) | That project's `CLAUDE.md` / `AGENTS.md`, or a memory entry under the project memory directory |
| How the user prefers to collaborate / corrections they've given | User memory (`feedback_*.md` entries) |
| Tracking external resources (where bugs live, dashboards, etc.) | Reference memory |

When in doubt, prefer conventions > project docs > memory. Conventions are reusable across projects and stay closer to where the work happens.

## Format of a learning entry

Short and scannable. Each entry is a section in the appropriate file:

```markdown
## Short descriptive title (the *symptom*, not the *cause*)

[1-2 sentences: what surprised you and when it happens]

[Bulleted or short paragraph: the workaround or correct pattern. Include a code snippet only when the snippet itself is the answer]
```

Lead with the symptom (`"Frame jumps to wrong size when converting to auto-layout"`) rather than the cause (`"Figma reflows before children are marked ABSOLUTE"`). Future-you will search by symptom.

Keep it terse. Goal is recoverable context, not teaching material.

## Don't capture

- Things easily derivable from reading current code or running `--help`
- Project state that changes frequently (use memory instead)
- Personal opinions or preferences disguised as facts (use feedback memory)
- Tutorial-style explanations — be terse; recoverable context, not a course

## After capturing

- Mention the capture in your current response so the user sees the learning landed somewhere durable ("noted in `conventions/figma.md`")
- Reference the convention in future related work ("per the note in `conventions/figma.md`, …") so the user can tell the captured knowledge is actually being used

## Convention hygiene

When adding a new convention file:

1. Create `~/.claude/conventions/<topic>.md`
2. Start with a single-line trigger ("Read when …")
3. Add a one-line entry to the Conventions library section in `~/.claude/CLAUDE.md` so future-you sees it exists

When an existing convention file grows long, audit it for outdated entries — APIs change, the original lesson may no longer apply. Prune or amend; don't let stale notes accumulate.
