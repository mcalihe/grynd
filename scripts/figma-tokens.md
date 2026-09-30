# Regenerating design tokens from Figma

`src/styles/tokens.css` mirrors the Figma variables in the file
[grynd](https://www.figma.com/design/iCoAOIvfyeCFYFU4Og7rVf/grynd) (collections `Primitives`, `Semantic`, `Layout`).

## When

After any change to a Figma variable (new token, changed value, changed alias).

## How

1. Run the snippet below with the Figma MCP tool `use_figma` (file key `iCoAOIvfyeCFYFU4Og7rVf`). It is read-only and returns every variable with its code syntax and per-mode value (`@name` marks the primitive a semantic token aliases).
2. Update `src/styles/tokens.css`:
   - Primitives → `--<group>-<step>` in `:root` (e.g. `brand/500` → `--brand-500`).
   - Semantic, mode Light → `:root`, mode Dark → `.dark`, always as `var(--<primitive>)` so light and dark point at the same palette.
   - Every semantic token also gets `--color-<name>: var(--<name>)` in `@theme inline`, so Tailwind classes like `bg-primary` exist.
   - Layout: `radius/base` → `--radius`; `radius/lg|xl|pill` → `--radius-lg|xl|full` in `@theme inline`. Spacing needs no variables (Tailwind's 4px step).
3. New semantic tokens need a Web code syntax in Figma (`var(--name)`) first.
4. Check light and dark in the browser and run `pnpm build`.

```js
const hex = (c) =>
  '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const out = {};
for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
  out[c.name] = [];
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    const vals = {};
    for (const m of c.modes) {
      let x = v.valuesByMode[m.modeId];
      let alias = null;
      if (x && x.type === 'VARIABLE_ALIAS') {
        const a = await figma.variables.getVariableByIdAsync(x.id);
        const ac = await figma.variables.getVariableCollectionByIdAsync(a.variableCollectionId);
        alias = a.name;
        x = a.valuesByMode[ac.modes[0].modeId];
      }
      vals[m.name] = (typeof x === 'object' && 'r' in x ? hex(x) : x) + (alias ? ' @' + alias : '');
    }
    out[c.name].push([v.name, v.codeSyntax.WEB || '', vals]);
  }
}
return out;
```
