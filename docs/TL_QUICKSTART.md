# TL Quickstart: eng-metrics (GitHub-only, MCP-backed, read-only)

This tool is designed for a Team Lead (TL) to run locally for a specific client engagement, generate a weekly metrics report for the last 7 days, and share the output artifacts.

## What you get

- A Markdown report: `weekly-metrics.md`
- A JSON export: `weekly-metrics.json`

Both are written under `artifacts/<client>/<YYYY-MM-DD>/`.

## Prereqs

1) Node.js 20+ (or newer)
2) GitHub auth: either a **Personal Access Token (PAT)** with read access to the org/repos, or the **logged-in gh user** (see below)
3) Install GitHub’s official MCP server

### Install GitHub MCP server

macOS (Homebrew):

```bash
brew install github-mcp-server
```

Verify:

```bash
github-mcp-server --version
```

## Install eng-metrics

Clone:

```bash
git clone https://github.com/gdiab/eng-metrics.git
cd eng-metrics
```

Install deps + build:

```bash
npm install
npm run build
```

## Set your GitHub token

You can use either a PAT or the token from your logged-in `gh` user.

**Option 1: Logged-in gh user (no PAT needed)**

If you’re already logged in with `gh auth login`:

```bash
export GITHUB_TOKEN=$(gh auth token)
```

**Option 2: Personal Access Token**

Create a PAT with read access to the org/repos, then:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
```

(You can keep the PAT in your shell profile or a password manager.)

**Example:** If you already have a PAT exported:

```bash
# Your PAT is already exported
export GITHUB_TOKEN="ghp_abc123..."

# Now you can run init without specifying --token-env
node dist/cli.js init --client acme --org my-org --auth token --repos select
```

**Using a different env var name:**

If your token is exported under a different name (e.g., `GITHUB_PERSONAL_ACCESS_TOKEN`):

```bash
# Export with a custom name
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_abc123..."

# Specify the env var name with --token-env (must be on same line or use backslash)
node dist/cli.js init \
  --client acme \
  --org my-org \
  --auth token \
  --token-env GITHUB_PERSONAL_ACCESS_TOKEN \
  --repos select

# Or all on one line:
node dist/cli.js init --client acme --org my-org --auth token --token-env GITHUB_PERSONAL_ACCESS_TOKEN --repos select
```

**Important:** The value for `--token-env` must be on the same line as the flag, or use a backslash `\` for line continuation. Don't put the env var name on a separate line.

**Note:** The default token env var name is `GITHUB_TOKEN`, so you can omit `--token-env` when running `init`. If you prefer a different name (e.g., `GITHUB_PERSONAL_ACCESS_TOKEN`), specify it with `--token-env`.

Notes:
- eng-metrics reads your token from the env var configured during onboarding (`--token-env`, default: `GITHUB_TOKEN`).
- Internally, eng-metrics passes that value to the GitHub MCP server as `GITHUB_PERSONAL_ACCESS_TOKEN`.
- eng-metrics runs the MCP server in **read-only** mode.
- The token never leaves your machine; it is used only to query GitHub.

## Onboard a client engagement

Choose a short slug for the client/engagement (kebab-case recommended, e.g., `acme`, `widgets-inc`, `client-2024`).

**You can set up in two ways:**

1. **With a GitHub org** (recommended if all repos are in one org)
2. **Without an org** (if repos span multiple orgs/users - see below)

**Example:** For a client called "Acme Corp" with GitHub org `acme-corp`:

### Option A: select repos interactively (recommended)

If you already have `GITHUB_TOKEN` exported:

```bash
# Token already exported (from earlier step)
export GITHUB_TOKEN="ghp_your_token_here"

# Run init
node dist/cli.js init \
  --client acme \
  --org acme-corp \
  --auth token \
  --repos select
```

Replace `acme` with your client slug and `acme-corp` with your actual GitHub org name.

(Since `GITHUB_TOKEN` is the default, `--token-env` can be omitted.)

### Option B: include all repos

```bash
node dist/cli.js init \
  --client acme \
  --org acme-corp \
  --auth token \
  --repos all
```

Replace `acme` with your client slug and `acme-corp` with your actual GitHub org name.

(Since `GITHUB_TOKEN` is the default, `--token-env` can be omitted.)

If you need to rerun onboarding:

```bash
node dist/cli.js reinit --client acme --repos select
```

(Replace `acme` with your client slug.)

## What to expect after init

After `init` completes successfully, you should see:

```
Initialized client: acme
Config: /path/to/clients/acme/client.json
Store:  /path/to/clients/acme/store
```

**What was created:**

1. **Config file** (`clients/<client>/client.json`): Contains your GitHub org, auth settings, selected repos, and people mappings
2. **Store directory** (`clients/<client>/store/`): Local SQLite database for storing PR data

**If you used `--repos select`:** You should have been prompted interactively to choose which repos to track. 

**If you weren't prompted:** This usually means:
- The token env var wasn't found (check that `GITHUB_TOKEN` is exported)
- The MCP connection failed silently
- No repos were found for the org
- The org name might be incorrect
- No org was specified (repo selection requires an org)

**Working without an org:**

If you don't have a GitHub org (or repos span multiple orgs), you can:
1. Initialize without an org: `init --client <client> --auth token`
2. Manually edit `clients/<client>/client.json` to add repos in `"owner/repo"` format:
   ```json
   {
     "github": {
       "repos": {
         "mode": "allowlist",
         "allowlist": ["gdiab/repo1", "other-org/repo2"]
       }
     }
   }
   ```
3. Run reports - it will search those specific repos

**Next step:** Run your first report (see below).

## Run a weekly report

Generate a report for the last 7 days:

```bash
node dist/cli.js run --client acme --days 7
```

(Replace `acme` with your client slug.)

You can also run it at any time; it always looks back from “now” unless you pass `--end <ISO>`.

## Run monthly/quarterly reports (from stored data)

These reports read from the local SQLite store (no GitHub calls). They require that weekly runs have already stored PR snapshots.

```bash
# Last complete month
node dist/cli.js report --client acme --period monthly

# Explicit month
node dist/cli.js report --client acme --period monthly --month 2026-01

# Last complete quarter
node dist/cli.js report --client acme --period quarterly

# Explicit quarter
node dist/cli.js report --client acme --period quarterly --quarter 2025-Q4
```

Notes:
- Default behavior uses the last complete period relative to `--end` (or now if omitted).
- If the store is empty for that period, you will still get a report but totals will be zero.

## Share artifacts

Send these two files to George:

- `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.md`
- `artifacts/<client>/<YYYY-MM-DD>/weekly-metrics.json`
- `artifacts/<client>/<YYYY-MM>/monthly-metrics.{md,json}` (if requested)
- `artifacts/<client>/<YYYY-Q#>/quarterly-metrics.{md,json}` (if requested)

## Safety

- The GitHub MCP server is launched by eng-metrics with `--read-only`.
- No GitHub write operations are performed.

## Troubleshooting

- Missing token: ensure your token env var is exported in the same shell (default: `GITHUB_TOKEN`, or whatever you set via `--token-env`).
- Auth/scopes: ensure your PAT has enough permissions to read the repos you selected.
- Repo list seems incomplete: onboarding currently uses GitHub search and shows the top ~100 recently-updated repos for selection.
