# Pipeline

YouTube video processing & TikTok publishing tool — official website, legal pages and
TikTok Content Posting API integration files.

**Website:** https://jakolp1488.github.io/pipeline/

## Repo layout

| Path | Purpose |
|---|---|
| `index.html`, `styles.css`, `config.js` | GitHub Pages site (plain HTML/CSS/JS). `config.js` holds the OAuth button URL — put your deployed Worker URL here. |
| `privacy.html`, `terms.html` | Privacy Policy & Terms of Service (URLs required by TikTok Developer Portal) |
| `index.md`, `privacy.md`, `terms.md` | Markdown sources mirroring the site pages |
| `tiktok-oauth/` | Cloudflare Worker implementing the official TikTok OAuth (Login Kit) flow + KV token storage. See its README |
| `tiktok_test.py` | CLI to test the official Content Posting API (creator info, Direct Post, status). Publishing requires an explicit `--yes` |
| `TIKTOK_SETUP.md` | 20-step guide through TikTok Developer Portal + Cloudflare deployment |
| `TIKTOK_API.md` | Verified official endpoints, scopes, rate limits, error codes |
| `TIKTOK_REVIEW.md` | App Review / audit requirements and demo-video script |
| `WHAT_I_MUST_DO.md` | Short manual-actions checklist |

## Security rules

- `TIKTOK_CLIENT_SECRET` lives **only** in Cloudflare Secrets (`wrangler secret put`).
- Access/refresh tokens live **only** in Cloudflare KV behind the Worker.
- Nothing secret is committed: check `.gitignore` (`.env`, `.dev.vars`).

## Quick start

1. `tiktok-oauth/` → deploy per its README.
2. Fill `config.js` + `wrangler.toml` with the Worker URL, push.
3. `python tiktok_test.py check` → `creator-info` → `publish --file ... --yes`.
