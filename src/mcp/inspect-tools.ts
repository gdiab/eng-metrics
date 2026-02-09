import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) throw new Error('Set GITHUB_PERSONAL_ACCESS_TOKEN');

  const transport = new StdioClientTransport({
    command: 'github-mcp-server',
    args: ['stdio', '--read-only', '--toolsets=default'],
    env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token } as Record<string, string>,
    stderr: 'inherit',
  });

  const client = new Client({ name: 'eng-metrics-inspect', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const pick = ['list_pull_requests', 'list_commits', 'get_me', 'get_file_contents', 'get_commit', 'issue_read', 'list_issues', 'repos_list_for_org', 'repos_list_for_user'];
  for (const t of tools) {
    if (pick.includes(t.name) || t.name.startsWith('repos_') || t.name.startsWith('pull_requests_')) {
      console.log('\n===', t.name, '===');
      console.log(JSON.stringify(t.inputSchema, null, 2));
    }
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
