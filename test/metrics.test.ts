import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReportMetrics, PullRequestEnriched } from '../src/report/metrics.js';
import { ReportWindow } from '../src/report/periods.js';

const baseRepo = { name: 'repo', full_name: 'acme/repo' };

function pr(overrides: Partial<PullRequestEnriched['pr']>): PullRequestEnriched['pr'] {
  return {
    id: 1,
    number: 1,
    title: 'Test PR',
    html_url: 'https://github.com/acme/repo/pull/1',
    state: 'closed',
    draft: false,
    created_at: '2026-01-05T10:00:00.000Z',
    updated_at: '2026-01-10T10:00:00.000Z',
    closed_at: null,
    merged_at: '2026-01-10T10:00:00.000Z',
    user: { login: 'alice' },
    base: { repo: baseRepo },
    ...overrides,
  };
}

function enriched(prOverrides: Partial<PullRequestEnriched['pr']>, reviews: PullRequestEnriched['reviews']) {
  return { pr: pr(prOverrides), reviews, commits: [] as PullRequestEnriched['commits'] };
}

test('computeReportMetrics computes totals and medians for a window', () => {
  const window: ReportWindow = {
    period: 'monthly',
    label: '2026-01',
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-01-31T23:59:59.999Z',
    days: 31,
  };

  const items: PullRequestEnriched[] = [
    enriched(
      {
        id: 1,
        number: 1,
        created_at: '2026-01-05T00:00:00.000Z',
        merged_at: '2026-01-06T00:00:00.000Z',
        updated_at: '2026-01-06T00:00:00.000Z',
        user: { login: 'alice' },
      },
      [{ id: 10, user: { login: 'reviewer' }, state: 'APPROVED', submitted_at: '2026-01-05T12:00:00.000Z' }],
    ),
    enriched(
      {
        id: 2,
        number: 2,
        created_at: '2026-01-07T10:00:00.000Z',
        closed_at: '2026-01-12T10:00:00.000Z',
        merged_at: null,
        updated_at: '2026-01-12T10:00:00.000Z',
        user: { login: 'bob' },
      },
      [],
    ),
    enriched(
      {
        id: 3,
        number: 3,
        created_at: '2025-12-31T00:00:00.000Z',
        merged_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        user: { login: 'alice' },
      },
      [],
    ),
  ];

  const metrics = computeReportMetrics(items, window);

  assert.equal(metrics.totals.prsOpened, 2);
  assert.equal(metrics.totals.prsMerged, 2);
  assert.equal(metrics.totals.prsClosedUnmerged, 1);

  assert.equal(metrics.byAuthor.alice.prsOpened, 1);
  assert.equal(metrics.byAuthor.alice.prsMerged, 2);
  assert.equal(metrics.byAuthor.alice.prsClosedUnmerged, 0);
  assert.equal(metrics.byAuthor.bob.prsOpened, 1);
  assert.equal(metrics.byAuthor.bob.prsClosedUnmerged, 1);

  assert.equal(metrics.byAuthor.alice.medianCycleTimeHours, 36);
  assert.equal(metrics.byAuthor.alice.medianTimeToFirstReviewHours, 12);
});
