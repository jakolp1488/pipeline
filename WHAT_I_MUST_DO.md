# Чек-лист: что осталось сделать вручную

## TikTok Developer Portal
- [ ] Создать приложение `Pipeline` (тип Web app) — TIKTOK_SETUP.md шаги 1–5
- [ ] Website URL: `https://jakolp1488.github.io/pipeline/` — шаг 6
- [ ] Terms URL: `.../pipeline/terms.html` — шаг 7
- [ ] Privacy URL: `.../pipeline/privacy.html` — шаг 8
- [ ] Добавить продукт **Login Kit** — шаг 9
- [ ] Добавить продукт **Content Posting API** и включить в нём **Direct Post** — шаг 9
- [ ] Подать/подтвердить scope **`video.publish`** — шаг 10
- [ ] Скопировать Client Key и Client Secret — шаги 12–13

## Cloudflare
- [ ] `npx wrangler login` + `npx wrangler kv namespace create TIKTOK_TOKENS` → id в `wrangler.toml` — шаг 16
- [ ] `npx wrangler secret put TIKTOK_CLIENT_KEY` — шаг 16
- [ ] `npx wrangler secret put TIKTOK_CLIENT_SECRET` (только так, нигде больше!) — шаг 16
- [ ] `npx wrangler secret put WORKER_API_TOKEN` (придумать строку) — шаг 16
- [ ] `npx wrangler deploy` → скопировать Worker URL — шаг 16

## После деплоя
- [ ] В `wrangler.toml` → `TIKTOK_REDIRECT_URI` = `<WorkerURL>/callback` → redeploy — шаг 17
- [ ] В TikTok Portal → Login Kit → Redirect URI = тот же `<WorkerURL>/callback` — шаг 17
- [ ] В `config.js` сайта → `OAUTH_URL = "<WorkerURL>/auth/tiktok"` → commit + push — шаг 17
- [ ] Локально: `.env.example` → `.env`, заполнить Worker URL + API токен — шаг 17

## Проверка
- [ ] Нажать Connect TikTok на сайте → «TikTok connected» — шаг 17
- [ ] `python tiktok_test.py status` — шаг 18
- [ ] `python tiktok_test.py creator-info` — шаг 18
- [ ] `python tiktok_test.py publish --file test.mp4 --privacy SELF_ONLY --yes`
      (приватный пост; так работает до audit) — шаг 19
- [ ] **Direct Post до audit требует ЗАКРЫТОГО аккаунта** (на открытом — 403
      `unaudited_client_can_only_post_to_private_accounts`). Сейчас @marketal7 открытый →
      либо перевести аккаунт в Private, либо пользоваться inbox-режимом
      (видео → уведомление во «Входящие» приложения TikTok → тап → Опубликовать;
      это НЕ «Черновики»), либо ждать audit

## App Review
- [ ] Снять demo-видео по сценарию из TIKTOK_REVIEW.md
- [ ] Подать на Content Posting API audit → получить публичный постинг — шаг 20
