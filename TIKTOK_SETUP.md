# TikTok Developer Setup — пошаговая инструкция

Всё, что можно сделать автоматизировано, уже сделано в этом репозитории.
Ниже — действия, которые требует доступа к твоим аккаунтам.

---

## ШАГ 1. Открыть TikTok Developer Portal
Зайди на **https://developers.tiktok.com** →右下角/правый верхний угол → **Log in** →
войди через свой TikTok-аккаунт (отсканируй QR с телефона или введи логин/пароль).
Затем открой **https://developers.tiktok.com/apps/** (Manage apps).

## ШАГ 2. Создать приложение
В **Manage apps** нажми кнопку **Create app**. Если аккаунт ещё не верифицирован —
портал сначала попросит подтвердить email и телефон в настройках аккаунта (Settings).

## ШАГ 3. App Name
Введи: `Pipeline`

## ШАГ 4. Category / App type
Выбери тип **Web app** (это server-side OAuth без PKCE — ровно то, что делает Worker).
Категорию, если спрашивается, выбирай ближайшую к «Utilities / Productivity» или
«Video» — на одобрение это не влияет критично, главное соответствие описанию.

## ШАГ 5. Description
Вставь (коротко и честно, ревьюверы сверяют с сайтом):

> Pipeline is a video processing tool. It helps the creator prepare video files and
> publish them to their own TikTok account using the official Content Posting API.
> The user explicitly connects their account via TikTok OAuth, chooses the caption,
> privacy level and interaction settings, and confirms every single post. Nothing is
> published without a manual confirmation step.

## ШАГ 6. Website URL
Укажи: `https://jakolp1488.github.io/pipeline/`

## ШАГ 7. Terms of Service URL
Укажи: `https://jakolp1488.github.io/pipeline/terms.html`

## ШАГ 8. Privacy Policy URL
Укажи: `https://jakolp1488.github.io/pipeline/privacy.html`

## ШАГ 9. Products — что включить
В открывшемся приложении: вкладка **Products** → **Add product** → включи:
1. **Login Kit** — нужен для OAuth (получение access/refresh токенов).
2. **Content Posting API** — сам постинг. После добавления открой его настройки и
   включи опцию **Direct Post** (без неё endpoint `/v2/post/publish/video/init/`
   отвечать не будет; без Direct Post доступен только режим draft-inbox `video.upload`).

## ШАГ 10. Scopes — что включить
Вкладка **Scopes** (или «Add scopes» в настройках продукта):
- `user.info.basic` — добавляется автоматически вместе с Login Kit (avatar, username, open_id);
- `video.publish` — обязателен для Direct Post. Нажми **Apply**, дождись статуса
  approved (обычно быстро для стандартных scope).

Дополнительно можно подать `video.upload` (режим «сохранить в inbox как draft»),
но для прямой публикации он не нужен.

## ШАГ 11. Redirect URI
Redirect URI появится после деплоя Worker (ШАГ 15–16). Формат, который требует TikTok:
- только `https://`, абсолютный;
- без query-параметров и без `#`;
- статический, максимум 10 штук.

Наш значение (после деплоя): `https://<worker-имя>.<subdomain>.workers.dev/callback`
Вставь его: Login Kit (в настройках продукта) → **Redirect URIs** → Add → сохранить.

## ШАГ 12. Где взять Client Key
Страница приложения → **Login Kit** product → блок **Basic configuration** / App settings:
поле **Client key**. Нажми Copy.

## ШАГ 13. Где взять Client Secret
Там же, под Client key: **Client secret** → **Generate** (если ещё не сгенерирован) → Copy.
⚠️ Секрет показывается один раз. Никому его не передавай и никуда, кроме Cloudflare, не вставляй.

## ШАГ 14. Куда вставить Client Key
В Cloudflare, как secret Worker'а (см. ШАГ 16): `npx wrangler secret put TIKTOK_CLIENT_KEY`.

## ШАГ 15. Куда вставить Client Secret
ТОЛЬКО в Cloudflare Secrets: `npx wrangler secret put TIKTOK_CLIENT_SECRET`.
Нельзя: в GitHub, в файлы сайта, в config.js, в README, в .env который коммитится.

## ШАГ 16. Deploy Cloudflare Worker
```bash
# установка Node.js 18+ обязателен: https://nodejs.org
cd tiktok-oauth
npm install
npx wrangler login          # откроется браузер — войди в Cloudflare (можно через GitHub)
npx wrangler kv namespace create TIKTOK_TOKENS
#   → скопируй выданный id в wrangler.toml, поле [[kv_namespaces]] id
npx wrangler secret put TIKTOK_CLIENT_KEY       # вставь Client Key
npx wrangler secret put TIKTOK_CLIENT_SECRET    # вставь Client Secret
npx wrangler secret put WORKER_API_TOKEN        # придумай длинную случайную строку, например:
#   openssl rand -hex 32
npx wrangler deploy
```
В выводе деплоя будет: `https://pipeline-tiktok-oauth.<subdomain>.workers.dev` — это твой Worker URL.

## ШАГ 17. Как подключить мой TikTok аккаунт (проверка OAuth)
1. Впиши Worker URL в два места:
   - `wrangler.toml` → `TIKTOK_REDIRECT_URI = "https://...workers.dev/callback"` → `npx wrangler deploy`;
   - TikTok Portal → Login Kit → Redirect URIs → добавь ровно тот же `/callback` URL (ШАГ 11);
   - `config.js` сайта (поле OAUTH_URL) → `https://...workers.dev/auth/tiktok` → commit + push.
2. Скопируй `.env.example` → `.env`, заполни `TIKTOK_WORKER_URL` и `WORKER_API_TOKEN`.
3. Открой `https://jakolp1488.github.io/pipeline/` → нажми **Connect TikTok** →
   авторизуйся и выдай разрешения → увидишь страницу «TikTok connected».
4. Проверь: `python tiktok_test.py status`.

## ШАГ 18. Как проверить API
```bash
python tiktok_test.py check          # настройки на месте?
python tiktok_test.py creator-info   # реальный вызов /v2/post/publish/creator_info/query/
```
Если creator-info вернул твой username и privacy_level_options — API работает.

## ШАГ 19. Как использовать Sandbox / тест публикации
Официального «sandbox» у Content Posting API нет; роль sandbox выполняет то, что
**неаудированное приложение публикует только в приватный режим**. Это безопасно для тестов:
```bash
python tiktok_test.py publish --file test.mp4 --title "test" --privacy SELF_ONLY          # dry run
python tiktok_test.py publish --file test.mp4 --title "test" --privacy SELF_ONLY --yes    # реальный пост (приватный)
```
Пост увидишь только ты (SELF_ONLY / unaudited). Так тестируется весь pipeline:
init → upload chunks → status → PUBLISH_COMPLETE.

## ШАГ 20. Как подать App Review и получить публичную публикацию
1. Открой **https://developers.tiktok.com/application/content-posting-api**
   (Content Posting API audit application form) со своего аккаунта.
2. Заполни описание использования, приложи demo-видео (см. TIKTOK_REVIEW.md).
3. До одобрения: весь контент через твоё приложение принудительно приватный
   (`privacy_level` PUBLIC отклонится ошибкой `unaudited_client_can_only_post_to_private_accounts`).
4. После audit'а снимаются ограничения приватности, и ты можешь публиковать
   `PUBLIC_TO_EVERYONE` и т.д.

---

### Итого: что осталось руками
Смотри короткий чек-лист в `WHAT_I_MUST_DO.md`.
