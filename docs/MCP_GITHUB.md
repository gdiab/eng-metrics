# GitHub MCP integration plan (read-only)

## Goal

Each engagement lead (TL) can run eng-metrics locally with *their* GitHub credentials, generate reports, and share the Markdown/JSON outputs back with us.

This means:
- No central multi-tenant server.
- The GitHub MCP server runs locally (or in the client environment) and is authenticated with that TL’s token.

## Chosen MCP server

- Official GitHub MCP Server: https://github.com/github/github-mcp-server

## Read-only requirements

We will enforce read-only in two layers:

1) **Server-side read-only**
   - Run the MCP server with read-only enabled (preferred).
   - In HTTP mode, we send `X-MCP-Readonly: true` on every request.

2) **Tool allowlist**
   - Additionally restrict the exposed tools/toolsets to only what eng-metrics needs.
   - This makes the tool surface predictable and reduces risk even further.

## Local run model (per TL / per engagement)

Recommended: run the MCP server in HTTP mode on localhost.

Example (conceptual):

- Start GitHub MCP server locally on a port (default is fine).
- eng-metrics talks to that local server.

Auth:
- Each TL uses their own PAT (or OAuth) appropriate for the client org.
- The token stays local.

## eng-metrics config

Each client config will specify:

- MCP endpoint URL (default: http://127.0.0.1:8082)
- Token source (env var)
- Repo selection (all or allowlist)

## Outputs

- `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.md`
- `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.json`

## Next implementation steps

- Add `mcp.github` section to client config.
- Add a small MCP client in eng-metrics to call GitHub MCP over HTTP.
- Switch GitHub data collection to use MCP tools (not direct GitHub REST via `gh api`).
