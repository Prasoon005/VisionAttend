import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkChangelog,
  checkDocs,
  PHASE_SECTIONS,
  REQUIRED_DOCS,
} from '../../scripts/docs-check.mjs';

let root: string;

function write(file: string, content: string) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

function phaseDoc(status: string, sections = PHASE_SECTIONS) {
  return sections
    .map((title, i) => `## ${i + 1}. ${title}\n\n${title === 'Status' ? status : 'Filled in.'}\n`)
    .join('\n');
}

/** A repository whose docs satisfy every rule. */
function writeValidRepo() {
  write('README.md', '# Project');
  write('PROGRESS.md', '# Progress');
  for (const doc of REQUIRED_DOCS) write(`docs/${doc}`, `# ${doc}`);
  write('docs/README.md', REQUIRED_DOCS.map((doc) => `- [${doc}](${doc})`).join('\n'));
  write('docs/phases/phase-00-foundation.md', phaseDoc('Complete (2026-10-16)'));
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'docs-check-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('docs:check', () => {
  it('passes for a complete documentation set', () => {
    writeValidRepo();
    expect(checkDocs(root)).toEqual([]);
  });

  it('reports missing docs and unlinked docs', () => {
    writeValidRepo();
    rmSync(path.join(root, 'docs/TESTING.md'));
    write('docs/README.md', '- [API](API.md)');
    const errors = checkDocs(root);
    expect(errors).toContain('docs/TESTING.md is missing');
    expect(errors).toContain('docs/README.md does not link DATABASE.md');
  });

  it('requires every section once a phase is marked Complete', () => {
    writeValidRepo();
    write(
      'docs/phases/phase-01-auth.md',
      phaseDoc(
        '**Complete**',
        PHASE_SECTIONS.filter((title) => title !== 'Verification results'),
      ),
    );
    expect(checkDocs(root)).toEqual([
      'docs/phases/phase-01-auth.md: marked Complete but missing "Verification results"',
    ]);
  });

  it('allows unfinished sections while a phase is still in progress', () => {
    writeValidRepo();
    write('docs/phases/phase-01-auth.md', phaseDoc('In Progress', ['Goal', 'Status']));
    expect(checkDocs(root)).toEqual([]);
  });

  it('requires a changelog entry when app code changes', () => {
    expect(checkChangelog(['app/[locale]/page.tsx'])).toHaveLength(1);
    expect(checkChangelog(['supabase/migrations/0001_init.sql', 'docs/CHANGELOG.md'])).toEqual([]);
    expect(checkChangelog(['README.md', 'tests/unit/x.test.ts'])).toEqual([]);
  });

  it('exits non-zero from the command line when docs are incomplete', () => {
    const script = path.resolve('scripts/docs-check.mjs');
    const failing = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    expect(failing.status).toBe(1);
    expect(failing.stderr).toContain('docs/CHANGELOG.md is missing');

    writeValidRepo();
    const passing = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    expect(passing.status).toBe(0);
  });
});
