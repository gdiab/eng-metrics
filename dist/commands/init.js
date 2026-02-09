import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { saveConfig, loadConfig } from '../config.js';
import { clientDir, ensureDir } from '../paths.js';
import { ClientConfigSchema } from '../types.js';
import { connectGithubMcp } from '../mcp/github/client.js';
import { listOrgRepositories, listUserRepositories } from '../mcp/github/repos.js';
import { getCurrentUser } from '../mcp/github/api.js';
function normalizeAuth(mode) {
    const m = (mode ?? 'gh').toLowerCase();
    if (m !== 'gh' && m !== 'token')
        throw new Error(`Invalid auth mode: ${mode}. Use gh|token.`);
    return m;
}
async function chooseReposIfPossible(cfg, preferred) {
    const org = cfg.github.org;
    const pref = (preferred ?? '').toLowerCase();
    // If no org but user wants to select repos, list repos from authenticated user
    if (!org && pref === 'select') {
        try {
            const tokenEnv = cfg.github.auth.tokenEnv ?? 'GITHUB_TOKEN';
            const token = process.env[tokenEnv];
            if (!token) {
                console.warn(`⚠️  Warning: Missing GitHub token env var: ${tokenEnv}`);
                console.warn(`   Repo selection skipped. Set ${tokenEnv} and try again.`);
                return cfg;
            }
            const mcp = await connectGithubMcp({
                readOnly: true,
                toolsets: 'default',
                env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token },
            });
            // Get current user
            const currentUser = await getCurrentUser(mcp);
            const username = currentUser.login;
            console.log(`Fetching repositories for user: ${username}...`);
            // List repos owned by the user
            const repos = await listUserRepositories(mcp, username);
            await mcp.close();
            if (repos.length === 0) {
                console.warn(`⚠️  Warning: No repositories found for user '${username}'.`);
                console.warn(`   Defaulting to 'all' repos mode.`);
                return cfg;
            }
            const { selected } = await prompts({
                type: 'multiselect',
                name: 'selected',
                message: `Select repos to track (${repos.length} available):`,
                choices: repos.map((r) => ({ title: r, value: r })),
                min: 1,
                hint: '- Space to select. Enter to confirm.',
            });
            cfg.github.repos = { mode: 'allowlist', allowlist: selected ?? [] };
            console.log(`✓ Configured ${(selected ?? []).length} repo(s) in allowlist mode`);
            return cfg;
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.warn(`⚠️  Warning: Repo selection failed: ${errorMsg}`);
            console.warn(`   Defaulting to 'all' repos. Run 'reinit --repos select' to try again.`);
            return cfg;
        }
    }
    if (!org) {
        return cfg;
    }
    if (pref === 'all') {
        cfg.github.repos = { mode: 'all', allowlist: [] };
        return cfg;
    }
    // If we don't have gh auth configured yet, this may fail; we treat it as optional.
    try {
        const tokenEnv = cfg.github.auth.tokenEnv ?? 'GITHUB_TOKEN';
        const token = process.env[tokenEnv];
        if (!token) {
            console.warn(`⚠️  Warning: Missing GitHub token env var: ${tokenEnv}`);
            console.warn(`   Repo selection skipped. Defaulting to 'all' repos.`);
            console.warn(`   Set ${tokenEnv} and run 'reinit --repos select' to choose repos.`);
            return cfg;
        }
        const mcp = await connectGithubMcp({
            readOnly: true,
            toolsets: 'default',
            env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token },
        });
        const repos = await listOrgRepositories(mcp, org);
        await mcp.close();
        if (repos.length === 0) {
            console.warn(`⚠️  Warning: No repositories found for org '${org}'.`);
            console.warn(`   Possible reasons:`);
            console.warn(`   - Org name is incorrect (check spelling)`);
            console.warn(`   - Token doesn't have access to this org`);
            console.warn(`   - Org has no repositories`);
            console.warn(`   - Token needs 'read:org' scope`);
            console.warn(`   `);
            console.warn(`   Defaulting to 'all' repos mode. When you run reports, it will search`);
            console.warn(`   for PRs in this org. If the org name is wrong, fix it with:`);
            console.warn(`   reinit --client ${cfg.client} --org <correct-org>`);
            return cfg;
        }
        const { repoMode } = pref === 'select'
            ? { repoMode: 'select' }
            : await prompts({
                type: 'select',
                name: 'repoMode',
                message: `Track which repos for org ${org}?`,
                choices: [
                    { title: 'All repos', value: 'all' },
                    { title: 'Select repos (recommended)', value: 'select' },
                ],
                initial: 1,
            });
        if (repoMode === 'all') {
            cfg.github.repos = { mode: 'all', allowlist: [] };
            return cfg;
        }
        const { selected } = await prompts({
            type: 'multiselect',
            name: 'selected',
            message: 'Select repos to include',
            choices: repos.map((r) => ({ title: r, value: r })),
            min: 1,
            hint: '- Space to select. Enter to confirm.',
        });
        cfg.github.repos = { mode: 'allowlist', allowlist: selected ?? [] };
        return cfg;
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️  Warning: Repo selection failed: ${errorMsg}`);
        console.warn(`   Defaulting to 'all' repos. Run 'reinit --repos select' to try again.`);
        return cfg;
    }
}
export async function initClient(args) {
    const dir = clientDir(args.client);
    if (fs.existsSync(path.join(dir, 'client.json'))) {
        throw new Error(`Client already initialized: ${args.client}. Use reinit.`);
    }
    ensureDir(dir);
    ensureDir(path.join(dir, 'store'));
    let cfg = {
        client: args.client,
        github: {
            org: args.org,
            repos: { mode: 'all', allowlist: [] },
            auth: {
                mode: normalizeAuth(args.auth),
                tokenEnv: args.tokenEnv ?? 'GITHUB_TOKEN',
            },
            people: { displayNameByLogin: {} },
        },
    };
    // If org is present, try to do repo selection (interactive when possible).
    cfg = await chooseReposIfPossible(cfg, args.repos);
    const parsed = ClientConfigSchema.parse(cfg);
    saveConfig(parsed);
    console.log(`Initialized client: ${args.client}`);
    console.log(`Config: ${path.join(dir, 'client.json')}`);
    console.log(`Store:  ${path.join(dir, 'store')}`);
    if (!parsed.github.org) {
        console.log(`\n⚠️  Note: GitHub org not set.`);
        console.log(`   - Reports can still run if your repo allowlist uses owner/repo format (e.g. gdiab/eng-metrics).`);
        console.log(`   - Otherwise set org with: reinit --client ${args.client} --org <org-name>`);
    }
}
export async function reinitClient(args) {
    const existing = loadConfig(args.client);
    let cfg = {
        ...existing,
        github: {
            ...existing.github,
            org: args.org ?? existing.github.org,
            auth: {
                ...existing.github.auth,
                mode: args.auth ? normalizeAuth(args.auth) : existing.github.auth.mode,
                tokenEnv: args.tokenEnv ?? existing.github.auth.tokenEnv,
            },
        },
    };
    // If requested, allow re-selecting repos.
    if (args.repos) {
        cfg = await chooseReposIfPossible(cfg, args.repos);
    }
    const parsed = ClientConfigSchema.parse(cfg);
    saveConfig(parsed);
    console.log(`Updated client: ${args.client}`);
}
