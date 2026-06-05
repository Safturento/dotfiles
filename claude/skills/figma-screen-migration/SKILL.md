---
name: figma-screen-migration
description: >-
  Use when migrating a Figma frame full of hardcoded fills + flattened/detached
  primitive structures (typically from html.to.design imports) onto a published
  design system — binding raw RGB values to semantic tokens and swapping
  detached pill/button/card structures for component instances. Triggers on
  phrases like "migrate this Figma frame to design system", "bind these
  hardcoded colors to tokens", "swap detached pills to component instances", or
  when an audit shows boundPct === 0% on a frame in a file with a linked design
  system. One-time bootstrap per frame; once migrated, future DS-component
  changes flow through figma-design-system-propagation. Sibling skill —
  figma-design-system-propagation (the lifecycle/verification skill that
  handles all the cross-cutting traps).
---

# Figma screen migration

A bootstrap workflow: take a frame imported with hardcoded fills + detached pill/button/card structures, bind every fill to a semantic token, swap every detached structure for a real component instance.

The work is mechanical *if* you do it in the right order and avoid creating instance-level overrides during the binding pass. The traps that bite — publish lifecycle, override stickiness, mode propagation, screenshot divergence — live in the **figma-design-system-propagation** skill. **REQUIRED SUB-SKILL: read figma-design-system-propagation before starting any migration.** This skill assumes you're managing those traps via that skill.

## Project context — read first

Before any migration, read the project's `docs/plans/design-system.md` (or equivalent). It carries:

- **Figma file URLs** — source DS file, screens file
- **Override-collection name** (e.g. `Crew / Semantic Colors`) and source-collection it aliases to
- **Component IDs/keys** for the composites you'll be swapping into (e.g. `StateBadge=20:23`)
- **Canonical visual patterns** if documented (e.g. tinted-pill: `bg opacity 0.18 + matching-color border/dot/text at full opacity`)

The project doc is authoritative for project-specific names and intent. This skill teaches the mechanics.

## Four phases, in order

```
1. Audit (read-only)        →  understand scope, build the ruleset
2. Set modes (cross-collection) → ensure the frame renders as intended
3. Bind colors              →  walk fills, apply ruleset, SKIP nodes inside future instances
4. Swap composites          →  detached structures → real component instances
```

Then verify per the propagation skill's checklist.

## Phase 1 — Audit

```js
const frame = await figma.getNodeByIdAsync(FRAME_ID);

// Detached pills (whatever name your project uses — typically "Overlay+Border" from html.to.design)
const detachedPills = frame.findAll(n => n.type === "FRAME" && n.name === "Overlay+Border").length;

// Existing DS instances (separate by source library if mixed)
let dsInstances = 0;
for (const inst of frame.findAll(n => n.type === "INSTANCE")) {
  const main = await inst.getMainComponentAsync();
  if (main?.parent?.type === "COMPONENT_SET") dsInstances++;
}

// Fill binding stats
let total = 0, bound = 0;
for (const n of frame.findAll(n => "fills" in n && Array.isArray(n.fills))) {
  for (const f of n.fills) {
    if (f.type !== "SOLID") continue;
    total++;
    if (f.boundVariables?.color) bound++;
  }
}

return { detachedPills, dsInstances, fillStats: { total, bound, boundPct: Math.round(bound/total*100) } };
```

A fresh import returns `{ detachedPills: 5-15, dsInstances: 0, boundPct: 0 }`. If `boundPct > 50` you're not on a fresh import — confirm with the user.

**Tally unique color buckets** to inform the ruleset:

