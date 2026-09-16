/**
 * Which origin does the OAuth proxy hand the GitHub token to?
 *
 * This is the security-critical question in this worker, and it got the wrong
 * answer for a while: ALLOWED_ORIGINS was documented and parsed as a list, but
 * the callback always used entry [0]. A second origin could be configured and
 * would silently never receive a token — which is how the CMS would have behaved
 * at prepare.gov.gi/admin, with no error message, just a sign-in that hangs.
 *
 * The rule these tests hold to: site_id comes from the browser and only SELECTS
 * from the configured list. An unrecognised site_id, or a tampered cookie, falls
 * back to a configured origin — it is never echoed back. Echoing it would hand a
 * working GitHub credential to whoever asked for it.
 *
 * Two kinds of check, because they fail differently:
 *
 *  1. The selection logic, against a fixture list. Proves the code.
 *  2. The configuration: cms-auth/wrangler.toml must list the origin the CMS is
 *     served from (site_url in admin/config.yml) and https://prepare.gov.gi, the
 *     address it moves to. Until 16 Sept 2026 only (1) existed, so the file
 *     could lose an origin and this test would stay green while /admin/ on that
 *     origin hung after GitHub authorised.
 *
 * What this cannot check: the worker that is actually deployed. After any change
 * to wrangler.toml run `npx wrangler deploy` and confirm with
 * `curl -s https://prepare-gibraltar-cms-auth.pressoffice.workers.dev/health`.
 *
 * Run: node cms-auth/test.mjs   (also runs in CI as npm run test:auth)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const env = {
  GITHUB_OAUTH_ID: 'id', GITHUB_OAUTH_SECRET: 'secret',
  ALLOWED_ORIGINS: 'https://prepare-gibraltar.pages.dev,https://prepare.gov.gi',
};
const W = 'https://cms-auth.workers.dev';
const originCookie = (res) => {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const c = all.find((h) => h && h.startsWith('decap_oauth_origin='));
  return c ? decodeURIComponent(c.split(';')[0].split('=').slice(1).join('=')) : null;
};

let fails = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}\n          got ${got}\n         want ${want}`);
};

console.log('Selection logic (fixture list)');

// /auth chooses the origin from site_id, but only from the configured list.
for (const [siteId, want] of [
  ['prepare.gov.gi',                'https://prepare.gov.gi'],
  ['prepare-gibraltar.pages.dev',   'https://prepare-gibraltar.pages.dev'],
  ['PREPARE.GOV.GI',                'https://prepare.gov.gi'],
  ['https://prepare.gov.gi/admin/', 'https://prepare.gov.gi'],
  ['evil.example.com',              'https://prepare-gibraltar.pages.dev'],
  ['',                              'https://prepare-gibraltar.pages.dev'],
]) {
  const res = await worker.fetch(new Request(`${W}/auth?provider=github&site_id=${encodeURIComponent(siteId)}`), env);
  check(`/auth site_id=${JSON.stringify(siteId)}`, originCookie(res), want);
}

// /callback posts to the cookie's origin — but only if it is still allow-listed —
// and a state mismatch must come back as an error, never as a token.
const callback = async (cookieOrigin) => {
  const res = await worker.fetch(new Request(`${W}/callback?code=x&state=nomatch`, {
    headers: { Cookie: `decap_oauth_state=other; decap_oauth_origin=${encodeURIComponent(cookieOrigin)}` },
  }), env);
  const body = await res.text();
  return {
    origin: (body.match(/"origin":"([^"]+)"/) || [])[1],
    status: (body.match(/"status":"([^"]+)"/) || [])[1],
  };
};
const valid = await callback('https://prepare.gov.gi');
check('/callback honours a valid origin cookie', valid.origin, 'https://prepare.gov.gi');
check('/callback reports a state mismatch as an error', valid.status, 'error');
const tampered = await callback('https://evil.example.com');
check('/callback REJECTS a tampered origin cookie', tampered.origin, 'https://prepare-gibraltar.pages.dev');
check('/callback still reports the mismatch as an error', tampered.status, 'error');

console.log('\nConfiguration (cms-auth/wrangler.toml against admin/config.yml)');

const toml = readFileSync(join(HERE, 'wrangler.toml'), 'utf8');
const configured = (toml.match(/^ALLOWED_ORIGINS\s*=\s*"([^"]*)"/m) || [, ''])[1]
  .split(',').map((s) => s.trim()).filter(Boolean);
const cmsConfig = readFileSync(join(HERE, '..', 'admin', 'config.yml'), 'utf8');
const siteUrl = (cmsConfig.match(/^site_url:\s*(\S+)/m) || [])[1];
const siteOrigin = siteUrl ? new URL(siteUrl).origin : '(site_url not found in admin/config.yml)';

check('wrangler.toml lists the origin the CMS is served from', configured.includes(siteOrigin), true);
check('wrangler.toml lists https://prepare.gov.gi', configured.includes('https://prepare.gov.gi'), true);
check('every configured origin is an https origin with no path',
  configured.every((o) => { try { const u = new URL(o); return u.protocol === 'https:' && u.pathname === '/' && !u.search; } catch { return false; } }),
  true);

console.log(fails ? `\n  ${fails} FAILED` : '\n  all passed');
process.exit(fails ? 1 : 0);
