# Node project conventions

Applies when working in any Node/TypeScript project (signal: `package.json` exists at the repo root or in a workspace). Sub-sections are sequenced from "applies to almost every Node project" toward "applies to specific patterns."

## Project structure

For multi-package projects, prefer **npm workspaces**:

```
project-root/
├── packages/
│   ├── pkg-a/
│   ├── pkg-b/
│   └── …
├── package.json          # workspace orchestration only
├── tsconfig.base.json    # shared compiler options
└── …
```

Root `package.json`:

```json
{
  "name": "project",
  "private": true,
  "workspaces": ["packages/*"]
}
```

Rules:

- **Install dependencies into the workspace that uses them**, not the root: `npm install <pkg> --workspace=<name>`. The `--workspace` flag takes the package's `name` from its own `package.json`, not the directory name.
- **Root `package.json` stays free of runtime dependencies** — it's just workspace orchestration plus root-level lint/format/test wrappers.

For single-package projects, skip the workspaces ceremony entirely.

## Package versions

- Always install the **latest stable** version: `npm install <pkg>@latest` directly, without checking the dist-tag first.
- This applies to both `dependencies` and `devDependencies`.
- Always install/update the relevant `@types` packages as `devDependencies`.

## TypeScript

Shared `tsconfig.base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

Per-package `tsconfig.json` extends this:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

Notes:

- **`verbatimModuleSyntax`** + the `consistent-type-imports` ESLint rule together force `import type { X }` for type-only imports — avoids accidentally pulling runtime code into the bundle.
- **`isolatedModules`** keeps the source compatible with bundlers/transpilers that compile files individually (Vite, esbuild, swc).
- **For Vite/Vite-bundled packages** (frontend, dashboards), override `module: "ESNext"` + `moduleResolution: "Bundler"` + add `"lib": ["ES2023", "DOM", "DOM.Iterable"]` + `"jsx": "react-jsx"`.
- **`*.tsbuildinfo` files are always gitignored, never committed** (covered in the Node `.gitignore` additions below).

## ESLint + Prettier

Use `typescript-eslint` flat config plus `eslint-config-prettier` (for compat). For React projects, add `@eslint-react/eslint-plugin` + `eslint-plugin-react-hooks`.

`eslint.config.js` (Node-only baseline):

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  prettier,
);
```

For React projects, add a frontend-files block before the prettier compat:

```js
import * as pluginReact from '@eslint-react/eslint-plugin';
import pluginReactHooks from 'eslint-plugin-react-hooks';

// inside tseslint.config(...):
{
  files: ['packages/frontend/src/**/*.{ts,tsx}'],
  ...pluginReact.configs.recommended,
  plugins: {
    ...pluginReact.configs.recommended.plugins,
    'react-hooks': pluginReactHooks,
  },
  rules: {
    ...pluginReact.configs.recommended.rules,
    ...pluginReactHooks.configs.recommended.rules,
  },
},
```

