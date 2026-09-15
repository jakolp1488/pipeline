# Pipeline

Pipeline is a YouTube video processing and TikTok publishing tool.

## What it does

- Processes source videos automatically (subtitles, fonts, format conversion).
- Publishes finished videos to your TikTok account through the official TikTok
  Content Posting API (Direct Post).
- Connects to TikTok with official TikTok OAuth (Login Kit): you grant permissions
  yourself and can revoke them at any time.
- Nothing is published without your explicit confirmation; you choose caption,
  privacy level and interaction settings before every post.

## TikTok connection

1. You click **Connect TikTok** on the website and are redirected to TikTok's official
   authorization page.
2. You sign in and grant the requested scopes: `user.info.basic` and `video.publish`.
3. Pipeline's OAuth backend securely stores access and refresh tokens server-side.
4. Videos are sent to TikTok's official upload endpoints and tracked until published.

## Contact

Email: dongmeier2009@jugarmail.com

## Legal

- Privacy Policy: https://jakolp1488.github.io/pipeline/privacy.html
- Terms of Service: https://jakolp1488.github.io/pipeline/terms.html

---

© 2026 Pipeline. All rights reserved.
