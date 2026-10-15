#!/usr/bin/env node
/**
 * Documentation gate (CLAUDE.md §0.1). Fails when:
 *  1. a required doc is missing, or docs/README.md does not link to it;
 *  2. a phase doc is marked "Complete" but lacks one of the 10 required sections;
 *  3. (pull requests only) app/, features/ or supabase/migrations/ changed
 *     but docs/CHANGELOG.md did not.
 *
 * Usage: node scripts/docs-check.mjs [--root <dir>]
 * Check 3 runs only when DOCS_CHECK_BASE names a git ref (CI sets it on PRs).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_DOCS = [
  'README.md',
  'CHANGELOG.md',
  'ARCHITECTURE.md',
  'DATABASE.md',
  'API.md',
  'DECISIONS.md',
  'SETUP.md',
  'TESTING.md',
  'USER_GUIDE.md',
  'ADMIN_GUIDE.md',
  'TROUBLESHOOTING.md',
];

export const PHASE_SECTIONS = [
  'Goal',
  'Status',
  'Features built',
  'Files added/changed',
  'Database changes',
  'Environment variables added',
  'How to test it',
  'Verification results',
  'Known limitations & follow-ups',
  'Deviations from the plan',
];

const CODE_PATHS = /^(app|features|supabase\/migrations)\//;

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text under a "## N. <title>" heading, up to the next "## " heading. */
function section(markdown, title) {
  const match = new RegExp(`^##\\s+(?:\\d+\\.\\s+)?${escape(title)}\\s*$`, 'im').exec(markdown);
  if (!match) return null;
  const rest = markdown.slice(match.index + match[0].length);
  const next = rest.search(/^##\s/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

export function checkDocs(root) {
  const errors = [];
  const docsDir = path.join(root, 'docs');

  for (const file of ['PROGRESS.md', 'README.md']) {
    if (!existsSync(path.join(root, file)))
      errors.push(`${file} is missing at the repository root`);
  }

  for (const doc of REQUIRED_DOCS) {
    if (!existsSync(path.join(docsDir, doc))) errors.push(`docs/${doc} is missing`);
  }

  const index = existsSync(path.join(docsDir, 'README.md'))
    ? readFileSync(path.join(docsDir, 'README.md'), 'utf8')
    : '';
  for (const doc of REQUIRED_DOCS.filter((d) => d !== 'README.md')) {
    if (index && !index.includes(`(${doc})`)) errors.push(`docs/README.md does not link ${doc}`);
  }

  const phasesDir = path.join(docsDir, 'phases');
  const phaseFiles = existsSync(phasesDir)
    ? readdirSync(phasesDir).filter((f) => /^phase-\d{2}-.+\.md$/.test(f))
    : [];
  if (phaseFiles.length === 0) errors.push('docs/phases/ has no phase-XX-*.md files');

  for (const file of phaseFiles) {
    const markdown = readFileSync(path.join(phasesDir, file), 'utf8');
    const status = section(markdown, 'Status');
    if (status === null) {
      errors.push(`docs/phases/${file}: missing the "Status" section`);
      continue;
    }
    if (!/^\**\s*Complete\b/im.test(status)) continue;
    for (const title of PHASE_SECTIONS) {
      const body = section(markdown, title);
      if (body === null) errors.push(`docs/phases/${file}: marked Complete but missing "${title}"`);
      else if (!body) errors.push(`docs/phases/${file}: marked Complete but "${title}" is empty`);
    }
  }

  return errors;
}

export function checkChangelog(changedFiles) {
  const touchesCode = changedFiles.some((file) => CODE_PATHS.test(file));
  return touchesCode && !changedFiles.includes('docs/CHANGELOG.md')
    ? ['Code under app/, features/ or supabase/migrations/ changed but docs/CHANGELOG.md did not']
    : [];
}

function main() {
  const rootFlag = process.argv.indexOf('--root');
  const root = path.resolve(rootFlag === -1 ? process.cwd() : process.argv[rootFlag + 1]);
  const errors = checkDocs(root);

  const base = process.env.DOCS_CHECK_BASE;
  if (base) {
    const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    errors.push(...checkChangelog(changed));
  }

  if (errors.length > 0) {
    console.error(`docs:check failed (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }
  console.log('docs:check passed');
}

// Run only when executed directly (not when imported by the unit tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
