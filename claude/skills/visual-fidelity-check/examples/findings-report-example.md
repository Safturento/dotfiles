# visual-fidelity-check report — 2026-05-12

**Branch:** CREW-135
**Base:** main
**Touched components:** 6 — `ui/button.tsx`, `ui/badge.tsx`, `ui/tag.tsx`, `lib/pill-variants.ts`, `AgentRow.tsx`, `AgentBody.tsx`, `TopNav.tsx`
**Findings:** 3 high, 2 medium, 0 low (0 pre-existing, 5 from this PR)

## High-severity findings

### Finding 1: State badges use `intensity="muted"` (no border) where Figma uses `intensity="mid"` (1px state-colored stroke)

- **Kind:** caller
- **File(s):**
  - `packages/dashboard/src/components/AgentRow.tsx:67-69`
  - `packages/dashboard/src/components/AgentBody.tsx:65-72`
- **Code (AgentRow.tsx:67-69):**
  ```tsx
  <Badge role="status" aria-label={meta.label} color={agent.state} intensity="muted" hasIcon>
    {meta.label}
  </Badge>
  ```
- **Figma reference:** snapshot node `1:756` (agent drawer screen) shows pill with visible 1px stroke in state color. Pill set's `intensity=muted` variant in `snapshot/composites/272-120.json` has `strokes: []`; `intensity=mid` adds `stroke: slate/500` (and equivalent per color).
- **Diff:** code passes `intensity="muted"` → emits `bg-slate-1050 text-slate-400` (no border class). Figma intends `intensity="mid"` → should emit `bg-slate-1050 border border-slate-500 text-slate-400`.
- **Fix:** change `intensity="muted"` to `intensity="mid"` in both files (AgentRow.tsx:67 + AgentBody.tsx:65).

### Finding 2: Clear attention button has an outer border; Figma frame has none

- **Kind:** caller
- **File(s):** `packages/dashboard/src/components/TopNav.tsx:37-43`
- **Code:**
  ```tsx
  <Button
    color="running"
    intensity="mid"
    size="xs"
    onClick={onClearAttention}
    disabled={attentionCount === 0}
    className="border-white/10 text-muted-foreground hover:bg-popover disabled:opacity-40"
  >
  ```
- **Figma reference:** `snapshot/composites/243-120.json` (Clear attention composite) shows outer frame with `fills: []`, `strokes: []`. No outer border.
- **Diff:** code's `intensity="mid"` emits `border border-slate-500`, then the `className="border-white/10 ..."` override changes the color to white/10. Figma intends no border at all. The composite is functionally a button but visually a borderless frame — closest Button mapping is `color="running" intensity="ghost"`.
- **Fix:** change `intensity="mid"` to `intensity="ghost"`. Drop the stale `border-white/10 text-muted-foreground hover:bg-popover` className override (the system handles those concerns now).

### Finding 3: Clear attention count pill is loud (solid amber) where Figma is mid (hollow with stroke)

- **Kind:** caller
- **File(s):** `packages/dashboard/src/components/TopNav.tsx:47-49`
- **Code:**
  ```tsx
  <Badge color="waiting" intensity="loud" className="font-semibold">
    {attentionCount}
  </Badge>
  ```
- **Figma reference:** `snapshot/composites/243-120.json` child `332:230` (count-pill) → mainComponent `type=pill, color=waiting, intensity=mid`. Renders amber-1050 bg + amber/500 1px stroke + amber/400 text.
- **Diff:** code's `intensity="loud"` emits solid amber-400 bg with dark text — visually a different treatment. Figma's `intensity="mid"` is the hollow look with stroke.
- **Fix:** change `intensity="loud"` to `intensity="mid"`.

## Medium-severity findings

### Finding 4: `pillSurfaceClasses('white', 'loud')` uses `bg-neutral-200` (#E5E5E5) where Figma uses `zinc/50` (#FAFAFA)

- **Kind:** structural (helper-level)
- **File(s):** `packages/dashboard/src/lib/pill-variants.ts:9-13`
- **Code:**
  ```ts
  const WHITE_CLASSES: StateClassTokens = {
    text: 'text-slate-950',
    bg: 'bg-neutral-200',       // ← #E5E5E5
    border: 'border-slate-500',
    solidBg: 'bg-neutral-200',  // ← #E5E5E5
    solidBorder: 'border-slate-500',
  };
  ```
- **Figma reference:** `snapshot/composites/272-120.json` variant `type=button-sm, color=white, intensity=loud` has `fills: [{ hex: "#FAFAFA", tokenAlias: "zinc/50" }]`. Notably dimmer in code (~6.5% reflectance delta — visible).
- **Diff:** code's neutral-200 is darker than Figma's zinc-50. The "+ New Run" button in the dashboard appears subtly dim.
- **Fix:** change `WHITE_CLASSES.solidBg` from `'bg-neutral-200'` to `'bg-zinc-50'`. Optionally also align `WHITE_CLASSES.text` from `'text-slate-950'` to `'text-zinc-950'` (Figma uses zinc/950 #09090B; slate/950 #020617 is visually indistinguishable — acceptable substitution).

### Finding 5: View PR / Open as page use Unicode arrow instead of `lucide/arrow-up-right` SVG

- **Kind:** caller
- **File(s):**
  - `packages/dashboard/src/components/AgentRow.tsx:117-122` (View PR action)
  - `packages/dashboard/src/components/AgentBody.tsx:85-90` (View PR + Open as page)
- **Code (AgentRow.tsx:117-122):**
  ```tsx
  <Button color="running" intensity="mid" size="xs" asChild>
    <a href={agent.prUrl ?? '#'} target="_blank" rel="noreferrer" onClick={stop}>
      View PR ↗
    </a>
  </Button>
  ```
- **Figma reference:** View PR pill instance uses `Has Icon=true, Icon=lucide/arrow-up-right`. SVG has controlled stroke + matches text color exactly.
- **Diff:** code uses Unicode U+2197 ("↗") which is a text glyph rendered by the browser's font fallback. Stroke weight, color, and metrics don't match Figma's icon.
- **Fix:** replace Unicode with SVG: `import { ArrowUpRight } from 'lucide-react';` then `<a><ArrowUpRight aria-hidden /> View PR</a>`. The Button base class `[&_svg:not([class*='size-'])]:size-4` already handles SVG sizing.

## Low-severity / judgment-call findings

### Note A: State badge dot is a CSS-only span, not an SVG icon

`badge.tsx:43-49` renders `<span h-1.5 w-1.5 rounded-full bg-{color}>` (6×6 filled circle). Figma's Pill set has an Icon INSTANCE_SWAP defaulting to `lucide/git-pull-request` (set-level default, not what state-badge instances use). Visual end-result is "a small colored dot" in both cases. **Not flagging as a finding** — visually equivalent for the use case, and matching Figma's primitive exactly would require refactoring Badge to accept an icon component. Note for future iteration.

## Verification gaps

- Rendered screenshot capture not run (dashboardUrl skipped this run); structural + caller checks sufficient for the findings above. The user's remote-control screenshot of CREW-135's actual rendered state confirms Finding 1 (no visible badge borders) and Finding 3 (solid yellow count pill).

---

**Findings 1–5 must be fixed before claiming this task complete.** Re-run the gate after fixing.
