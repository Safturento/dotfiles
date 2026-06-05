# Designer collaboration conventions

Applies when briefing an external design source — typically a separate Claude conversation acting as designer at claude.ai, but the principles transfer to any returning design collaborator — on a new page or redesign.

## Treat them as a returning collaborator, not a fresh contractor

When the designer has already produced work for this project, treat them that way:

- **Don't re-explain the design system.** No bullet list of color tokens, no enumeration of UI primitives, no font names. They wrote those.
- **Reference prior handoffs by their numbering or topic** (e.g. "you've already designed the profile goals editor and the recipe detail page") so they can rehydrate context from their own prior work.
- **Acknowledge live-site drift.** The deployed app has usually nudged away from some original handoffs (color tweaks, slight component rebuilds). When you paste screenshots, explicitly tell them: those are the source of truth for *tokens, type weight, spacing rhythm*; the prior handoffs remain authoritative for *component vocabulary and reuse-vs-extract decisions*.

## Translate filesystem paths at the prompt boundary

Web-based designers (claude.ai/design and similar) don't see your local filesystem. They see hand-off folders by their **root name** in their own UI — e.g. `design_handoff_crew_dashboard/`, not `docs/designs/design_handoff_crew_dashboard/`.

Strip the local prefix when writing paths into the prompt. The designer needs the folder name as it appears to *them*; the `docs/designs/` portion is your local layout, not theirs. The translation happens at the prompt boundary only — implementation tickets, plans, and any doc that an agent reads against the local repo keep the full `docs/designs/...` path.

If unsure, ask the designer (in a previous turn) what root name they see for the hand-off, and use that.

## What to provide (the spec side)

The designer doesn't have ticket-tracker or codebase access, so include things they can't otherwise infer:

- **Route + framing** — the URL, what existing page it mirrors, how the user gets there.
- **The exact API contract** — payload field names, optional vs required, error codes, pagination shape.
- **Non-goals** — what's explicitly *not* in this design pass. Stops them from over-scoping.
- **Framing** — greenfield design vs review-feedback for an in-flight PR. The framing changes how strongly opinionated the output should be.

## Briefing on the implementation stack

Designers are usually strong on visual precision; the gap is often **technical fidelity** — the reference code (JSX/HTML) ships clean visuals but uses idioms that don't match the project's stack, forcing the implementer to rewrite from scratch instead of adapting. The hand-off loses half its value when that happens.

Tell the designer the implementation stack — not as design dictation, but as **idioms the reference code should anticipate**. The visual decisions stay theirs; the technical patterns mirror what the project actually builds with.

What to surface, in roughly this order of impact:

- **Styling layer.** "Use Tailwind utility classes in the reference JSX, mirroring the project's existing Tailwind config (link it). Reach for custom CSS only when Tailwind can't express the visual cleanly."
- **Headless interactive primitives** (popovers, dropdowns, modals, tabs, tooltips, sheets). "Use semantic markup that maps to Radix UI patterns — `<button aria-expanded>` for triggers, `role="dialog"` for modals, focus-trap-aware structure for popovers. The implementer will swap in Radix; reference code that uses raw `<div>`s with click handlers forces a rewrite."
- **Component variants.** "When a component has multiple visual variants or states (sizes, intents, attention levels), expose them as explicit variant props in the reference code (`<Button variant='primary' size='sm' />`). The implementer translates to `cva` directly."
- **Forms.** "Anticipate React Hook Form + Zod. Show visible validation states, named error message slots, and field grouping that maps to a controlled schema. Avoid uncontrolled forms with inline `onChange` validation in the reference."
- **Server state.** "Anticipate TanStack Query — the reference's loading/error/empty states should be three distinct visual paths, since that's what `useQuery` exposes. Don't conflate loading and empty."
- **Toasts / notifications.** "If the design surfaces toasts, use `sonner`'s positioning + variant vocabulary (top-right by default; `success` / `error` / `info` / `warning` variants)."
- **Icons.** Tell them the icon library (`lucide-react`, Heroicons, etc.) so they don't paste in raw SVGs that have to be replaced.
- **State persistence.** Where state lives (URL params, localStorage, server, session-scoped) so reference code's init logic reflects it. "This filter persists in localStorage globally" vs "this filter is URL-driven" produces different reference shapes.

Skip the bullets for things the project doesn't use. Don't enumerate the entire ecosystem — just the layers the designer's reference code will actually express.

## Responsive design is first-class

Mobile and narrow-width layouts are not afterthoughts — the reference should design for them from the start, at the breakpoints the project actually uses. Without this, the hand-off ships one desktop snapshot and the implementer is on their own at every other width.

Tell the designer:

- **The project's breakpoint vocabulary.** Tailwind's `sm` / `md` / `lg` / `xl` / `2xl` if the project uses Tailwind defaults; the custom values if it doesn't.
- **Specific narrow-width constraints.** Drawer minimum width, mobile sheet behaviors, vertical-monitor support, where horizontal scroll is forbidden, etc. — anything the project has explicitly committed to.
- **Required layouts at multiple widths.** Don't ask "make it responsive" generically. Ask for the layout at desktop, tablet, and mobile (or whatever set matches the project's spec). If a component collapses, swaps shape, or repositions across breakpoints, the hand-off should show each state.

If a textual UI spec already documents responsive behavior (e.g. a "§9 Responsive behavior" section in the design brief), reference it by section number — that gives the designer a self-contained contract to design against.

## What NOT to provide

- Layout, density, and progressive-disclosure decisions. Trust them to make those calls.
- Re-statements of the design system, primitives, or tokens.
- A wall of "make sure to use…" reminders. They know.

A prompt that re-explains everything reads as if you're briefing a stranger and undercuts their authority over the design language.

## Output format to ask for

- A numbered handoff folder slot — match their existing convention (commonly `Claude-Design-Handoffs/NN-topic/` or `docs/designs/<topic>/`).
- A rendered mockup (HTML+CSS prototype, screenshot, or Figma frame depending on what the designer produces).
- A short "design notes" bullet list at the end that you can paste verbatim as PR review comments.

## When the designer is fresh (no prior project context)

The above assumes a returning collaborator. For a first-time briefing:

- Provide a short overview of the design system if one exists — tokens, typography, spacing scale, primary primitives — so they can build on it rather than inventing parallel systems.
- Reference any visual influences ("Linear-style minimalism", "Vercel-flavored dark") only as starting points, not as constraints.
- Ask them to settle the design system itself in their first handoff so subsequent ones can build on a stable vocabulary.
