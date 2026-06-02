---
name: run-monthly-report
description: Run a full monthly report by fetching weekly data for every week in the month, then generating the monthly summary. Use when the user says "run monthly report", "monthly report for <month>", or asks for a month's engineering metrics.
---

# Run monthly report

## Overview

Fetch PR data for every week in a given month, then generate the monthly summary from stored data. Weeks are Sun–Sat; partial weeks at month boundaries are trimmed to the month's start/end.

## Steps

### 1. Resolve the month

Parse the user's request into `YYYY-MM`. If the user says a month name without a year (e.g. "march"), use the current year. If that month is in the future, use the previous year.

### 2. Compute week windows

Split the month into non-overlapping windows that cover every day:

- **First partial week**: If the 1st is not a Sunday, the first window is `1st` through the following Saturday.
- **Full weeks**: Each subsequent Sun–Sat that fits entirely in the month.
- **Last partial week**: If the last day is not a Saturday, the final window is the last Sunday through the last day.

Example for a month starting Wednesday the 1st and ending on the 30th:

```
Week 1: Wed 1st  → Sat 4th   (4 days)
Week 2: Sun 5th  → Sat 11th  (7 days)
Week 3: Sun 12th → Sat 18th  (7 days)
Week 4: Sun 19th → Sat 25th  (7 days)
Week 5: Sun 26th → Wed 30th  (5 days)
```

### 3. Fetch each week

For each window, run:

```bash
node dist/cli.js run --client <client> --days <days_in_window> --end <window_end_iso>
```

Where `<window_end_iso>` is `YYYY-MM-DDT23:59:59.999Z` (end of the last day in the window) and `<days_in_window>` is the number of days in that window.

Run these sequentially so the store accumulates all PR data before the monthly rollup.

### 4. Generate the monthly report

After all weeks are fetched:

```bash
node dist/cli.js report --client <client> --period monthly --month <YYYY-MM>
```

### 5. Show the result

Read and display the generated report at `artifacts/<client>/<YYYY-MM>/monthly-metrics.md`.

## Detecting the client

If the user doesn't specify a client, list `clients/*/client.json` to find available clients. If there's only one, use it. If multiple, ask which one.

## Example interaction

User: "run monthly report for march"

Agent computes (for March 2026):
- Mar 1 (Sun) → Mar 7 (Sat): 7 days
- Mar 8 (Sun) → Mar 14 (Sat): 7 days
- Mar 15 (Sun) → Mar 21 (Sat): 7 days
- Mar 22 (Sun) → Mar 28 (Sat): 7 days
- Mar 29 (Sun) → Mar 31 (Tue): 3 days

Then runs:
```bash
node dist/cli.js run --client jouzen --days 7 --end 2026-03-07T23:59:59.999Z
node dist/cli.js run --client jouzen --days 7 --end 2026-03-14T23:59:59.999Z
node dist/cli.js run --client jouzen --days 7 --end 2026-03-21T23:59:59.999Z
node dist/cli.js run --client jouzen --days 7 --end 2026-03-28T23:59:59.999Z
node dist/cli.js run --client jouzen --days 3 --end 2026-03-31T23:59:59.999Z
node dist/cli.js report --client jouzen --period monthly --month 2026-03
```
