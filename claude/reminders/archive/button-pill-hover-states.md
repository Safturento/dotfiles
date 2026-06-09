---
name: button-pill-hover-states
scope: project:crew
due: 2026-06-06
created: 2026-06-05
done_when: Button/Pill hover states exist in the Figma DS and the dashboard Pill/Button code
status: done
resolved: 2026-06-06
---

**Resolved 2026-06-06 (commit db7ec81, branch `feat/pill-hover-states`):** Hover states shipped both sides. Code: `pillSurfaceClasses` gained a `hover` flag; `PillBase` derives `interactive = as === 'button' || asChild` and applies a color-agnostic brightness lift (ghost acquires muted surface + brightness-130, muted/mid brightness-125, loud brightness-110) + cursor-pointer/transition — interactive pills only, static spans unchanged. Figma: "Hover states" reference frame (`699:1039`, Composites page) documenting rest→hover per intensity. Bonus: the bespoke "Hide finished" toggle (its own `hover:opacity-80`) was migrated to the DS `Switch`, unifying interactive-chip hover.

---

Item #1 from the 2026-06-05 dashboard worklist, never picked up. **Add optional hover states to the button/Pill sets.** Buttons need them; Pills only when interactable (so it's an *optional* state, not forced on every Pill).

This is **in-session DS work** (Figma DS + code), not a `crew run` dispatch — per the design-work-skips-Jira convention. Two surfaces: the Crew DS Figma file (the unified Pill set) and the dashboard code (`packages/dashboard/src/lib/pill-variants.*` / `components/ui/button.tsx` / `pill-base.tsx`). Brainstorm scope briefly (which intensities/colors get hover, how it reads against the dark theme), then execute in-session with the user as visual judge.

Related followup: `docs/followups.md` "2026-05-12 — Explore intensity-axis for Button" (different axis, but same component family — check before scoping).
