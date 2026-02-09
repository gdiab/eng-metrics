import { connectGithubMcp } from './github/client.js';
import { searchPullRequests } from './github/api.js';
async function main() {
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!token)
        throw new Error('missing token');
    const mcp = await connectGithubMcp({ env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token }, toolsets: 'default', readOnly: true });
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const q = `org:gdiab is:pr updated:${start}..${end}`;
    const raw = await searchPullRequests(mcp, q, { perPage: 5 });
    console.log(JSON.stringify(raw, null, 2).slice(0, 1200));
    await mcp.close();
}
main();
