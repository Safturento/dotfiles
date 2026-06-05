# Figma conventions

Read when about to do non-trivial work in Figma via `use_figma` / the Figma Plugin API — especially when modifying COMPONENT_SETs, converting frames to auto-layout, manipulating nested instance overrides, or adding variant axes.

This file is for gotchas that aren't obvious from the API surface or the figma-use skill's reference docs. Add new entries here as you encounter them (per `self-improvement.md`).

## Converting an existing frame to auto-layout

When the frame has children that should remain in their current absolute positions (background overlays, drop-shadow rectangles, etc.):

1. Convert to auto-layout: `frame.layoutMode = 'VERTICAL'` (or HORIZONTAL)
2. **Immediately** mark each absolute child: `child.layoutPositioning = 'ABSOLUTE'`
3. **Re-set the frame's width and height explicitly** with `frame.resize(w, h)` — Figma will have already reflowed during step 1 and resized to fit ALL children (including ones you intended to mark absolute), so the parent's dimensions are likely wrong by the time you reach this step
4. Lock dimensions: `primaryAxisSizingMode = 'FIXED'`, `counterAxisSizingMode = 'FIXED'`
5. Restore position if needed: `frame.x = origX; frame.y = origY` — the resize may have shifted the frame's anchor

Skipping step 3 leads to the frame growing to stack-height of all children (often 2-3× expected) and shifting position. `primaryAxisSizingMode = 'FIXED'` only locks the *current* size, so it must come after the explicit `resize()`.

## Nested instance properties become stranded when a master variant is renamed or restructured

When you rename a Pill variant (e.g., restructuring `type=button-mono-default` into `type=button-default, font=mono`, or adding a new variant axis), instances of that variant **deep inside other composites** may not auto-update — they get stuck at obsolete property values like `type=button-sm, font=sans` that don't match the current master.

This happens because the nested instance had an explicit property override at the moment of the rename. The override survives the rename and points at a now-invalid combination, which Figma silently resolves to *something* unintended.

**Fix:** explicitly `setProperties({...})` on each affected nested instance to clear the stale override:

```js
const nested = parentInst.findOne(n => n.type === 'INSTANCE' && n.name === '...');
nested.setProperties({ type: 'button-default', font: 'mono' });
```

Affects: instances inside composites that you've gone through multiple variant changes on.

## Adding a variant to an existing COMPONENT_SET

`clone()` of a COMPONENT inside a COMPONENT_SET places the clone on the **page** (the set's grandparent), NOT inside the set. After cloning:

1. `componentSet.appendChild(clonedComponent)` — moves the clone into the set
2. Set the clone's `name` to match the variant naming convention (e.g., `type=X, color=Y, intensity=Z`)
3. Verify with `componentSet.componentPropertyDefinitions['axisName'].variantOptions` to confirm any new axis values now appear

If you forget step 1, `setProperties({ axis: 'newValue' })` on instances will error with "Unable to find a variant with those property values."

## Adding a new variant axis to an existing COMPONENT_SET

To add a fourth axis like `font` (mono/sans) to an existing 3-axis set:

1. Rename every existing variant to include the new axis with an appropriate default value (e.g., append `, font=mono` to tag/pill variants, `, font=sans` to button variants)
2. The new axis appears in `componentSet.componentPropertyDefinitions` automatically once all variants reference it
3. **You don't need to create all 2× variants for the new axis values.** Figma is fine with sparse variant coverage — consumers picking a non-existent combination will see Figma's "missing variant" indicator; they can fall back to a present combination

This avoids doubling the variant count when only specific combinations are actually needed.

## Component properties can't bind font

Figma's component properties bind to exactly four things: visibility (BOOLEAN), characters (TEXT), mainComponent (INSTANCE_SWAP), or variant axis values (VARIANT). They **cannot** bind a TEXT node's `fontName`, `fontSize`, fill color, or any other arbitrary text property.

To toggle fonts across instances, the practical patterns are (in rough order of preference):

- **New variant axis (`font=mono/sans`)** — cleanest UX, doubles variant count but variants are mostly metadata
- **Two stacked TEXT nodes with complementary BOOLEAN visibility properties** — two-toggle consumer UX (no inverse visibility binding exists in Figma)
- **INSTANCE_SWAP between mini sub-components** — needs new sub-components per font

Same constraint applies to fill color, font size, letter spacing — anything that isn't a variant axis must change via swapping the underlying component.

## Fonts must be loaded before mutating text

Every text mutation needs `await figma.loadFontAsync({family, style})` first — including when the font is one the file already uses heavily. `loadFontAsync` doesn't persist across `use_figma` calls; load fonts at the top of every call that touches text.

This is in the figma-use skill's gotchas already; reproduced here because it bites repeatedly.

## use_figma calls are atomic

If a `use_figma` script throws partway through, nothing is applied to the file — the entire script is rolled back. This means:

- After an error, you can safely retry the corrected script without cleanup
- Long scripts that touch many nodes succeed or fail as one unit
- The 10-ops-per-call guidance in the figma-use skill is about *cognitive load*, not a hard cap — bulk operations like "rename all 320 variants" can happen in a single call when the logic is straightforward

## Proxy hiccups on screenshot downloads

The screenshot CDN URLs from `get_screenshot` are short-lived. If the local proxy is briefly unavailable when you `curl` them, **don't retry immediately** — wait ~5–10s and try once more. If it still fails, request a fresh screenshot URL rather than retrying the dead one.