```js
const tally = new Map();
for (const n of frame.findAll(n => "fills" in n && Array.isArray(n.fills))) {
  for (const f of n.fills) {
    if (f.type !== "SOLID" || f.boundVariables?.color) continue;
    const r = f.color.r.toFixed(3), g = f.color.g.toFixed(3), b = f.color.b.toFixed(3);
    const a = (f.opacity ?? 1).toFixed(2);
    const ctx = n.type === "TEXT" ? "T" : "C";  // text vs container — same RGB can map to different tokens
    const key = `${r},${g},${b}|${a}|${ctx}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
}
return [...tally.entries()].sort((a,b) => b[1]-a[1]).slice(0, 50);
```

Frames typically have 30–60 unique color buckets. The top-15 cover ~80% of fills.

## Phase 2 — Set modes (cross-collection or single, depending on project DS)

This is Trap 2 in figma-design-system-propagation. The default rule: do not skip the source-collection step. Even if you only see your override collection in the linked-libraries list, the frame's mode resolution chains through the source collection it aliases to — set explicit mode on **both** or the frame will render in the wrong mode despite the explicit override looking correct.

See figma-design-system-propagation Trap 2 for the alias-chain walking snippet.

**Exception — single-collection mode chain.** If the project's design system aliases its override layer **directly** to mode-invariant primitives (single-mode collections like `tw/colors`), Phase 2 only needs to set mode on the override collection — no chain-walking needed. Check the project's `docs/plans/design-system.md` for the Mode resolution subsection. Crew DS uses this simplified pattern as of 2026-05-10 (CREW-127 palette correction).

**How to tell which pattern applies:** import any override variable, inspect its `valuesByMode[anyModeId].id`, fetch that variable, look at its collection's `modes.length`. `1` → single-collection chain (just set the override collection's mode). `>= 2` → multi-collection chain (walk per Trap 2).

## Phase 3 — Bind colors via context-aware ruleset

Build a `r,g,b|alpha` → token ruleset from the audit's color tally:

```js
// Rule shape: either { token } for context-agnostic, OR { tokenIfText, tokenIfContainer }
const RULES = [
  // Surfaces
  { key: "0.067,0.094,0.153|1.00", token: "background" },
  { key: "0.106,0.133,0.192|1.00", token: "card" },

  // Text/on-bg pairs (same RGB, different roles)
  { key: "0.906,0.910,0.925|1.00", tokenIfText: "foreground", tokenIfContainer: "primary" },
  { key: "0.494,0.510,0.565|1.00", tokenIfText: "muted-foreground", tokenIfContainer: "muted-foreground" },

  // Borders (white at low opacity)
  { key: "1.000,1.000,1.000|0.06", token: "border" },

  // State colors — full opacity for full bg, low opacity for tinted bgs
  { key: "0.956,0.736,0.000|1.00", token: "state/waiting" },
  { key: "0.956,0.736,0.000|0.18", token: "state/waiting" },
  // ... etc
];
const rulesByKey = new Map(RULES.map(r => [r.key, r]));

let bound = 0, seen = 0;
for (const node of frame.findAll(n => "fills" in n && Array.isArray(n.fills))) {
  if (node.fills.length === 0) continue;

  // CRITICAL: skip nodes inside detached structures you're about to swap to instances.
  // Binding fills inside them creates instance-level overrides downstream — see propagation Trap 5.
  let cur = node, skipForFutureSwap = false;
  while (cur && cur.id !== frame.id) {
    if (cur.name === "Overlay+Border") { skipForFutureSwap = true; break; }
    if (cur.type === "INSTANCE")       { skipForFutureSwap = true; break; }
    cur = cur.parent;
  }
  if (skipForFutureSwap) continue;

  let changed = false;
  const newFills = node.fills.map(f => {
    if (f.type !== "SOLID") return f;
    seen++;
    if (f.boundVariables?.color) return f;
    const key = `${f.color.r.toFixed(3)},${f.color.g.toFixed(3)},${f.color.b.toFixed(3)}|${(f.opacity ?? 1).toFixed(2)}`;
    const rule = rulesByKey.get(key);
    if (!rule) return f;
    const tokenName = rule.token || (node.type === "TEXT" ? rule.tokenIfText : rule.tokenIfContainer);
    if (!tokenName || !importedTokens[tokenName]) return f;
    bound++;
    changed = true;
    return figma.variables.setBoundVariableForPaint(f, "color", importedTokens[tokenName]);
  });
  if (changed) node.fills = newFills;
}
```

Pre-import every needed token via `importVariableByKeyAsync` before this loop. `setBoundVariableForPaint` **preserves the source paint's opacity** — a fill at opacity 0.18 stays at 0.18 after binding. That's correct behavior.

**Acceptance:** ~95%+ bound is realistic in one pass. Don't chase 100% — long-tail unmatched is one-off opacity variants and accents. Reuse the same ruleset across sibling frames in the same screens file (~90% overlap).

## Phase 4 — Swap composites (two-pass to avoid stale refs)

If you iterate `frame.findAll(...)` and mutate (insert + remove) inside the loop, sibling nodes can become invalid mid-loop, producing `"The node with id X does not exist"` errors. **Two-pass mandatory.**

```js
// Pre-load fonts (instances contain text)
const fonts = new Set();
for (const t of figma.currentPage.findAll(n => n.type === "TEXT")) {
  for (let i = 0; i < t.characters.length; i++) {
    const f = t.getRangeFontName(i, i + 1);
    if (typeof f === "object" && f.family) fonts.add(JSON.stringify(f));
  }
}
for (const fs of fonts) await figma.loadFontAsync(JSON.parse(fs));

