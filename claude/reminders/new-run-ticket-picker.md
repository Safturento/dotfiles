---
name: new-run-ticket-picker
scope: project:crew
created: 2026-06-05
done_when: New Run ticket-picker epic is brainstormed → spec → plan → ticketed (or explicitly deferred)
status: active
---

Item #7 from the 2026-06-05 dashboard worklist — the biggest of the batch, only ever captured as a followup. **Plan the New Run → Jira ticket picker.** Needs the full brainstorm → spec → plan → tickets flow (and likely its own Epic).

Scope from the original ask:
- When a project is selected in the New Run dialog, fetch its available Jira tickets (number + name to start) from the board — **Ready for Development only** for now.
- Group tickets by their parent Epic.
- Parse the **execution/dependency graph** to show which tickets are actually *runnable* now (dependency trees, parallelism) vs blocked.
- The input box becomes a **search filter** over the ticket list; click a ticket to select it (like the "Pick a project" menu).

Key constraints to work through at brainstorm:
- The Jira client lives in **CLI only** (`packages/cli/src/lib/jira/client.ts`) and has **no JQL/search** — only `getIssue`/`getTransitions`/`transition`. The daemon (which the dashboard talks to) has no Jira access. So this needs a daemon-reachable Jira search path + an endpoint serving Ready-for-Dev tickets grouped by epic with runnability computed from dependency links.
- Replaces the current free-text step 2 in `NewRunModal.tsx` (followup: `docs/followups.md` "2026-06-04 — New Run modal step 2 is a text entry, not the Figma open-ticket picker").

Per the "park planning intentions in Jira" convention this should likely become a **needs-planning Epic** (like CREW-235) at the start of the session — offer to create it before brainstorming.
