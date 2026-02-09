export type ReportPeriod = 'weekly' | 'monthly' | 'quarterly';

export type ReportWindow = {
  start: string;
  end: string;
  days: number;
  period: ReportPeriod;
  label?: string;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function iso(date: Date) {
  return date.toISOString();
}

function daysBetweenInclusive(startIso: string, endIso: string) {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  return Math.ceil((endMs - startMs + 1) / MS_DAY);
}

function endOfMonthUtc(year: number, monthIndex: number) {
  const startNext = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return new Date(startNext.getTime() - 1);
}

function endOfQuarterUtc(year: number, quarterIndex: number) {
  const startNext = new Date(Date.UTC(year, (quarterIndex + 1) * 3, 1, 0, 0, 0, 0));
  return new Date(startNext.getTime() - 1);
}

function monthLabel(year: number, monthIndex: number) {
  const month = String(monthIndex + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function quarterLabel(year: number, quarterIndex: number) {
  return `${year}-Q${quarterIndex + 1}`;
}

function parseMonth(input: string) {
  const m = input.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`Invalid --month format: ${input}. Expected YYYY-MM.`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid --month value: ${input}. Month must be 01-12.`);
  return { year, monthIndex: month - 1 };
}

function parseQuarter(input: string) {
  const m = input.match(/^(\d{4})-Q([1-4])$/i);
  if (!m) throw new Error(`Invalid --quarter format: ${input}. Expected YYYY-Q[1-4].`);
  const year = Number(m[1]);
  const quarter = Number(m[2]);
  return { year, quarterIndex: quarter - 1 };
}

function lastCompleteMonth(endIso: string) {
  const end = new Date(endIso);
  const year = end.getUTCFullYear();
  const monthIndex = end.getUTCMonth();
  const endOfMonth = endOfMonthUtc(year, monthIndex);
  if (end.getTime() >= endOfMonth.getTime()) {
    return { year, monthIndex };
  }
  if (monthIndex === 0) return { year: year - 1, monthIndex: 11 };
  return { year, monthIndex: monthIndex - 1 };
}

function lastCompleteQuarter(endIso: string) {
  const end = new Date(endIso);
  const year = end.getUTCFullYear();
  const monthIndex = end.getUTCMonth();
  const quarterIndex = Math.floor(monthIndex / 3);
  const endOfQuarter = endOfQuarterUtc(year, quarterIndex);
  if (end.getTime() >= endOfQuarter.getTime()) {
    return { year, quarterIndex };
  }
  if (quarterIndex === 0) return { year: year - 1, quarterIndex: 3 };
  return { year, quarterIndex: quarterIndex - 1 };
}

export type ResolveReportWindowArgs = {
  period: 'monthly' | 'quarterly';
  endIso?: string;
  month?: string;
  quarter?: string;
};

export function resolveReportWindow(args: ResolveReportWindowArgs): ReportWindow {
  const endIso = args.endIso ?? new Date().toISOString();

  if (args.period === 'monthly') {
    if (args.quarter) {
      throw new Error('--quarter is only valid with --period quarterly.');
    }
    const { year, monthIndex } = args.month ? parseMonth(args.month) : lastCompleteMonth(endIso);
    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const end = endOfMonthUtc(year, monthIndex);
    return {
      period: 'monthly',
      label: monthLabel(year, monthIndex),
      start: iso(start),
      end: iso(end),
      days: daysBetweenInclusive(iso(start), iso(end)),
    };
  }

  if (args.period === 'quarterly') {
    if (args.month) {
      throw new Error('--month is only valid with --period monthly.');
    }
    const { year, quarterIndex } = args.quarter ? parseQuarter(args.quarter) : lastCompleteQuarter(endIso);
    const start = new Date(Date.UTC(year, quarterIndex * 3, 1, 0, 0, 0, 0));
    const end = endOfQuarterUtc(year, quarterIndex);
    return {
      period: 'quarterly',
      label: quarterLabel(year, quarterIndex),
      start: iso(start),
      end: iso(end),
      days: daysBetweenInclusive(iso(start), iso(end)),
    };
  }

  throw new Error(`Unsupported period: ${args.period}`);
}
