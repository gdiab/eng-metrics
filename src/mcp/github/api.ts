import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export type McpToolResult = { content?: Array<{ type: string; text?: string }> };

export function parseFirstJson<T>(res: McpToolResult): T {
  const txt = res.content?.find((c) => c.type === 'text')?.text;
  if (!txt) throw new Error('MCP tool returned no text content');
  return JSON.parse(txt) as T;
}

export async function searchPullRequests(
  mcp: Client,
  query: string,
  opts: { perPage?: number; page?: number; sort?: 'updated' | 'created'; order?: 'asc' | 'desc' } = {},
) {
  const res = (await mcp.callTool({
    name: 'search_pull_requests',
    arguments: {
      query,
      perPage: opts.perPage ?? 100,
      page: opts.page ?? 1,
      sort: opts.sort ?? 'updated',
      order: opts.order ?? 'desc',
    },
  })) as McpToolResult;

  return parseFirstJson<any>(res);
}

export async function pullRequestGet(mcp: Client, owner: string, repo: string, pullNumber: number) {
  const res = (await mcp.callTool({
    name: 'pull_request_read',
    arguments: { method: 'get', owner, repo, pullNumber },
  })) as McpToolResult;
  return parseFirstJson<any>(res);
}

export async function pullRequestReviews(mcp: Client, owner: string, repo: string, pullNumber: number) {
  const res = (await mcp.callTool({
    name: 'pull_request_read',
    arguments: { method: 'get_reviews', owner, repo, pullNumber, perPage: 100 },
  })) as McpToolResult;
  return parseFirstJson<any>(res);
}

export async function userGet(mcp: Client, login: string) {
  const res = (await mcp.callTool({
    name: 'search_users',
    arguments: { query: login, perPage: 5 },
  })) as McpToolResult;
  return parseFirstJson<any>(res);
}
