import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export type GithubMcpServerConfig = {
  command?: string;
  toolsets?: string; // e.g. default,repos,pull_requests,users
  readOnly?: boolean;
  env?: Record<string, string>;
};

export function githubMcpTransport(cfg: GithubMcpServerConfig) {
  const command = cfg.command ?? 'github-mcp-server';
  const toolsets = cfg.toolsets ?? 'default';
  const readOnly = cfg.readOnly ?? true;

  const args = ['stdio'];
  if (readOnly) args.push('--read-only');
  args.push(`--toolsets=${toolsets}`);

  return new StdioClientTransport({
    command,
    args,
    env: cfg.env,
    stderr: 'inherit',
  });
}
