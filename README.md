# eng-metrics (WIP)

A multi-client, config-driven CLI that pulls GitHub activity and generates weekly engineering metrics, plus monthly/quarterly reports from stored data.

## Goals
- Works across multiple client engagements (different GitHub orgs + auth)
- Onboarding via CLI (`init` / `reinit`)
- Runnable on-demand (defaults to “past 7 days”) and automatable (cron/GitHub Actions)
- Output: Markdown report + JSON metrics
- Persist raw data so you can generate last-month / last-quarter views

## Quickstart

### Using the AI Skill (Recommended)

If you're using Claude/Codex with this repo, you can use the built-in onboarding skill:

1. **Ask the AI to onboard a client:**
   - "Help me onboard a new client engagement"
   - "Set up eng-metrics for acme-corp"
   - "Onboard client 'widgets-inc' with GitHub org 'widgets'"

2. **The AI will guide you through:**
   - Setting up GitHub authentication
   - Selecting repos (interactive or all)
   - Running your first report
   - Validating the setup

The skill provides step-by-step guidance and handles common issues automatically.

### Manual Setup

- **TLs:** see `docs/TL_QUICKSTART.md` for detailed instructions

## Automation

You can automate weekly reports to run locally every Monday at 5 AM (or any schedule you prefer) using cron.

### Cron Setup (Recommended for Local Automation)

Create a script that runs reports for all your clients:

**`scripts/weekly-report.sh`:**
```bash
#!/bin/bash
# Weekly eng-metrics report runner

# Configuration
ENG_METRICS_DIR="/path/to/eng-metrics"

# Set your GitHub token (use a PAT, not gh auth token for automation)
# Better: source from a secure file
source ~/.eng-metrics-token  # Contains: export GITHUB_TOKEN="ghp_..."

# Navigate to eng-metrics directory
cd "$ENG_METRICS_DIR"

# Run report for each client
node dist/cli.js run --client acme --days 7
node dist/cli.js run --client widgets-inc --days 7
# Add more clients as needed
```

Make it executable:
```bash
chmod +x scripts/weekly-report.sh
```

Add to crontab (runs every Monday at 5 AM):
```bash
crontab -e
```

Add this line:
```
0 5 * * 1 /path/to/eng-metrics/scripts/weekly-report.sh >> /path/to/eng-metrics/logs/cron.log 2>&1
```

**Note:** The script will log output to the cron log file. Check logs if reports fail.

**Security note:** Store your PAT securely:
- Use a dedicated PAT with minimal scopes (`repo` read access)
- Store it in a secure file: `chmod 600 ~/.eng-metrics-token`
- Source it in your script: `source ~/.eng-metrics-token`

### Alternative: GitHub Actions (Optional)

If you prefer cloud-based automation, you can use GitHub Actions. Create `.github/workflows/weekly-metrics.yml`:

```yaml
name: Weekly Metrics Report

on:
  schedule:
    # Every Monday at 5 AM UTC (adjust timezone as needed)
    - cron: '0 5 * * 1'
  workflow_dispatch: # Allow manual trigger

jobs:
  generate-reports:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Install GitHub MCP server
        run: |
          # Install github-mcp-server (adjust for your OS)
          # For Linux: download binary or use Docker
          # For macOS: brew install (if runner supports it)
      
      - name: Generate reports
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # Or use a custom PAT secret
        run: |
          node dist/cli.js run --client acme --days 7
          node dist/cli.js run --client widgets-inc --days 7
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: weekly-metrics-${{ github.run_id }}
          path: artifacts/
          retention-days: 90
      
      # Optional: Commit artifacts back to repo
      - name: Commit artifacts
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add artifacts/
          git commit -m "Weekly metrics report $(date +%Y-%m-%d)" || exit 0
          git push
```

**Setup:**
1. Add `GITHUB_TOKEN` (or a custom PAT) as a repository secret
2. The workflow will run every Monday at 5 AM UTC
3. Artifacts are uploaded and optionally committed to the repo

**Note:** For local automation, use the cron approach above instead.

### Handling Multiple Clients

Both approaches support multiple clients. Simply run the `run` command for each client:

```bash
# In your script or workflow
for client in acme widgets-inc client-3; do
  node dist/cli.js run --client "$client" --days 7
done
```

### Output Location

Reports are saved to:
- `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.md`
- `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.json`
- `artifacts/<client>/<YYYY-MM>/monthly-metrics.md`
- `artifacts/<client>/<YYYY-MM>/monthly-metrics.json`
- `artifacts/<client>/<YYYY-Q#>/quarterly-metrics.md`
- `artifacts/<client>/<YYYY-Q#>/quarterly-metrics.json`

You can:
- Commit artifacts to git (if not gitignored)
- Upload to a shared drive/cloud storage
- Store in a database for historical analysis

## Monthly/Quarterly Reports (from stored data)

Monthly and quarterly reports are generated from the local SQLite store (no GitHub calls).

```bash
# Last complete month (based on now)
node dist/cli.js report --client acme --period monthly

# Explicit month
node dist/cli.js report --client acme --period monthly --month 2026-01

# Last complete quarter (based on now)
node dist/cli.js report --client acme --period quarterly

# Explicit quarter
node dist/cli.js report --client acme --period quarterly --quarter 2025-Q4
```

**Notes:**
- Default behavior uses the last complete period relative to `--end` (or now if omitted).
- Monthly/quarterly reports depend on what has been stored in `clients/<client>/store/metrics.sqlite`. Run weekly reports regularly to build history.

## Status
WIP — GitHub-only implementation is working; MCP-backed read-only mode is the default.
