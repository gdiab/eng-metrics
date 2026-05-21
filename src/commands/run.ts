import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadConfig } from '../config.js';
import { ensureDir } from '../paths.js';
import { openDb } from '../store/db.js';
import { computeWeeklyMetrics } from '../report/metrics.js';
import { renderMarkdown } from '../report/render.js';
import { connectGithubMcp } from '../mcp/github/client.js';
import { searchPullRequests as mcpSearchPRs, pullRequestGet, pullRequestReviews } from '../mcp/github/api.js';

function isoNow() {
  return new Date().toISOString();
}

function subtractDays(endIso: string, days: number) {
  const end = new Date(endIso);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return start.toISOString();
}

type RunArgs = {
  client: string;
  days: number;
  endIso?: string;
  outDir?: string;
};

function buildSearchQuery(
  repoFullNames: string[],
  startIso: string,
  endIso: string,
): string {
  const timeRange = `updated:${startIso}..${endIso}`;
  const repoQueries = repoFullNames.map((r) => `repo:${r}`).join(' ');
  return `${repoQueries} is:pr ${timeRange}`;
}

function buildOrgSearchQuery(org: string, startIso: string, endIso: string): string {
  return `org:${org} is:pr updated:${startIso}..${endIso}`;
}

/**
 * Resolve the list of "owner/repo" strings to search.
 * - org + all  → null (use org-wide query)
 * - org + allowlist → expand short names with org prefix
 * - no org + allowlist → must already be "owner/repo"
 */
function resolveRepoList(
  org: string | undefined,
  repos: { mode: 'all' | 'allowlist'; allowlist: string[] },
): string[] | null {
  if (org && repos.mode === 'all') return null;

  const names = repos.allowlist.map((r) =>
    r.includes('/') ? r : org ? `${org}/${r}` : null,
  );
  const valid = names.filter((n): n is string => n !== null);

  if (valid.length === 0) {
    throw new Error(
      org
        ? `Allowlist is empty — add repos to github.repos.allowlist or set mode to "all".`
        : `Cannot search without org: repos must be in "owner/repo" format. Found: ${repos.allowlist.join(', ')}`,
    );
  }
  return valid;
}

