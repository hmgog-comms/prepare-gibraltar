#!/usr/bin/env node
/**
 * review.mjs — runs IBM Equal Access (achecker) over every built page, served
 * over HTTP the way production serves it.
 *
 * Until 16 Sept 2026 `npm run review` handed achecker a directory, and achecker
 * opened each page as file://. The stylesheet is linked root-relative
 * (/assets/css/style.css), which under file:// resolves to a path that does
 * not exist — so every scan ran on unstyled markup, and every style-dependent
 * rule (contrast, target size, focus visibility, hidden content) passed on
 * bare HTML. Two real contrast failures were reported as "0 violations".
 *
 * This serves _site from a throwaway local port so root-relative URLs resolve,
 * and skips the CMS admin shell, which is an empty page Decap renders into.
 *
 * Run: npm run review        (builds first, then scans)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '_site');
if (!existsSync(join(SITE, 'index.html'))) {
  console.error('_site/ is empty — run npm run build first (npm run review does).');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = join(SITE, pathname);
  if (!file.startsWith(SITE)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': MIME['.html'] });
    res.end(readFileSync(join(SITE, '404.html')));
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

// Every page except the admin shell, addressed the way a visitor would type it.
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const pages = walk(SITE)
  .filter((f) => f.endsWith('.html') && !relative(SITE, f).startsWith(`admin${sep}`))
  .map((f) => relative(SITE, f).split(sep).join('/'))
  .map((rel) => `${origin}/${rel.replace(/(^|\/)index\.html$/, '$1')}`)
  .sort();

// achecker takes one input: a file, a directory, a URL, or a .txt listing URLs.
mkdirSync(join(ROOT, '.review'), { recursive: true });
const list = join(ROOT, '.review', 'urls.txt');
writeFileSync(list, `${pages.join('\n')}\n`);

console.log(`Scanning ${pages.length} pages at ${origin}/\n`);
const achecker = spawn(
  'npx',
  ['achecker', '--policies', 'IBM_Accessibility,WCAG_2_2', '--failLevels', 'violation', list],
  { cwd: ROOT, stdio: 'inherit' }
);
const code = await new Promise((done) => achecker.on('close', done));
server.close();
process.exit(code ?? 1);
