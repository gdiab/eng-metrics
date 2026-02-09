import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/store/db.js';
import { loadPrsForWindow } from '../src/store/prs.js';

const prevEnv = process.env.ENG_METRICS_CLIENTS_DIR;

test('loadPrsForWindow returns PRs that intersect the window via created/merged/closed', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-metrics-'));
  process.env.ENG_METRICS_CLIENTS_DIR = path.join(tempDir, 'clients');

  try {
    let db;
    try {
      db = openDb('acme');
    } catch (err: any) {
      if (err?.code === 'ERR_DLOPEN_FAILED') {
        t.skip('better-sqlite3 binary unavailable for this Node version');
        return;
      }
      throw err;
    }
    const insert = db.prepare(`
      INSERT INTO prs (client, repo_full_name, pr_number, pr_json, created_at, updated_at, closed_at, merged_at, author_login)
      VALUES (@client, @repo_full_name, @pr_number, @pr_json, @created_at, @updated_at, @closed_at, @merged_at, @author_login)
    `);

    const base = {
      client: 'acme',
      repo_full_name: 'acme/repo',
      author_login: 'alice',
      updated_at: '2026-01-15T00:00:00.000Z',
    };

    insert.run({
      ...base,
      pr_number: 1,
      pr_json: JSON.stringify({ pr: { number: 1 }, reviews: [], commits: [] }),
      created_at: '2026-01-05T00:00:00.000Z',
      closed_at: null,
      merged_at: null,
    });

    insert.run({
      ...base,
      pr_number: 2,
      pr_json: JSON.stringify({ pr: { number: 2 }, reviews: [], commits: [] }),
      created_at: '2025-12-20T00:00:00.000Z',
      closed_at: null,
      merged_at: '2026-01-20T00:00:00.000Z',
    });

    insert.run({
      ...base,
      pr_number: 3,
      pr_json: JSON.stringify({ pr: { number: 3 }, reviews: [], commits: [] }),
      created_at: '2025-12-10T00:00:00.000Z',
      closed_at: '2026-01-10T00:00:00.000Z',
      merged_at: null,
    });

    insert.run({
      ...base,
      pr_number: 4,
      pr_json: JSON.stringify({ pr: { number: 4 }, reviews: [], commits: [] }),
      created_at: '2025-10-01T00:00:00.000Z',
      closed_at: null,
      merged_at: null,
    });

    const items = loadPrsForWindow('acme', {
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-31T23:59:59.999Z',
    });

    const numbers = items.map((item: any) => item.pr.number).sort();
    assert.deepEqual(numbers, [1, 2, 3]);
    db.close();
  } finally {
    if (prevEnv) {
      process.env.ENG_METRICS_CLIENTS_DIR = prevEnv;
    } else {
      delete process.env.ENG_METRICS_CLIENTS_DIR;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
