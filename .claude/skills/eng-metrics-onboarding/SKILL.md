---
name: eng-metrics-onboarding
description: Onboard a new client engagement into the eng-metrics repo (GitHub org + auth + repo selection + people mapping), verify access, and produce a first weekly report.
---

# eng-metrics onboarding

## Goal
Create a new client config, verify GitHub access, select repos, and generate the first report.

## Steps
1) Confirm client slug (kebab-case) and GitHub org.
2) Choose auth mode:
   - `gh` (recommended for local dev)
   - `token` (recommended for automation); store token in an env var.
3) Select repos:
   - `all` or `select` (interactive allowlist)
4) (Optional) Set people display names:
   - Preferred output format: `Display Name (login)`.
5) Run a report for the last 7 days.

## Commands
```bash
# build once
npm install
npm run build

# init
node dist/cli.js init --client <client> --org <org> --auth gh --repos select

# run
node dist/cli.js run --client <client> --days 7
```

## Validation checklist
- Report files exist: weekly-metrics.md + weekly-metrics.json
- By-engineer section uses display names when available
- Repo selection matches expectation (all vs allowlist)

## Notes
If init fails due to auth/permissions, rerun onboarding:
```bash
node dist/cli.js reinit --client <client> --org <org> --auth gh --repos select
```
