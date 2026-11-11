// With `web.output: "server"`, `expo export` writes the prerendered pages to dist/server only.
// Copy them into dist/client so the host serves them as static files and the service worker can
// precache them for offline use; dist/server still handles the API routes.
import { cpSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const from = 'dist/server';
const to = 'dist/client';
let count = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '_expo') walk(path);
    } else if (entry.name.endsWith('.html')) {
      cpSync(path, join(to, relative(from, path)));
      count++;
    }
  }
}

walk(from);
console.log(`Copied ${count} prerendered pages to ${to}.`);
