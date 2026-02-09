import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadConfig } from '../config.js';
import { ensureDir } from '../paths.js';
import { openDb } from '../store/db.js';
import { loadPrsForWindow } from '../store/prs.js';
import { computeReportMetrics } from '../report/metrics.js';
import { renderMarkdown } from '../report/render.js';
import { resolveReportWindow } from '../report/periods.js';

type ReportArgs = {
  client: string;
  period: 'monthly' | 'quarterly';
  endIso?: string;
  month?: string;
  quarter?: string;
  outDir?: string;
};

const FILE_BY_PERIOD: Record<ReportArgs['period'], string> = {
  monthly: 'monthly-metrics',
  quarterly: 'quarterly-metrics',
};

export async function runStoredReport(args: ReportArgs) {
  const cfg = loadConfig(args.client);
  const org = cfg.github.org ?? 'multiple repos';

  const window = resolveReportWindow({
    period: args.period,
    endIso: args.endIso,
    month: args.month,
    quarter: args.quarter,
  });

  const label = window.label ?? window.end.slice(0, 10);
  const outDir = args.outDir ?? path.join('artifacts', args.client, label);
  ensureDir(outDir);

  const items = loadPrsForWindow(args.client, window);
  if (items.length === 0) {
    console.warn(`[${args.client}] No stored PRs found for ${window.period} window ${window.start}..${window.end}`);
  }

  const metrics = computeReportMetrics(items, window);
  const md = renderMarkdown(args.client, org, metrics, cfg.github.people.displayNameByLogin);

  const baseName = FILE_BY_PERIOD[args.period];
  const mdPath = path.join(outDir, `${baseName}.md`);
  const jsonPath = path.join(outDir, `${baseName}.json`);

  fs.writeFileSync(mdPath, md, 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2) + '\n', 'utf-8');

  const db = openDb(args.client);
  const runId = crypto.randomUUID();
  db.prepare(
    `
      INSERT INTO runs (id, client, started_at, start_iso, end_iso)
      VALUES (@id, @client, @started_at, @start_iso, @end_iso)
    `,
  ).run({
    id: runId,
    client: args.client,
    started_at: new Date().toISOString(),
    start_iso: window.start,
    end_iso: window.end,
  });

  console.log(`[${args.client}] Wrote:`);
  console.log(`- ${mdPath}`);
  console.log(`- ${jsonPath}`);
}
