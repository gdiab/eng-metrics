# Architecture (eng-metrics)

## Current (v0)

Today the tool is a config-driven CLI:

- **CLI**: `eng-metrics init|reinit|run`
- **Data source**: GitHub via `gh api` (either using gh auth or explicit token header)
- **Storage**: per-client SQLite store (`clients/<client>/store/metrics.sqlite`) for raw PR snapshots
- **Outputs**: Markdown report + JSON summary under `artifacts/<client>/<date>/`
  - Weekly: `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.*`
  - Monthly: `artifacts/<client>/<YYYY-MM>/monthly-metrics.*`
  - Quarterly: `artifacts/<client>/<YYYY-Q#>/quarterly-metrics.*`

This is intentionally simple so we can ship and iterate.

## Target (v1): MCP connectors + skills-first workflow

To align with the blog post example and keep the layers clean, we should split:

- **MCP servers** (connectivity)
  - GitHub MCP: list/search PRs, get reviews/commits, resolve users
  - Jira MCP: pull issues/sprints/teams (fast follow)

- **Skills** (procedure)
  - Onboarding a client engagement
  - Running weekly report + validation
  - Backfilling a month/quarter (from stored data)
  - Updating people/team mappings

- **Runtime**
  - Local files + local compute + report generation

The eng-metrics CLI can remain the “orchestrator” and call MCP servers (either locally or remote) instead of calling GitHub directly.

## Why MCP here?

- Auth per engagement becomes explicit and swappable.
- We can standardize the tool surface for GitHub + Jira.
- The blog example becomes real: MCP handles access, skills define procedure.

## Plan

1) Keep current GitHub implementation working.
2) Add an MCP GitHub adapter (minimal set of tools we need).
3) Switch the CLI to call MCP for GitHub reads.
4) Add Jira MCP + metrics joins.
