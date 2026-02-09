import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Get the directory of the current file (src/paths.ts), then go up one level to repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, '..');

export function clientsDir() {
  const override = process.env.ENG_METRICS_CLIENTS_DIR;
  if (override && override.trim()) return override;
  return path.join(repoRoot, 'clients');
}

export function clientDir(client: string) {
  return path.join(clientsDir(), client);
}

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}
