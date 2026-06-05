---
name: figma-design-system-propagation
description: >-
  Use when a design-system component or token change in one Figma file isn't
  visibly propagating to instances in a consumer file (screens, demo file).
  Triggers on symptoms like "instances still render the old version after I
  republished", "the component looks right in DS but wrong where it's used",
  "I set explicit dark mode but the frame is still light", "the screenshot
  shows the fix but the user says it's still broken", "I called resetOverrides
  but the instance still has the old value", or "the binding looks right in
  get_metadata but the screenshot is wrong". Also fires before making a DS
  component or token change you intend to flow downstream — invoke proactively
  to plan the publish + verify steps. Symptom keyword — "stale", "still broken
  after fix", "republished but no change", "mode set but not rendering".
  Sibling skill — figma-screen-migration (the bootstrap migration this skill
  is sometimes invoked from).
---

# Figma design system propagation

A change to a design-system component or token has to clear **four** independent gates before consumers see it:

1. **Publish from the source file** (Figma desktop UI — Plugin API can't do it)
2. **Library cache refresh in the consumer file** (auto on `importComponentSetByKeyAsync`, but verify the cache has your change)
3. **Re-swap each existing instance** (existing instances cache the prior definition; publish does not auto-update them)
4. **Clear or override sticky instance-level overrides** (binding fills inside an instance creates overrides that survive `swapComponent` AND `resetOverrides()` for opacity-style properties)

Skipping any one of these four gates produces the same symptom: "I fixed it, the user still sees the old broken state." The traps below are the four gates plus three adjacent verification gotchas.

## Trap 1 — Paint opacity is sticky / silently dropped across multiple Plugin API operations

This is the single biggest source of "I fixed it but it's still wrong" in DS work. Three independent APIs all silently fail to propagate paint opacity correctly. **Always force opacity in a separate explicit pass after any of them.**

### 1a. `resetOverrides()` doesn't reset paint opacity

**Symptom:** instance shows stale property value (e.g. `opacity: 1.0`) even though the source component has the new value (e.g. `opacity: 0.10`). You call `inst.resetOverrides()` — value still doesn't change.

**Why:** `resetOverrides()` resets *node properties* (text, fills, etc.) back to the main component's current state. But for *paint sub-properties* like opacity on a fill that's also bound to a variable, the override often survives because the binding itself counts as the "current" override and the sub-property travels with it.

### 1b. `createInstance()` doesn't inherit variant opacity

**Symptom:** you create a fresh instance via `variant.createInstance()` from a component whose bg fill has opacity 0.10. Inspect the instance — bg opacity comes back as 1.0.

**Why:** `createInstance()` instantiates the variant's structure but doesn't reliably inherit paint opacity properties. The instance starts with default opacity 1.0 even when the variant's component definition specifies a lower value.

### 1c. `setBoundVariableForPaint()` silently drops the input paint's opacity

**Symptom:** you call `figma.variables.setBoundVariableForPaint(paint, "color", variable)` on a paint with `opacity: 0.30` — the returned paint comes back with `opacity: 1.0`. Even worse, the `{ ...bound, opacity: 0.30 }` spread workaround is **inconsistent** — it works for some source paints (already-bound ones) but silently fails for others (originally-unbound raw RGB paints).

**Why:** the API returns a new paint object that doesn't preserve the input paint's opacity. Spread-then-override is supposed to work, but Figma's normalization layer interferes for some source-paint shapes.

### Reliable fix for all three: explicit opacity pass, separate from any binding/cloning step

```js
// Step 1: do the binding / cloning / swapping operation
inst.fills = inst.fills.map(f => {
  if (f.type !== "SOLID") return f;
  return figma.variables.setBoundVariableForPaint(f, "color", stateVar);
});

// Step 2 (separate, explicit): force opacity in a fresh pass
inst.fills = inst.fills.map(f => f.type === "SOLID" ? { ...f, opacity: 0.10 } : f);
inst.strokes = inst.strokes.map(s => s.type === "SOLID" ? { ...s, opacity: 0.30 } : s);

// Step 3: re-read to verify
const verifyBg = inst.fills[0]?.opacity;
const verifyStroke = inst.strokes[0]?.opacity;
```

**Don't trust** that any of these APIs handled opacity correctly — always re-read and confirm the value matches the spec before declaring done. The Trap 3 (inline screenshot lies) issue compounds this — the inline render may show the *intended* opacity even when the persisted file has 1.0.

**Surface symptoms to look for:**
- Pills/buttons render as solid color blocks instead of tinted
- Borders look solid when they should be subtle
- "I just created this instance, why is it loud?"
- Some pills look right, others wrong — *and the broken ones are the ones whose source paint was previously-unbound (raw RGB)*

## Trap 2 — Mode collections don't auto-cascade across alias chains

**Symptom:** you set explicit dark mode on a frame via `frame.setExplicitVariableModeForCollection(crewSemanticCol, darkModeId)`. The frame still renders in light mode. `frame.explicitVariableModes` shows your override correctly.

**Why:** when an override-collection variable (e.g. `Crew/background`) aliases to a source-collection variable (e.g. `Core/mode/background`), mode resolution happens **per-collection at each hop**. You set Crew's mode; Core's mode falls back to whatever the page/document default is (typically light). The visible color comes from Core, not Crew.

**Fix:** find the source collection via the alias chain and set its mode too. The source collection often **isn't visible** via `getAvailableLibraryVariableCollectionsAsync` — only the override collection appears. Walk the chain instead:

```js
// Given: crewBgVar (any imported variable from the override collection) + frame
const lightModeId = crewLocalCol.modes.find(m => /light/i.test(m.name)).modeId;
const aliasTarget = crewBgVar.valuesByMode[lightModeId];
if (aliasTarget?.type !== "VARIABLE_ALIAS") throw new Error("expected alias");

const sourceVar = await figma.variables.getVariableByIdAsync(aliasTarget.id);
const sourceCol = await figma.variables.getVariableCollectionByIdAsync(sourceVar.variableCollectionId);
const sourceDark = sourceCol.modes.find(m => /dark/i.test(m.name));

frame.setExplicitVariableModeForCollection(crewLocalCol, crewDark.modeId);
frame.setExplicitVariableModeForCollection(sourceCol, sourceDark.modeId);  // <-- the missed step
```

**Generalize:** any time you set an explicit mode, walk the alias chains of the variables you care about and set the mode on every collection you encounter.

**Exception — direct alias to mode-invariant primitive.** If your override layer's variables alias directly to a mode-invariant primitive collection (like `tw/colors`, single-mode) instead of through a multi-mode source collection (like `mode`), only one mode set is needed: the override collection. Crew DS adopted this pattern on 2026-05-10 — Crew Semantic Colors aliases directly to `Core / tw/colors / slate-XXX`, so Crew consumers only need `setExplicitVariableModeForCollection(crewSemantic, modeId)`. No need to walk the alias chain to set mode on the primitive collection (it has no mode to set).

**How to tell which pattern your project uses:** pick a known override variable (e.g. `Crew / Semantic Colors / background`), inspect its `valuesByMode[anyModeId]`. If the alias target is in a single-mode collection (`modes.length === 1`), you're in the simplified pattern. If multi-mode (`modes.length >= 2`), the chain-walking applies.

## Trap 3 — Inline `node.screenshot()` lies; trust the live API

**Symptom:** you mutate something, call `await node.screenshot()` inside `use_figma`, the returned PNG looks correct. But the user (or another file consuming this one) reports the file still looks broken.

**Why:** `node.screenshot()` inside `use_figma` renders at a transaction stage that doesn't always match the file's persisted state, and definitely doesn't always match what other consumer files see after publish. It's useful for quick "did the node structure form correctly" peeks, not for cross-file verification.

### Most insidious form: inline screenshot shows applied opacity, persisted file keeps original

The most damaging variant of this trap: you call `node.fills = [...{...f, opacity: 0.18}]` and then `await node.screenshot()`. The screenshot shows pills with the new tinted opacity ✓. You declare done. Hours later (or in a follow-on session), the file actually has opacity 1.0 — the inline render reflected the in-memory mutation but the actual fill property didn't persist (or the spread silently dropped opacity per Trap 1c).

We hit this exact case during the StateBadge polish session: inline screenshots showed tinted pills, but the file kept opacity 1.0 throughout. Discovery came hours later when a downstream change made the regression obvious.

**Fix:** always cross-check with the MCP `get_screenshot` tool (separate from the plugin) for the live API view:

```
mcp_tool: get_screenshot
fileKey: <file-key>
nodeId: <node-id>
```

When inline says "fixed" but live says "broken," **trust live**. Don't try more inline tweaks — diagnose what's stale.

### Mandatory verification rule for opacity changes

Any time you mutate paint opacity (or anything that touches paint properties), the verification step is **mandatory**, not optional:

1. After the mutation, **re-read** the property via a separate read script: `inst.fills[0]?.opacity`
2. If the persisted value doesn't match your intent, you have a Trap 1 case (silent opacity loss). Apply the explicit-opacity-pass workaround and verify again.
3. **Then** screenshot via MCP `get_screenshot` (live API) — never trust the inline render alone for paint changes.

The cost of skipping verification: regressions that surface days later, blame on the wrong layer, and rework that compounds.

## Trap 4 — Publish verification before chasing instance bugs

**Symptom:** you fixed something in the source file. You asked the user to publish. They confirmed they republished. Instances still wrong. You start chasing override theories.

**Why:** "I republished" can mean "I republished some earlier set of changes" or "I clicked publish but the changes hadn't been saved yet." Or your source-file mutation didn't actually persist (rare but happens). Before chasing the instance, **verify the consumer file's library cache has the latest source definition**.

**Fix:** re-import the component in the consumer file and inspect what the cache returned:

```js
// In the consumer file
const set = await figma.importComponentSetByKeyAsync(SOURCE_COMPONENT_SET_KEY);
const variant = set.children.find(v => v.name === EXPECTED_VARIANT_NAME);

return {
  // Whatever properties you changed in the source — assert they're present here
  bgOpacity: variant.fills[0].opacity,         // expect 0.18 if your fix is published
  textBoundColorId: variant.children.find(c => c.type === "TEXT").fills[0].boundVariables?.color?.id,
};
```

If the cache shows the old value: the publish didn't include your change. Tell the user that explicitly — "the screens file is still seeing the pre-fix component; the publish missed the change" — and have them republish. Don't try harder on the instance side until the cache shows the new value.

## Trap 5 — The override trap starts upstream

A consumer-file color-binding pass (e.g. walking `frame.findAll(n => "fills" in n)` and binding each SOLID fill to a token) **also walks fills inside any component instances** in that frame. Binding fills inside an instance creates **instance-level overrides** that lock those fills' properties (color binding, opacity) to whatever they were at bind time — and those overrides survive `swapComponent` and (per Trap 1) often survive `resetOverrides()` too.

**Avoid up front:** before the binding pass, identify nodes that are already (or are about to become) component instances, and skip them. They'll inherit from the component definition; binding inside them creates exactly the trap you don't want.

```js
// In the binding loop
let cur = node;
let insideInstance = false;
while (cur && cur.id !== frame.id) {
  if (cur.type === "INSTANCE") { insideInstance = true; break; }
  cur = cur.parent;
}
if (insideInstance) return f;  // leave the fill alone — instance handles it via the component
```

If you've already run a binding pass and created the overrides, fix per Trap 1 (explicit instance fill mutation).

## Required checklist before declaring "DS update propagated"

- [ ] **Source-file change persisted.** Re-read the property in the source file (`get_metadata` or another `use_figma` call). Don't assume your write took.
- [ ] **User has published in Figma desktop.** Tell them explicitly: "Republish [DS-file-name] in the desktop app." Don't assume publishing happened.
- [ ] **Consumer file's library cache has the change** (Trap 4 verification snippet). If cache is stale, the publish missed your change — tell the user explicitly.
- [ ] **Each instance re-swapped** via `inst.swapComponent(latestVariant)`. Existing instances do not auto-update on publish.
- [ ] **Override stickiness checked** (Trap 1) — read back the property on at least one instance and confirm it matches the spec. If not, explicit instance mutation.
- [ ] **Two-collection modes set** (Trap 2) if cross-collection alias chains are involved.
- [ ] **Verified via MCP `get_screenshot`** (Trap 3), not `node.screenshot()`.

If you can't tick every box, you don't yet know whether the change propagated. Don't tell the user "should be fixed now" until you can.

## Common rationalizations

| Excuse | Reality |
|--------|---------|
| "The user said they republished, so it's published" | Publish often misses changes. Verify the cache. |
| "`resetOverrides()` will fix it" | For paint sub-properties (opacity), often doesn't. Re-read and confirm. |
| "Inline `node.screenshot()` shows it working" | Inline render ≠ live render ≠ what the user sees. Use MCP `get_screenshot`. |
| "I set explicit dark mode, frame should render dark" | Only true if every alias-chain collection also has its mode set. |
| "Binding inside the instance is fine, I'll just resetOverrides later" | The override sticks. Skip these nodes during binding. |
| "Re-swapping always picks up the latest" | Picks up the latest *cached* definition. Verify cache freshness first. |
