/**
 * Pipeline — TikTok OAuth backend (Cloudflare Worker)
 *
 * Routes:
 *   GET  /auth/tiktok            start OAuth (redirect to TikTok authorize page)
 *   GET  /callback               OAuth callback: verify state, exchange code, store tokens
 *   GET  /api/status             list connected accounts (masked), requires WORKER_API_TOKEN
 *   GET  /api/access-token       return a usable access token for the local test tool,
 *                                requires WORKER_API_TOKEN
 *   POST /api/refresh            force refresh of stored tokens, requires WORKER_API_TOKEN
 *   POST /api/revoke             revoke + delete stored tokens, requires WORKER_API_TOKEN
 *   GET  /                       tiny status page
 *
 * Secrets (wrangler secret put ...):
 *   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, WORKER_API_TOKEN
 * Bindings:
 *   TIKTOK_TOKENS — Workers KV namespace
 * Vars (wrangler.toml [vars]):
 *   TIKTOK_REDIRECT_URI — must exactly match the Redirect URI registered in TikTok portal
 */

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/';
const SCOPES = 'user.info.basic,video.publish';
const STATE_COOKIE = 'tt_oauth_state';
const STATE_MAX_AGE_SEC = 600;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/auth/tiktok') return handleAuthStart(env);
      if (url.pathname === '/callback') return handleCallback(request, env);
      if (url.pathname === '/api/status') return handleStatus(request, env);
      if (url.pathname === '/api/access-token') return handleAccessToken(request, env);
      if (url.pathname === '/api/refresh' && request.method === 'POST') return handleRefresh(request, env);
      if (url.pathname === '/api/revoke' && request.method === 'POST') return handleRevoke(request, env);
      if (url.pathname === '/') return html(200, indexPage());
      return html(404, page('Not found', '<p>Unknown path.</p>'));
    } catch (err) {
      return html(500, page('Server error', `<p>${escapeHtml(String(err && err.message || err))}</p>`));
    }
  },
};

