export function parseFirstJson(res) {
    const txt = res.content?.find((c) => c.type === 'text')?.text;
    if (!txt)
        throw new Error('MCP tool returned no text content');
    return JSON.parse(txt);
}
export async function searchPullRequests(mcp, query, opts = {}) {
    const res = (await mcp.callTool({
        name: 'search_pull_requests',
        arguments: {
            query,
            perPage: opts.perPage ?? 100,
            page: opts.page ?? 1,
            sort: opts.sort ?? 'updated',
            order: opts.order ?? 'desc',
        },
    }));
    return parseFirstJson(res);
}
export async function pullRequestGet(mcp, owner, repo, pullNumber) {
    const res = (await mcp.callTool({
        name: 'pull_request_read',
        arguments: { method: 'get', owner, repo, pullNumber },
    }));
    return parseFirstJson(res);
}
export async function pullRequestReviews(mcp, owner, repo, pullNumber) {
    const res = (await mcp.callTool({
        name: 'pull_request_read',
        arguments: { method: 'get_reviews', owner, repo, pullNumber, perPage: 100 },
    }));
    return parseFirstJson(res);
}
export async function userGet(mcp, login) {
    const res = (await mcp.callTool({
        name: 'search_users',
        arguments: { query: login, perPage: 5 },
    }));
    return parseFirstJson(res);
}
