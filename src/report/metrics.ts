import { PullRequest, Review, Commit } from '../github/types.js';
import { ReportWindow } from './periods.js';

export type PullRequestEnriched = {
  pr: PullRequest;
  reviews: Review[];
  commits: Commit[];
};

export type ReportMetrics = {
  window: ReportWindow;
  totals: {
    prsOpened: number;
    prsMerged: number;
    prsClosedUnmerged: number;
  };
  byAuthor: Record<
    string,
    {
      prsOpened: number;
      prsMerged: number;
      prsClosedUnmerged: number;
      medianCycleTimeHours?: number;
      medianTimeToFirstReviewHours?: number;
    }
  >;
};

function isoToMs(iso: string | null) {
  return iso ? Date.parse(iso) : null;
}

function median(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeReportMetrics(items: PullRequestEnriched[], window: ReportWindow): ReportMetrics {
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);

  const byAuthor: ReportMetrics['byAuthor'] = {};
  const ensure = (login: string) => {
    byAuthor[login] ??= { prsOpened: 0, prsMerged: 0, prsClosedUnmerged: 0 };
    return byAuthor[login];
  };

  let prsOpened = 0;
  let prsMerged = 0;
  let prsClosedUnmerged = 0;

  const cycleTimesByAuthor: Record<string, number[]> = {};
  const tfrByAuthor: Record<string, number[]> = {};

  for (const it of items) {
    const pr = it.pr;
    const author = pr.user?.login ?? 'unknown';

    const createdMs = Date.parse(pr.created_at);
    const mergedMs = isoToMs(pr.merged_at);
    const closedMs = isoToMs(pr.closed_at);

    if (createdMs >= startMs && createdMs <= endMs) {
      prsOpened++;
      ensure(author).prsOpened++;
    }

    if (mergedMs && mergedMs >= startMs && mergedMs <= endMs) {
      prsMerged++;
      ensure(author).prsMerged++;

      const cycleHours = (mergedMs - createdMs) / (1000 * 60 * 60);
      (cycleTimesByAuthor[author] ??= []).push(cycleHours);

      // time to first review: earliest submitted review time minus created
      const reviewSubmitted = it.reviews
        .map((r) => r.submitted_at)
        .filter((d): d is string => Boolean(d))
        .map((d) => Date.parse(d))
        .sort((a, b) => a - b);
      if (reviewSubmitted.length > 0) {
        const tfrHours = (reviewSubmitted[0] - createdMs) / (1000 * 60 * 60);
        (tfrByAuthor[author] ??= []).push(tfrHours);
      }
    } else if (closedMs && closedMs >= startMs && closedMs <= endMs) {
      // closed but not merged
      prsClosedUnmerged++;
      ensure(author).prsClosedUnmerged++;
    }
  }

  for (const [author, arr] of Object.entries(cycleTimesByAuthor)) {
    ensure(author).medianCycleTimeHours = median(arr);
  }
  for (const [author, arr] of Object.entries(tfrByAuthor)) {
    ensure(author).medianTimeToFirstReviewHours = median(arr);
  }

  return {
    window,
    totals: { prsOpened, prsMerged, prsClosedUnmerged },
    byAuthor,
  };
}

export type WeeklyMetrics = ReportMetrics;

export function computeWeeklyMetrics(
  items: PullRequestEnriched[],
  window: Omit<ReportWindow, 'period'> & { period?: ReportWindow['period'] },
): WeeklyMetrics {
  return computeReportMetrics(items, {
    ...window,
    period: window.period ?? 'weekly',
  });
}
