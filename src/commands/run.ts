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

export async function runReport(args: RunArgs) {
  const cfg = loadConfig(args.client);
  const org = cfg.github.org;
  if (!org) throw new Error(`Missing github.org in client config. Run: eng-metrics reinit --client ${args.client} --org <org>`);

  const endIso = args.endIso ?? isoNow();
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

  console.log(`[${args.client}] Fetching PRs via MCP for org=${org} window=${startIso}..${endIso}`);
  const q = `org:${org} is:pr updated:${startIso}..${endIso}`;
  const search = await mcpSearchPRs(mcp as any, q, { perPage: 100, page: 1, sort: 'updated', order: 'desc' });
  const items: any[] = search.items ?? [];

  const wanted = items.filter((it) => {
    const m = String(it.html_url ?? '').match(/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
    if (!m) return false;
    const repoName = m[2];
    return cfg.github.repos.mode === 'allowlist' ? cfg.github.repos.allowlist.includes(repoName) : true;
  });

  console.log(`[${args.client}] Enriching ${wanted.length} PRs via MCP (details + reviews)`);
  const enriched = [] as { pr: any; reviews: any[]; commits: any[] }[];
  for (const it of wanted) {
    const m = String(it.html_url ?? '').match(/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
    if (!m) continue;
    const owner = m[1];
    const repo = m[2];
    const num = Number(m[3]);

    const pr = await pullRequestGet(mcp as any, owner, repo, num);
    const reviews = await pullRequestReviews(mcp as any, owner, repo, num);

    enriched.push({ pr, reviews: reviews ?? [], commits: [] });
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

  const metrics = computeWeeklyMetrics(enriched as any, { start: startIso, end: endIso, days: args.days });

  // Display names: start with explicit config overrides.
  // (We can optionally extend this later by resolving names via MCP if needed.)
  const displayNameByLogin: Record<string, string> = { ...cfg.github.people.displayNameByLogin };

  const md = renderMarkdown(args.client, org, metrics, displayNameByLogin);

  const mdPath = path.join(outDir, 'weekly-metrics.md');
  const jsonPath = path.join(outDir, 'weekly-metrics.json');

  fs.writeFileSync(mdPath, md, 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2) + '\n', 'utf-8');

  console.log(`[${args.client}] Wrote:`);
  console.log(`- ${mdPath}`);
  console.log(`- ${jsonPath}`);
}
