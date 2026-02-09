import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
export function githubMcpTransport(cfg) {
    const command = cfg.command ?? 'github-mcp-server';
    const toolsets = cfg.toolsets ?? 'default';
    const readOnly = cfg.readOnly ?? true;
    const args = ['stdio'];
    if (readOnly)
        args.push('--read-only');
    args.push(`--toolsets=${toolsets}`);
    return new StdioClientTransport({
        command,
        args,
        env: cfg.env,
        stderr: 'inherit',
    });
}
