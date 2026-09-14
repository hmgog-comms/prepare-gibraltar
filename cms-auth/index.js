/**
 * GitHub OAuth proxy for Decap CMS.
 *
 * Decap runs entirely in the browser and cannot hold a client secret, so it needs
 * a small server-side endpoint to exchange an OAuth code for an access token.
 * This worker is that endpoint, and nothing else.
 *
 *   /auth?provider=github   redirects the editor to GitHub's consent screen
 *   /callback               exchanges the code and hands the token back to /admin/
 *
 * Configuration
 *   GITHUB_OAUTH_ID       plain var  — OAuth App client ID (public by design)
 *   GITHUB_OAUTH_SECRET   secret     — set with `wrangler secret put`, never committed
 *   ALLOWED_ORIGINS       plain var  — comma-separated site origins allowed to
 *                                      receive the token, e.g.
 *                                      "https://prepare-gibraltar.pages.dev,https://prepare.gov.gi"
 *
 * Scope is `public_repo`, not `repo`: the content repository is public, and editors
 * should not be granting an app write access to all of their private repositories.
 */

const SCOPE = 'public_repo,user';
const STATE_COOKIE = 'decap_oauth_state';

/** 256 bits of state, vs. the 32 bits used by the implementation this is based on. */
function randomState() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

/**
 * The page Decap's popup lands on. It posts the result to the opener and closes.
 *
 * The token is posted to an explicit origin rather than '*', so that a page on
 * another origin cannot open this popup and receive a working GitHub credential.
 */
function callbackPage(status, payload, targetOrigin) {
  const body = JSON.stringify({
    status,
    message: `authorization:github:${status}:${JSON.stringify(payload)}`,
    origin: targetOrigin,
  });

  return new Response(
    `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
<p>Completing sign-in…</p>
<script>
(function () {
  var data = ${body};
  if (!window.opener) {
    document.body.textContent = 'This page must be opened from the CMS sign-in button.';
    return;
  }
  function send() { window.opener.postMessage(data.message, data.origin); }
  // Decap announces itself first, then expects the payload in reply.
  window.addEventListener('message', function handler() {
    send();
    window.removeEventListener('message', handler, false);
  }, false);
  window.opener.postMessage('authorizing:github', data.origin);
  setTimeout(send, 500);
})();
</script>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

function handleAuth(url, env) {
  if (url.searchParams.get('provider') !== 'github') {
    return new Response('Invalid provider', { status: 400 });
  }
  if (!env.GITHUB_OAUTH_ID || !env.GITHUB_OAUTH_SECRET) {
    return new Response('OAuth is not configured on this worker.', { status: 500 });
  }

  const state = randomState();
  const redirectUri = `${url.origin}/callback`;
  const authorizeUrl =
    'https://github.com/login/oauth/authorize' +
    `?response_type=code&client_id=${encodeURIComponent(env.GITHUB_OAUTH_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&state=${state}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      // Lax is correct: the callback arrives as a top-level GET redirect from github.com.
      'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}

async function handleCallback(request, url, env) {
  const origins = allowedOrigins(env);
  const targetOrigin = origins[0];
  if (!targetOrigin) {
    return new Response('ALLOWED_ORIGINS is not configured on this worker.', { status: 500 });
  }

  const clear = `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  const fail = (msg) => {
    const res = callbackPage('error', { message: msg }, targetOrigin);
    res.headers.append('Set-Cookie', clear);
    return res;
  };

  // The state must match the cookie set when this flow began. Without this check
  // the state parameter is decorative and the flow is open to CSRF.
  const expected = readCookie(request, STATE_COOKIE);
  const got = url.searchParams.get('state');
  if (!expected || !got || expected !== got) {
    return fail('Sign-in session expired or invalid. Close this window and try again.');
  }

  const ghError = url.searchParams.get('error');
  if (ghError) return fail(url.searchParams.get('error_description') || ghError);

  const code = url.searchParams.get('code');
  if (!code) return fail('GitHub did not return an authorization code.');

  let json;
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_OAUTH_ID,
        client_secret: env.GITHUB_OAUTH_SECRET,
        code,
        redirect_uri: `${url.origin}/callback`,
        grant_type: 'authorization_code',
      }),
    });
    json = await res.json();
  } catch (e) {
    return fail('Could not reach GitHub to complete sign-in.');
  }

  // GitHub returns 200 with an error body on failure, so checking the token is
  // the only reliable test. The original implementation reported success here
  // with an undefined token.
  if (!json || !json.access_token) {
    return fail(json?.error_description || 'GitHub did not issue an access token.');
  }

  const res = callbackPage('success', { token: json.access_token, provider: 'github' }, targetOrigin);
  res.headers.append('Set-Cookie', clear);
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/auth') return handleAuth(url, env);
    if (url.pathname === '/callback') return handleCallback(request, url, env);
    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        configured: Boolean(env.GITHUB_OAUTH_ID && env.GITHUB_OAUTH_SECRET),
        allowedOrigins: allowedOrigins(env),
      });
    }
    return new Response('Decap CMS OAuth proxy for Prepare Gibraltar.', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