// ---------- helpers ----------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function html(status, body) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  });
}

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function page(title, inner, extraHead = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — Pipeline</title>${extraHead}
<style>body{font-family:system-ui,sans-serif;background:#0e0e0e;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0}
.card{max-width:560px;padding:40px;background:#161616;border:1px solid #2a2a2a;border-radius:16px}
a{color:#eee}code{background:#1c1c1c;padding:2px 6px;border-radius:6px}</style>
</head><body><div class="card"><h1>${escapeHtml(title)}</h1>${inner}</div></body></html>`;
}

function indexPage() {
  return page('Pipeline TikTok OAuth backend', `
    <p>Worker is running. Connect your TikTok account:</p>
    <p><a href="/auth/tiktok"><strong>Connect TikTok →</strong></a></p>
  `);
}

function requireApiAuth(request, env) {
  const provided = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.WORKER_API_TOKEN || provided !== env.WORKER_API_TOKEN) {
    return json(401, { error: 'unauthorized', description: 'Provide header: Authorization: Bearer <WORKER_API_TOKEN>' });
  }
  return null;
}

function mask(token) {
  if (!token) return null;
  return token.slice(0, 6) + '…' + token.slice(-4);
}

async function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// ---------- OAuth flow ----------

async function handleAuthStart(env) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_REDIRECT_URI) {
    return html(500, page('Not configured', '<p>Set <code>TIKTOK_CLIENT_KEY</code> secret and <code>TIKTOK_REDIRECT_URI</code> var, then redeploy. See README.</p>'));
  }
  // anti-CSRF state: cryptographically random, stored in an HttpOnly cookie
  const buf = crypto.getRandomValues(new Uint8Array(30));
  const state = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');

  const params = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    response_type: 'code',
    scope: SCOPES,
    redirect_uri: env.TIKTOK_REDIRECT_URI,
    state,
  });

  return Response.redirect(`${AUTHORIZE_URL}?${params.toString()}`, 302, {
    'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_MAX_AGE_SEC}`,
  });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  if (error) {
    return html(400, page('Authorization failed', `<p>TikTok returned an error: <code>${escapeHtml(error)}</code></p><p>${escapeHtml(errorDesc || '')}</p><p><a href="/auth/tiktok">Try again</a></p>`));
  }
  if (!code) {
    return html(400, page('Authorization failed', '<p>No authorization code received.</p>'));
  }

  const cookies = await parseCookies(request);
  const savedState = cookies[STATE_COOKIE];
  if (!savedState || !state || savedState !== state) {
    return html(400, page('Security check failed', '<p>OAuth state mismatch (possible CSRF or expired session). Please restart the connection.</p><p><a href="/auth/tiktok">Connect TikTok →</a></p>'));
  }

  // Exchange code for tokens (server-side only — client secret never leaves the Worker)
  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    code: decodeURIComponent(code),
    grant_type: 'authorization_code',
    redirect_uri: env.TIKTOK_REDIRECT_URI,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: body.toString(),
  });
  const data = await res.json();

  if (!res.ok || data.error) {
    return html(502, page('Token exchange failed', `<p><code>${escapeHtml(data.error || res.status)}</code> — ${escapeHtml(data.error_description || 'unknown error')}</p><p>log_id: <code>${escapeHtml(data.log_id || '')}</code></p>`));
  }

  const record = {
    open_id: data.open_id,
    scope: data.scope,
    access_token: data.access_token,
    expires_at: Date.now() + (Number(data.expires_in) || 86400) * 1000,
    refresh_token: data.refresh_token,
    refresh_expires_at: Date.now() + (Number(data.refresh_expires_in) || 31536000) * 1000,
    created_at: Date.now(),
  };
  await env.TIKTOK_TOKENS.put(`token:${record.open_id}`, JSON.stringify(record));

  return html(200, page('TikTok connected', `
    <p>Your TikTok account is connected to Pipeline.</p>
    <p>Account ID: <code>${escapeHtml(record.open_id.slice(0, 8))}…</code><br>
    Granted scopes: <code>${escapeHtml(record.scope || '')}</code></p>
    <p><a href="https://jakolp1488.github.io/pipeline/">Back to the site →</a></p>
  `), { 'Set-Cookie': `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}

// ---------- token storage / API ----------

async function getRecord(env, openId) {
  const raw = await env.TIKTOK_TOKENS.get(`token:${openId}`);
  return raw ? JSON.parse(raw) : null;
}

async function ensureFresh(env, rec) {
  // Refresh proactively when the access token has < 5 min left
  if (rec.expires_at - Date.now() > 5 * 60 * 1000) return rec;
  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: rec.refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || 'refresh failed');
  }
  rec.access_token = data.access_token;
  rec.expires_at = Date.now() + (Number(data.expires_in) || 86400) * 1000;
  if (data.refresh_token) {
    rec.refresh_token = data.refresh_token;
    rec.refresh_expires_at = Date.now() + (Number(data.refresh_expires_in) || 31536000) * 1000;
  }
  await env.TIKTOK_TOKENS.put(`token:${rec.open_id}`, JSON.stringify(rec));
  return rec;
}

async function handleStatus(request, env) {
  const deny = requireApiAuth(request, env);
  if (deny) return deny;
  const accounts = [];
  const { keys } = await env.TIKTOK_TOKENS.list({ prefix: 'token:' });
  for (const k of keys) {
    const rec = await getRecord(env, k.name.replace('token:', ''));
    if (!rec) continue;
    accounts.push({
      open_id: rec.open_id,
      scope: rec.scope,
      access_token_expires_at: new Date(rec.expires_at).toISOString(),
      refresh_token_expires_at: new Date(rec.refresh_expires_at).toISOString(),
      access_token_masked: mask(rec.access_token),
    });
  }
  return json(200, { ok: true, accounts });
}

async function pickAccount(request, env) {
  const url = new URL(request.url);
  let openId = url.searchParams.get('open_id');
  if (!openId) {
    const { keys } = await env.TIKTOK_TOKENS.list({ prefix: 'token:', limit: 1 });
    if (keys.length === 1) openId = keys[0].name.replace('token:', '');
  }
  if (!openId) return { error: json(400, { error: 'missing open_id and no single account stored' }) };
  const rec = await getRecord(env, openId);
  if (!rec) return { error: json(404, { error: 'account not found' }) };
  return { rec };
}

async function handleAccessToken(request, env) {
  const deny = requireApiAuth(request, env);
  if (deny) return deny;
  const { rec, error } = await pickAccount(request, env);
  if (error) return error;
  try {
    const fresh = await ensureFresh(env, rec);
    return json(200, { ok: true, access_token: fresh.access_token, scope: fresh.scope, open_id: fresh.open_id });
  } catch (e) {
    return json(502, { error: 'refresh_failed', description: String(e.message || e) });
  }
}

async function handleRefresh(request, env) {
  const deny = requireApiAuth(request, env);
  if (deny) return deny;
  const { rec, error } = await pickAccount(request, env);
  if (error) return error;
  try {
    const fresh = await ensureFresh(env, { ...rec, expires_at: 0 });
    return json(200, { ok: true, expires_at: new Date(fresh.expires_at).toISOString() });
  } catch (e) {
    return json(502, { error: 'refresh_failed', description: String(e.message || e) });
  }
}

async function handleRevoke(request, env) {
  const deny = requireApiAuth(request, env);
  if (deny) return deny;
  const { rec, error } = await pickAccount(request, env);
  if (error) return error;
  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    token: rec.access_token,
  });
  const res = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: body.toString(),
  });
  await env.TIKTOK_TOKENS.delete(`token:${rec.open_id}`);
  return json(200, { ok: true, revoked: res.ok, open_id: rec.open_id });
}
