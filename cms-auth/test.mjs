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
 * Run: node cms-auth/test.mjs
 */
import worker from './index.js';
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

// /callback posts to the cookie's origin — but only if it is still allow-listed.
const callbackTarget = async (cookieOrigin) => {
  const res = await worker.fetch(new Request(`${W}/callback?code=x&state=nomatch`, {
    headers: { Cookie: `decap_oauth_state=other; decap_oauth_origin=${encodeURIComponent(cookieOrigin)}` },
  }), env);
  return (await res.text()).match(/"origin":"([^"]+)"/)[1];
};
check('/callback honours a valid origin cookie',
  await callbackTarget('https://prepare.gov.gi'), 'https://prepare.gov.gi');
check('/callback REJECTS a tampered origin cookie',
  await callbackTarget('https://evil.example.com'), 'https://prepare-gibraltar.pages.dev');

console.log(fails ? `\n  ${fails} FAILED` : '\n  all passed');
process.exit(fails ? 1 : 0);
