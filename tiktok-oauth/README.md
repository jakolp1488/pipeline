# Pipeline TikTok OAuth Worker

Cloudflare Worker that performs the TikTok OAuth 2.0 authorization-code flow for Pipeline
and stores user access/refresh tokens server-side in Workers KV.

## What it does

1. `GET /auth/tiktok` — generates a CSRF `state`, sets it as an HttpOnly cookie, redirects to
   `https://www.tiktok.com/v2/auth/authorize/` with scopes `user.info.basic,video.publish`.
2. `GET /callback` — verifies `state`, exchanges the `code` for tokens at
   `https://open.tiktokapis.com/v2/oauth/token/`, stores them in KV (never logged, never sent to the browser).
3. `GET /api/status` — lists connected accounts (tokens masked). Requires `Authorization: Bearer <WORKER_API_TOKEN>`.
4. `GET /api/access-token` — returns a fresh access token for the local test tool. Requires the same header.
   Auto-refreshes expired tokens (`grant_type=refresh_token`).
5. `POST /api/refresh` / `POST /api/revoke` — manual refresh / revoke+delete.

## Deploy (from the `tiktok-oauth/` folder)

```bash
npm install                 # installs wrangler
npx wrangler login          # opens browser, log in to your Cloudflare account

# 1. Create the KV namespace, copy the printed id into wrangler.toml ([[kv_namespaces]] id = "...")
npx wrangler kv namespace create TIKTOK_TOKENS

# 2. Set secrets (values come from TikTok Developer Portal -> your app -> "Manage apps")
npx wrangler secret put TIKTOK_CLIENT_KEY      # paste Client Key
npx wrangler secret put TIKTOK_CLIENT_SECRET   # paste Client Secret
npx wrangler secret put WORKER_API_TOKEN       # invent a long random string; also put it in ../../.env

# 3. Deploy
npx wrangler deploy

# 4. Copy your Worker URL from the deploy output, e.g.
#    https://pipeline-tiktok-oauth.<your-subdomain>.workers.dev
#    - register  <worker-url>/callback  as Redirect URI in the TikTok portal
#    - set TIKTOK_REDIRECT_URI in wrangler.toml to the same value, redeploy
#    - put      <worker-url>/auth/tiktok into ../config.js (website button)
```

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in values (git-ignored)
npx wrangler dev
```