export async function runReport(args: RunArgs) {
  const cfg = loadConfig(args.client);
  const org = cfg.github.org;

  const startedAt = isoNow();
  const endIso = args.endIso ?? startedAt;
  const startIso = subtractDays(endIso, args.days);

  const outDir = args.outDir ?? path.join('artifacts', args.client, endIso.slice(0, 10));
  ensureDir(outDir);

  const runId = crypto.randomUUID();

  // MCP: spawn GitHub's official MCP server locally in read-only mode (stdio).
  // Token handling:
  // - For portability, we expect auth.mode=token and tokenEnv to be set.
  // - If auth.mode=gh, we still rely on tokenEnv being present (TLs may not have gh installed).
  const tokenEnv = cfg.github.auth.tokenEnv ?? 'GITHUB_PERSONAL_ACCESS_TOKEN';
  const token = process.env[tokenEnv];
  if (!token) {
    throw new Error(
      `Missing GitHub token env var ${tokenEnv}. For TL-run usage, set auth=token and export ${tokenEnv}=<PAT>.`,
    );
  }

  const mcp = await connectGithubMcp({
    readOnly: true,
    toolsets: 'default',
    env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token } as Record<string, string>,
  });

  const repoList = resolveRepoList(org, cfg.github.repos);
  const allItems: any[] = [];
  const BATCH_SIZE = 5;

  if (repoList) {
    // Targeted search: query only the repos we care about (batched)
    const batches: string[][] = [];
    for (let i = 0; i < repoList.length; i += BATCH_SIZE) {
      batches.push(repoList.slice(i, i + BATCH_SIZE));
    }
    console.log(`[${args.client}] Fetching PRs via MCP for ${repoList.length} repo(s) window=${startIso}..${endIso}`);

    for (let bi = 0; bi < batches.length; bi++) {
      const q = buildSearchQuery(batches[bi], startIso, endIso);
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const search = await mcpSearchPRs(mcp as any, q, { perPage: 100, page, sort: 'updated', order: 'desc' });
        const items = search.items ?? [];
        allItems.push(...items);
        hasMore = items.length === 100 && allItems.length < 1000;
        if (hasMore) {
          page++;
          console.log(`[${args.client}] Fetched ${allItems.length} PRs so far, continuing...`);
        }
      }
      if (batches.length > 1) {
        console.log(`[${args.client}] Batch ${bi + 1}/${batches.length}: ${allItems.length} total PRs so far`);
      }
    }
  } else {
    // org + "all" mode: search entire org
    const q = buildOrgSearchQuery(org!, startIso, endIso);
    console.log(`[${args.client}] Fetching PRs via MCP for org=${org} window=${startIso}..${endIso}`);
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const search = await mcpSearchPRs(mcp as any, q, { perPage: 100, page, sort: 'updated', order: 'desc' });
      const items = search.items ?? [];
      allItems.push(...items);
      hasMore = items.length === 100 && allItems.length < 1000;
      if (hasMore) {
        page++;
        console.log(`[${args.client}] Fetched ${allItems.length} PRs so far, continuing...`);
      }
    }
  }

  // Track PRs per repo for logging
  const prsByRepo = new Map<string, number>();
  const wanted = allItems.filter((it) => {
    const m = String(it.html_url ?? '').match(/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
    if (!m) return false;
    prsByRepo.set(`${m[1]}/${m[2]}`, (prsByRepo.get(`${m[1]}/${m[2]}`) || 0) + 1);
    return true;
  });

  if (prsByRepo.size > 0) {
    console.log(`[${args.client}] PRs found per repo:`);
    for (const [repo, count] of Array.from(prsByRepo.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${repo}: ${count} PR(s)`);
    }
  }

  // Enrich PRs: fetch details + reviews in parallel (capped concurrency)
  const CONCURRENCY = 5;
  console.log(`[${args.client}] Enriching ${wanted.length} PRs via MCP (details + reviews, concurrency=${CONCURRENCY})`);
  const enriched: { pr: any; reviews: any[]; commits: any[] }[] = [];

  for (let i = 0; i < wanted.length; i += CONCURRENCY) {
    const batch = wanted.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (it) => {
        const m = String(it.html_url ?? '').match(/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
        if (!m) return null;
        const [owner, repo, num] = [m[1], m[2], Number(m[3])];
        const [pr, reviews] = await Promise.all([
          pullRequestGet(mcp as any, owner, repo, num),
          pullRequestReviews(mcp as any, owner, repo, num),
        ]);
        return { pr, reviews: reviews ?? [], commits: [] };
      }),
    );
    enriched.push(...results.filter((r): r is NonNullable<typeof r> => r !== null));
  }

  await mcp.close();

  // Persist PRs (so we can do month/quarter later)
  const db = openDb(args.client);
  const insert = db.prepare(`
    INSERT INTO prs (client, repo_full_name, pr_number, pr_json, created_at, updated_at, closed_at, merged_at, author_login)
    VALUES (@client, @repo_full_name, @pr_number, @pr_json, @created_at, @updated_at, @closed_at, @merged_at, @author_login)
    ON CONFLICT(client, repo_full_name, pr_number) DO UPDATE SET
      pr_json=excluded.pr_json,
      updated_at=excluded.updated_at,
      closed_at=excluded.closed_at,
      merged_at=excluded.merged_at,
      author_login=excluded.author_login
  `);

  const tx = db.transaction(() => {
    for (const it of enriched) {
      const pr = it.pr;
      insert.run({
        client: args.client,
        repo_full_name: pr.base.repo.full_name,
        pr_number: pr.number,
        pr_json: JSON.stringify(it),
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        closed_at: pr.closed_at,
        merged_at: pr.merged_at,
        author_login: pr.user?.login ?? null,
      });
    }
  });
  tx();

  db.prepare(
    `
      INSERT INTO runs (id, client, started_at, start_iso, end_iso)
      VALUES (@id, @client, @started_at, @start_iso, @end_iso)
    `,
  ).run({
    id: runId,
    client: args.client,
    started_at: startedAt,
    start_iso: startIso,
    end_iso: endIso,
  });

  const metrics = computeWeeklyMetrics(enriched as any, {
    start: startIso,
    end: endIso,
    days: args.days,
    period: 'weekly',
  });

  // Display names: start with explicit config overrides.
  // (We can optionally extend this later by resolving names via MCP if needed.)
  const displayNameByLogin: Record<string, string> = { ...cfg.github.people.displayNameByLogin };

  const md = renderMarkdown(args.client, org ?? 'multiple repos', metrics, displayNameByLogin);

  const mdPath = path.join(outDir, 'weekly-metrics.md');
  const jsonPath = path.join(outDir, 'weekly-metrics.json');

  fs.writeFileSync(mdPath, md, 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2) + '\n', 'utf-8');

  console.log(`[${args.client}] Wrote:`);
  console.log(`- ${mdPath}`);
  console.log(`- ${jsonPath}`);
}
