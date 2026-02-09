import { connectGithubMcp } from './github/client.js';

async function main() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) throw new Error('missing token');
  const client = await connectGithubMcp({
    env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token } as Record<string, string>,
    toolsets: 'default',
    readOnly: true,
  });

  const res = await client.callTool({ name: 'get_me', arguments: {} });
  console.log(JSON.stringify(res, null, 2));

  await client.close();
}

main();
