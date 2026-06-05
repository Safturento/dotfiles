# visual-fidelity-check report — 2026-05-15

**Branch:** CREW-150
**Base:** main
**Touched components:** 2 — `Switch.tsx`, `FormField.tsx`
**Findings:** 0 high, 0 medium, 0 low (0 pre-existing, 0 from this PR)

## Result

Clean pass. Both touched components match their Figma references on all checked properties.

## What was checked

### `packages/dashboard/src/components/ui/Switch.tsx`

- Mapped to Figma `335:242` via `Switch.figma.tsx` (CodeConnect → kebab→snake state name bridge applied)
- **Structural:** thumb-on color = `state/initializing → blue/400` (#60A5FA) ✓; thumb-off color = `muted-foreground → slate/400` (#94A3B8) ✓; track radius 999 ✓
- **Caller:** 2 call sites (`AgentDrawer.tsx`, `AgentFullPage.tsx`) both pass plain `checked`/`onCheckedChange` props — no override styling to fight ✓
- **Visual:** screenshot of agent drawer header's Live switch matches `snapshot/screens/1-1024.png`'s switch position + thumb color in both checked and unchecked states ✓

### `packages/dashboard/src/components/FormField.tsx`

- Mapped to Figma `337:234` via `FormField.figma.tsx`
- **Structural:** label color = `muted-foreground → slate/400` ✓; label font Hanken Grotesk Regular 11.5 ✓; vertical gap 5px ✓
- **Caller:** no live callers yet (the modal screens that consume FormField aren't wired up — out of scope for CREW-150)
- **Visual:** skipped — no live render target. Structural check is sufficient.

## Verification gaps

None.

---

**Proceeding to PR. No follow-ups needed.**
