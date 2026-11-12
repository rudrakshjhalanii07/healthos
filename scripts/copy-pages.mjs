// With `web.output: "server"`, `expo export` writes the prerendered pages to dist/server only.
// Copy them into dist/client so the host serves them as static files and the service worker can
// precache them for offline use; dist/server still handles the API routes.
//
// On the way, each page gets a Content-Security-Policy <meta> that allows its inline scripts by
// hash and nothing else inline. vercel.json sends the rest of the policy as a header; browsers
// enforce both, so only these exact scripts (plus same-origin files) can run.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const from = 'dist/server';
const to = 'dist/client';
let count = 0;

function withScriptPolicy(html) {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    ([, body]) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
  );
  const policy = `script-src 'self' ${hashes.join(' ')}`;
  if (!html.includes('<head>')) throw new Error('No <head> to add the CSP to');
  return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}"/>`);
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '_expo') walk(path);
    } else if (entry.name.endsWith('.html')) {
      const dest = join(to, relative(from, path));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, withScriptPolicy(readFileSync(path, 'utf8')));
      count++;
    }
  }
}

walk(from);
console.log(`Copied ${count} prerendered pages to ${to}, each with a script CSP.`);
