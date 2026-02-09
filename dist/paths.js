import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
// Get the directory of the current file (src/paths.ts), then go up one level to repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, '..');
export function clientsDir() {
    return path.join(repoRoot, 'clients');
}
export function clientDir(client) {
    return path.join(clientsDir(), client);
}
export function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}
