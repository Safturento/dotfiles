#!/usr/bin/env node
// followups-vault-sync.mjs — mirror each repo's docs/followups.md into the
// Obsidian vault as a REAL file, and keep it fresh by watching for changes.
//
// Why copies, not symlinks: the obsidian-headless sync daemon reads a symlink's
// target exactly once (at link creation) and never re-reads it, so repo-side
// followup edits (Claude appends, PR resolution, branch switches) never reached
// the vault. Real copies sync reliably AND become MCP-searchable (no out-of-vault
// boundary-guard block). The repo is the source of truth; these copies are a
// read-only mirror (like the Jira snapshot notes) — don't edit them on the
// Windows/mobile client, edit followups in the repo.
//
// Dependency-free: Node builtins only. Watches each repo's `docs/` directory
// (not the file directly) so atomic-rename writes from git/editors are caught.
import { readdirSync, statSync, existsSync, copyFileSync, mkdirSync, watch } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';

const REPOS = join(homedir(), 'Repos');
const VAULT = join(homedir(), 'obsidian', 'AI', 'projects');
// Repos outside ~/Repos to also mirror (e.g. this dotfiles repo itself, so
// vault-setup followups land in the vault like every other project's).
const EXTRA_REPOS = [join(homedir(), 'dotfiles')];

// Add `repo` (vault folder = `name`) to `pairs` if it's a main working tree with
// a followups file. A main working tree has `.git` as a DIRECTORY; a linked
// worktree has it as a FILE — so this also skips worktrees.
function consider(pairs, repo, name) {
  let gitStat;
  try { gitStat = statSync(join(repo, '.git')); } catch { return; }
  if (!gitStat.isDirectory()) return;
  const src = join(repo, 'docs', 'followups.md');
  if (!existsSync(src)) return;
  const destDir = join(VAULT, name);
  pairs.push({ name, src, destDir, dest: join(destDir, 'followups.md') });
}

// Discover base repos with a followups file: everything under ~/Repos plus the
// explicit EXTRA_REPOS.
function discover() {
  const pairs = [];
  let entries = [];
  try { entries = readdirSync(REPOS, { withFileTypes: true }); } catch { /* no ~/Repos */ }
  for (const e of entries) {
    if (e.isDirectory()) consider(pairs, join(REPOS, e.name), e.name);
  }
  for (const repo of EXTRA_REPOS) consider(pairs, repo, basename(repo));
  return pairs;
}

function copy(p) {
  try {
    mkdirSync(p.destDir, { recursive: true });
    copyFileSync(p.src, p.dest);
    console.log(`[${new Date().toISOString()}] synced ${p.name} followups -> vault`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] copy failed ${p.name}: ${err.message}`);
  }
}

const pairs = discover();
if (pairs.length === 0) { console.error('no base-repo followups files found; exiting'); process.exit(0); }

// Initial sync so the vault matches the repos on startup.
for (const p of pairs) copy(p);

// Watch each repo's docs/ dir; debounce to coalesce rapid events (atomic renames
// often fire multiple events). Re-copy whenever followups.md is touched.
const timers = new Map();
for (const p of pairs) {
  const docsDir = dirname(p.src);
  try {
    watch(docsDir, (_event, filename) => {
      if (filename !== 'followups.md') return;
      clearTimeout(timers.get(p.name));
      timers.set(p.name, setTimeout(() => { if (existsSync(p.src)) copy(p); }, 300));
    });
    console.log(`watching ${docsDir}`);
  } catch (err) {
    console.error(`watch failed ${docsDir}: ${err.message}`);
  }
}
console.log(`followups-vault-sync: mirroring ${pairs.length} repo(s): ${pairs.map((p) => p.name).join(', ')}`);
