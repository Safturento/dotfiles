import { describe, it, expect } from 'vitest';
import { validateFrontmatter } from './validate-agents-frontmatter.js';

describe('validateFrontmatter', () => {
  it('passes a fully-valid .agents topic doc', () => {
    const content = `---
name: architecture
description: 4-package layering rules + dependency direction
last_updated: 2026-05-13
covers:
  - "packages/*/src/**/*.ts"
  - "package.json"
---

# Architecture
content here
`;
    const result = validateFrontmatter(content, '.agents/architecture.md');
    expect(result.ok).toBe(true);
  });

  it('fails when the name field is missing', () => {
    const content = `---
description: missing name
last_updated: 2026-05-13
covers: ["**"]
---
`;
    const result = validateFrontmatter(content, '.agents/architecture.md');
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('missing required field: name');
  });

  it('fails when filename does not match name field', () => {
    const content = `---
name: architecture
description: x
last_updated: 2026-05-13
covers: ["**"]
---
`;
    const result = validateFrontmatter(content, '.agents/local-dev.md');
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) =>
        e.includes('name "architecture" does not match filename "local-dev"'),
      ),
    ).toBe(true);
  });

  it('fails when last_updated is not ISO date', () => {
    const content = `---
name: architecture
description: x
last_updated: yesterday
covers: ["**"]
---
`;
    const result = validateFrontmatter(content, '.agents/architecture.md');
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('last_updated'))).toBe(true);
  });

  it('fails when a covers glob is invalid micromatch', () => {
    const content = `---
name: architecture
description: x
last_updated: 2026-05-13
covers:
  - "packages/**[invalid"
---
`;
    const result = validateFrontmatter(content, '.agents/architecture.md');
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid micromatch'))).toBe(true);
  });

  it('fails when a covers glob uses brace expansion', () => {
    const content = `---
name: architecture
description: x
last_updated: 2026-05-13
covers:
  - "packages/cli/src/lib/{run,prompts}/**"
---
`;
    const result = validateFrontmatter(content, '.agents/architecture.md');
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('brace expansion'))).toBe(true);
  });

  it('passes a per-package AGENTS.md with the lighter schema (no covers)', () => {
    const content = `---
description: Patterns and rules for the crew-cli package
last_updated: 2026-05-13
---
`;
    const result = validateFrontmatter(content, 'packages/cli/AGENTS.md');
    expect(result.ok).toBe(true);
  });
});
