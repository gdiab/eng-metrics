import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { githubMcpTransport, GithubMcpServerConfig } from './server.js';

export async function connectGithubMcp(cfg: GithubMcpServerConfig) {
  const transport = githubMcpTransport(cfg);
  const client = new Client({ name: 'eng-metrics', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}
