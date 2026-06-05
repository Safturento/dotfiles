import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import yaml from 'js-yaml';
import micromatch from 'micromatch';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

interface AgentsFrontmatter {
  name?: string;
  description?: string;
  last_updated?: string;
  covers?: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateFrontmatter(content: string, filePath: string): ValidationResult {
  const errors: string[] = [];
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    errors.push('missing frontmatter block');
    return { ok: false, errors };
  }

  let fm: AgentsFrontmatter;
  try {
    fm = (yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) ?? {}) as AgentsFrontmatter;
  } catch (e) {
    errors.push(`yaml parse failed: ${(e as Error).message}`);
    return { ok: false, errors };
  }

  const normalized = filePath.replaceAll('\\', '/');
  const isTopicDoc = normalized.startsWith('.agents/') && !normalized.endsWith('/README.md');
  const isPackageAgents = /^packages\/[^/]+\/AGENTS\.md$/.test(normalized);

  if (isTopicDoc) {
    if (!fm.name) errors.push('missing required field: name');
    if (!fm.description) errors.push('missing required field: description');
    if (!fm.last_updated) errors.push('missing required field: last_updated');
    if (!fm.covers || !Array.isArray(fm.covers) || fm.covers.length === 0) {
      errors.push('missing required field: covers (must be non-empty array)');
    }

    if (fm.name) {
      const expectedName = path.basename(normalized, '.md');
      if (fm.name !== expectedName) {
        errors.push(`name "${fm.name}" does not match filename "${expectedName}"`);
      }
    }

    if (fm.last_updated && !ISO_DATE.test(fm.last_updated)) {
      errors.push(`last_updated must be ISO date (YYYY-MM-DD), got: ${fm.last_updated}`);
    }

    if (fm.covers && Array.isArray(fm.covers)) {
      for (const pattern of fm.covers) {
        if (/[{}]/.test(pattern)) {
          errors.push(
            `covers pattern uses brace expansion, unsupported by the doc-parity hook: ${pattern} — ` +
              `split into separate list entries`,
          );
        }
        try {
          micromatch.makeRe(pattern, { strictBrackets: true });
        } catch {
          errors.push(`invalid micromatch pattern in covers: ${pattern}`);
        }
      }
    }
  } else if (isPackageAgents) {
    if (!fm.description) errors.push('missing required field: description');
    if (!fm.last_updated) errors.push('missing required field: last_updated');
    if (fm.last_updated && !ISO_DATE.test(fm.last_updated)) {
      errors.push(`last_updated must be ISO date (YYYY-MM-DD), got: ${fm.last_updated}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function validateAll(repoRoot: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const topicFiles = await glob('.agents/*.md', {
    cwd: repoRoot,
    ignore: ['.agents/README.md'],
  });
  const packageFiles = await glob('packages/*/AGENTS.md', { cwd: repoRoot });

  for (const file of [...topicFiles, ...packageFiles]) {
    const content = await fs.readFile(path.join(repoRoot, file), 'utf8');
    const result = validateFrontmatter(content, file);
    if (!result.ok) {
      errors.push(`${file}:`);
      for (const e of result.errors) errors.push(`  - ${e}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

async function main(): Promise<void> {
  const result = await validateAll(process.cwd());
  if (!result.ok) {
    console.error('AGENTS frontmatter validation failed:');
    for (const e of result.errors) console.error(e);
    process.exit(1);
  }
  console.log('AGENTS frontmatter validation: ok');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
