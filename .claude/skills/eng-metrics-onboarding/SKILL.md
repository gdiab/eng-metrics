---
name: eng-metrics-onboarding
description: Onboard a new client engagement into the eng-metrics repo (GitHub org + auth + repo selection + people mapping), verify access, and produce a first weekly report.
---

# eng-metrics onboarding

## Goal
Create a new client config, verify GitHub access, select repos, and generate the first report.

## Steps
1) Confirm client slug (kebab-case, e.g., `acme`, `widgets-inc`).
2) Determine setup approach:
   - **With GitHub org** (if all repos are in one org)
   - **Without org** (if repos span multiple orgs/users)
3) Set up GitHub authentication:
   - Export token: `export GITHUB_TOKEN=$(gh auth token)` (for logged-in gh user)
   - Or: `export GITHUB_TOKEN="ghp_your_pat"` (for PAT)
   - Default env var is `GITHUB_TOKEN`; use `--token-env` if different
4) Choose auth mode:
   - `token` (recommended for TL-run usage)
   - `gh` (uses gh CLI auth, but still needs token env var for MCP)
5) Select repos:
   - `all` - track all repos in org
   - `select` - interactive selection (works with or without org)
   - Without org: will list your repos and let you select
6) (Optional) Set people display names:
   - Preferred output format: `Display Name (login)`.
   - Edit `clients/<client>/client.json` to add `displayNameByLogin` mappings
7) Run a report for the last 7 days.
8) (Optional) Generate a monthly or quarterly report from stored data.

## Commands

### With GitHub org
```bash
# build once
npm install
npm run build

# init with org
node dist/cli.js init --client <client> --org <org> --auth token --repos select

# run report
node dist/cli.js run --client <client> --days 7

# optional: last complete month
node dist/cli.js report --client <client> --period monthly

# optional: last complete quarter
node dist/cli.js report --client <client> --period quarterly
```

### Without GitHub org
```bash
# init without org (will prompt for repo selection)
node dist/cli.js init --client <client> --auth token --repos select

# Or manually edit clients/<client>/client.json to add repos in "owner/repo" format:
# {
#   "github": {
#     "repos": {
#       "mode": "allowlist",
#       "allowlist": ["gdiab/repo1", "other-org/repo2"]
#     }
#   }
# }

# run report
node dist/cli.js run --client <client> --days 7

# optional: explicit month/quarter from stored data
node dist/cli.js report --client <client> --period monthly --month 2026-01
node dist/cli.js report --client <client> --period quarterly --quarter 2025-Q4
```

## File locations
- Config: `clients/<client>/client.json` (gitignored)
- Store: `clients/<client>/store/` (SQLite database, gitignored)
- Reports: `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.{md,json}`
- Monthly: `artifacts/<client>/<YYYY-MM>/monthly-metrics.{md,json}`
- Quarterly: `artifacts/<client>/<YYYY-Q#>/quarterly-metrics.{md,json}`

## Validation checklist
- Report files exist: `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.md` + `.json`
- By-engineer section uses display names when available
- Repo selection matches expectation (all vs allowlist)
- Per-repo PR counts shown in logs during run
- All configured repos are searched (check logs for "PRs found per repo")
- Monthly/quarterly reports generate from the local SQLite store

## Automation

After initial setup, you can automate weekly reports:

### Cron Setup
- Create a script that runs `node dist/cli.js run --client <client> --days 7` for each client
- Schedule with crontab: `0 5 * * 1` (Monday 5 AM)
- Store PAT securely (not in script directly)
- Log output to a file for debugging: `>> logs/cron.log 2>&1`

### GitHub Actions
- Create `.github/workflows/weekly-metrics.yml`
- Use scheduled trigger: `cron: '0 5 * * 1'`
- Store `GITHUB_TOKEN` as repository secret
- Upload artifacts and optionally commit to repo

See README.md "Automation" section for complete examples.

## Notes
- If init fails due to auth/permissions, rerun onboarding:
  ```bash
  node dist/cli.js reinit --client <client> --org <org> --auth token --repos select
  ```
- If no repos found: check org name, token permissions, or token scopes (`read:org` may be needed)
- Repos are batched automatically when searching without org (GitHub API limit: ~5-10 repos per query)
- Pagination automatically fetches all PRs (up to GitHub's 1000 result limit)