const set = await figma.importComponentSetByKeyAsync(STATE_BADGE_KEY);
const variants = {};
for (const v of set.children) {
  const m = v.name.match(/state=(\S+)/);
  if (m) variants[m[1]] = v;
}

function textToState(text) {
  // Handles "PR open" / "pr open" → "pr-open"
  const t = text.trim().toLowerCase().replace(/\s+/g, "-");
  return t in variants ? t : null;
}

// PASS 1 — collect plans (no mutations, snapshot location upfront)
const pills = frame.findAll(n => n.type === "FRAME" && n.name === "Overlay+Border");
const plans = [];
for (const pill of pills) {
  // Skip pills already inside an instance (prior migration partial)
  let p = pill.parent, insideInstance = false;
  while (p && p.id !== frame.id) {
    if (p.type === "INSTANCE") { insideInstance = true; break; }
    p = p.parent;
  }
  if (insideInstance) continue;

  const texts = pill.findAll(n => n.type === "TEXT");
  if (texts.length === 0) continue;
  const state = textToState(texts[0].characters);
  if (!state) continue;

  plans.push({
    pillId: pill.id, parentId: pill.parent.id, state,
    parentLayoutMode: pill.parent.layoutMode,
    pillX: pill.x, pillY: pill.y,
  });
}

// PASS 2 — mutate (re-fetch each by ID; never reuse Pass 1 node refs)
const swapped = [];
for (const plan of plans) {
  const pill = await figma.getNodeByIdAsync(plan.pillId);
  if (!pill) continue;
  const parent = await figma.getNodeByIdAsync(plan.parentId);
  if (!parent) continue;

  const inst = variants[plan.state].createInstance();
  const idx = parent.children.indexOf(pill);
  parent.insertChild(idx >= 0 ? idx : parent.children.length, inst);
  if (!plan.parentLayoutMode || plan.parentLayoutMode === "NONE") {
    inst.x = plan.pillX;
    inst.y = plan.pillY;
  }
  pill.remove();
  swapped.push(plan.state);
}
```

## Verification

Run figma-design-system-propagation's **Required checklist** in full:

- [ ] All 4 phases above complete with no errors
- [ ] `boundPct >= 95` on the migrated frame
- [ ] `findAll(n => n.name === "Overlay+Border")` returns empty
- [ ] Frame's `explicitVariableModes` includes **both** override + source collections at the intended mode (propagation Trap 2)
- [ ] Verified via MCP `get_screenshot` tool, NOT inline `node.screenshot()` (propagation Trap 3)
- [ ] No instance has solid-color blocks where readable text should be (propagation Trap 1 — override stickiness)

## Common rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll just bind everything, swap later, fix overrides if they happen" | The override stickiness is hard to clear after the fact. Skip soon-to-be-swapped structures during binding. |
| "Setting mode on the override collection should be enough" | Not when the override aliases to a source collection. Set both — see propagation Trap 2. |
| "I can iterate `findAll` and mutate in the loop, it'll be fine" | Stale node refs mid-loop. Two-pass mandatory. |
| "Inline `node.screenshot()` confirms it looks right" | Inline render lies. MCP `get_screenshot` for verification — see propagation Trap 3. |
| "100% bound or it's not done" | 95%+ is realistic and sufficient. Long-tail unmatched is fine. |
