import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { githubMcpTransport } from './server.js';
export async function connectGithubMcp(cfg) {
    const transport = githubMcpTransport(cfg);
    const client = new Client({ name: 'eng-metrics', version: '0.1.0' }, { capabilities: {} });
    await client.connect(transport);
    return client;
}