`.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

`trailingComma: "all"` is the modern default — works for any output target ES2017+ and produces cleaner diffs when adding new arguments/elements.

**No pre-commit hooks.** Agents run lint / format / typecheck themselves before reporting work complete.

## Standard scripts

Per-package `package.json`:

```json
{
  "scripts": {
    "dev": "…",
    "build": "tsc -p tsconfig.json && …",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

Root `package.json` (workspaces only):

```json
{
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "test:run": "npm run test:run --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "eslint packages",
    "lint:fix": "eslint packages --fix",
    "format": "prettier --write packages docs",
    "format:check": "prettier --check packages docs"
  }
}
```

Cleanliness check — run all of these clean before reporting work complete:

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test:run && npm run build
```

## `.gitignore` additions for Node

Extend the universal baseline in `code-quality.md` with:

```gitignore
# Node dependencies
node_modules

# Build output
dist
build
dist-ssr

# TypeScript incremental build cache — per-machine, never useful in git
*.tsbuildinfo

# Vite
.vite
vite.config.*.timestamp-*

# Tool caches
.cache
.eslintcache
.prettiercache
```

## Testing

- **Vitest** for unit tests on any Node package.
- **React Testing Library** + `jsdom` env for components in frontend packages.
- **Tests live alongside the file they exercise**: `foo.ts` + `foo.test.ts`. Co-location keeps the test discoverable and makes refactors atomic.
- **Prefer real fixtures over mocks** for small integrations — `tmpdir`-based fixtures for filesystem code, real test database for DB integration tests. The failure modes that mocks mask (a missed FS event, a divergent mock schema) are exactly the ones you want a test to catch.
- **Vitest globals** (`describe`, `it`, `expect`, `vi`, `beforeEach`) work without explicit imports if `globals: true` is set in `vitest.config.ts` and the per-package `tsconfig.json` includes `"types": ["vitest/globals"]`. Pick one approach (globals or explicit imports) per package and stick with it.

Per-package `vitest.config.ts` for a frontend (jsdom):

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

For a Node-environment package, drop the React plugin and use `environment: 'node'`.

`src/test/setup.ts` (frontend only):

```ts
import '@testing-library/jest-dom/vitest';
```

## Frontend styling

**Default to Tailwind utility classes for new frontend work.** Don't reach for CSS Modules, styled-components, emotion, vanilla `.css` files, or `style={{...}}` props in greenfield code. Co-location with markup, no class-naming overhead, and React component extraction handles the reuse story (see the next section).

Carve-outs:

- **Global resets, design tokens, and `@keyframes`** live in the project's `index.css` (Tailwind v4 `@theme` block). That file is allowed to exist and is small.
- **Truly dynamic values** computed at render time (e.g. `style={{ width: ${percent}% }}`) — Tailwind's arbitrary value syntax doesn't see runtime values at build time.
- **Existing projects** that have committed to a different system (CSS Modules, styled-components, etc.) — follow what's there. Don't mix systems without an explicit migration decision.

## Frontend component composition (React)

Page files (`+Page.tsx`, route components, etc.) should read as **composition** — arrangement of reusable components, not a wall of utility classes. When a page introduces a new visual pattern, extract a component rather than inlining the styling.

Layout:

- **Shared, cross-section primitives** (`Avatar`, `SectionHeader`, `Card`, `Button`, `Kpi`) live under `src/components/ui/`.
- **Feature-scoped components** (the profile goals editor, a recipe hero block) live under `src/components/<feature>/`.

Composition rules:

- **Parameterize over copy-paste.** If two call sites differ only in a value (label, size, accent), make it a prop. If they differ in structure, accept a `ReactNode` slot (`action`, `children`, `leading`, etc.) rather than branching internally.
- **Don't bake page-specific values into shared components.** Pass them as props. If a component only makes sense for one page, it belongs in `components/<feature>/`, not `components/ui/`.
- **One ad-hoc `className` on a reused primitive is fine; a dozen utility classes rebuilding a button/card/row from scratch is a signal to extract.**

## Bin scripts (CLI projects)

When publishing executables under `bin/`:

- Many dev environments have `core.filemode = false`, which means `chmod +x` on a file alone won't propagate to commits — Git records the mode from `core.filemode`'s default (`100644`).
- After `chmod +x <file>`, run `git update-index --add --chmod=+x <file>` so the file lands as `100755` in the index. Verify with `git ls-files --stage` (look for `100755`).
- The shebang should be `#!/usr/bin/env node` (or the appropriate runtime) and the file must be saved with **LF line endings** (the universal `.gitattributes` from `line-endings.md` enforces this).

## Configuration files for humans

Prefer **TOML over JSON** for configuration files a human will edit by hand (project configs, secrets manifests, dev tool settings).

- TOML supports comments, multiline strings, and a layout that scales to nested config without becoming a wall of braces.
- Reserve JSON for machine-generated files (`package.json`, `package-lock.json`, `tsconfig.json`, build outputs) — files where humans rarely touch them and tooling overwrites freely.
- `smol-toml` is a good Node parser; pair with `zod` for schema validation.
