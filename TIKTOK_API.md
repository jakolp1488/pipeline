# TikTok API — справочник для Pipeline

Проверено по официальной документации developers.tiktok.com (страницы обновлены 04–24 августа 2026).
Только официальные endpoints. Все вызовы — HTTPS.

## 1. OAuth (Login Kit, Web)

### Авторизация
```
GET https://www.tiktok.com/v2/auth/authorize/
    ?client_key=<KEY>
    &response_type=code
    &scope=user.info.basic,video.publish
    &redirect_uri=<URL_ENCODED_CALLBACK>
    &state=<RANDOM_ANTI_CSRF>
```
После согласия пользователя TikTok редиректит на redirect_uri с `code`, `scopes`, `state`
(или `error`, `error_description`). `state` обязан совпасть с отправленным.

Требования к Redirect URI: https, абсолютный, статический (без query/fragment), ≤512 символов, до 10 URI.
PKCE (`code_verifier`) нужен только для mobile/desktop-приложений; для web-типа не используется.

### Обмен code → токены
```
POST https://open.tiktokapis.com/v2/oauth/token/
Content-Type: application/x-www-form-urlencoded

client_key=...&client_secret=...&code=...&grant_type=authorization_code&redirect_uri=...
```
Ответ: `access_token`, `expires_in` (24 ч = 86400), `refresh_token`,
`refresh_expires_in` (365 дней = 31536000), `open_id`, `scope`, `token_type=Bearer`.

### Обновление токена (без участия пользователя)
```
POST https://open.tiktokapis.com/v2/oauth/token/
client_key=...&client_secret=...&grant_type=refresh_token&refresh_token=...
```
⚠️ Если ответ вернул новый `refresh_token` — обязательно замени старый.

### Отзыв доступа
```
POST https://open.tiktokapis.com/v2/oauth/revoke/
client_key=...&client_secret=...&token=<access_token>
```

### Ошибки OAuth
`invalid_request`, `invalid_grant`, `redirect_uri is not matched...` и т.п. — приходят как
`{"error": "...", "error_description": "...", "log_id": "..."}` (без обёртки data/error).

## 2. Scopes

| Scope | Даёт | Нужен для |
|---|---|---|
| `user.info.basic` | open_id, avatar, username, nickname | показать подключённый аккаунт |
| `video.publish` | публикация напрямую | Direct Post + Get Post Status |
| `video.upload` | отправка как draft в inbox TikTok | альтернативный режим (не используется здесь) |

Пользователь может выдать только подмножество scope'ов — смотри поле `scope` в ответе токена.

## 3. Creator Info (обязателен перед Direct Post)

```
POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/
Authorization: Bearer <access_token>
Content-Type: application/json; charset=UTF-8
```
- Rate limit: 20 запросов/мин на токен.
- Ответ: `creator_username`, `creator_nickname`, `creator_avatar_url` (TTL 2 ч),
  `privacy_level_options` (публичный акк: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY;
  приватный: FOLLOWER_OF_CREATOR, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY),
  `comment_disabled`, `duet_disabled`, `stitch_disabled`,
  `max_video_post_duration_sec`.
- По UX-правилам TikTok приложение ОБЯЗАНО показывать пользователю полученные
  privacy_level_options и ограничения, а не хардкодить свои.

## 4. Direct Post — инициализация

```
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Authorization: Bearer <access_token>
```
Body:
```json
{
  "post_info": {
    "title": "caption up to 2200 UTF-16 units",
    "privacy_level": "SELF_ONLY",
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 50000123,
    "chunk_size": 10000000,
    "total_chunk_count": 5
  }
}
```
- `privacy_level` обязан входить в privacy_level_options из creator_info,
  иначе 403 `privacy_level_option_mismatch`.
- `source`: `FILE_UPLOAD` (мы) или `PULL_FROM_URL` (требует **верификации домена**
  в портал → ошибка `url_ownership_unverified` без неё).
- Ответ: `data.publish_id`, `data.upload_url` (живёт 1 час!).
- Rate limit: 6 запросов/мин на токен.

## 5. Direct Post — загрузка файла

```
PUT <upload_url из init-ответа, со всеми query-параметрами>
Content-Type: video/mp4 | video/quicktime | video/webm
Content-Length: <размер чанка>
Content-Range: bytes <first>-<last>/<total>
Body: бинарные данные чанка
```
Чанки по сырой последовательности байт; TikTok собирает файл сам.

## 6. Статус публикации

```
POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
Authorization: Bearer <access_token>
Body: {"publish_id": "v_pub_file~v2-1.123456789"}
```
- Rate limit: 30 запросов/мин.
- `data.status`: `PROCESSING_UPLOAD` (ждём чанки) → `PROCESSING_DOWNLOAD` (для URL-режима)
  → `PUBLISH_COMPLETE` или `FAILED` (+`fail_reason`).
- `publicaly_available_post_id` появляется только когда пост публичный И прошёл модерацию.
- Альтернатива поллингу — webhooks `post.publish.*` (настроить в портале).

### Типичные fail_reason / error codes
| Код | Смысл |
|---|---|
| `unaudited_client_can_only_post_to_private_accounts` | приложение не прошло audit → только приватные посты |
| `access_token_invalid` | токен истёк (24 ч) → refresh |
| `scope_not_authorized` | нет granted `video.publish` |
| `rate_limit_exceeded` / 429 | слишком часто |
| `spam_risk_too_many_posts` | дневной лимит постов у пользователя |
| `file_format_check_failed`, `duration_check_failed`, `frame_rate_check_failed`, `picture_size_check_failed` | медиа не проходит ограничения TikTok |
| `video_pull_failed` | TikTok не смог скачать по URL |
| `auth_removed` | пользователь отозвал доступ |
| `privacy_level_option_mismatch` | privacy_level не из creator_info |
| `url_ownership_unverified` | домен не верифицирован для PULL_FROM_URL |

## 7. Rate limits (сводно)

| Эндпоинт | Лимит |
|---|---|
| `/v2/post/publish/video/init/` | 6 / мин / токен |
| `/v2/post/publish/creator_info/query/` | 20 / мин / токен |
| `/v2/post/publish/status/fetch/` | 30 / мин / токен |
| Посты в сутки | дневной cap на пользователя и на приложение (`reached_active_user_cap`) |

## 8. Sandbox / ограничения неаудированного приложения

- Отдельного sandbox-режима нет. Неаудированное приложение: **все посты принудительно
  только в приватный просмотр**; попытка PUBLIC блокируется на init (403).
- Для снятия — audit по продукту Content Posting API (см. TIKTOK_REVIEW.md).
- До audit приложение полностью пригодно для интеграционных тестов с `SELF_ONLY`.

## 9. Требования к медиа (кратко)

- Видео: MP4 (H.264) / QuickTime / WebM; длительность ≤ `max_video_post_duration_sec`
  из creator_info; ограничения по разрешению/frame rate — см. Video Restrictions в доках TikTok.
- Хранение исходников: мы используем FILE_UPLOAD, поэтому верификация домена не нужна.
  PULL_FROM_URL понадобится, только если захочешь отдавать видео по публичной ссылке —
  тогда придётся верифицировать домен в портале (Webhooks/domain verification).

## Источники (официальная документация)

- Login Kit → Web; Manage User Access Tokens; User Access Token Management
- Content Posting API → Get Started – Direct Post; API Reference → Video / Direct Post;
  Query Creator Info; Get Post Status
- Scopes Reference; App Review Guidelines
https://developers.tiktok.com/docs/en/welcome
