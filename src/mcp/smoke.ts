import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) throw new Error('Set GITHUB_PERSONAL_ACCESS_TOKEN (you can get one via: gh auth token)');

  const transport = new StdioClientTransport({
    command: 'github-mcp-server',
    args: ['stdio', '--read-only', '--toolsets=default'],
    env: {
      ...process.env,
      GITHUB_PERSONAL_ACCESS_TOKEN: token,
    } as Record<string, string>,
  });

  const client = new Client({ name: 'eng-metrics-smoke', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log(`Connected. Tool count: ${tools.tools.length}`);
  console.log(tools.tools.slice(0, 15).map((t) => t.name));

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
