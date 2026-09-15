# Pipeline — Privacy Policy

Last updated: September 15, 2026

This Privacy Policy explains how Pipeline ("we", "us", "our") collects, uses and protects
information when you use the Pipeline application ("Service"), a tool for video processing
and publishing videos to TikTok through the official TikTok API.

## 1. TikTok authorization (OAuth)

To enable publishing, Pipeline uses TikTok Login Kit, the official OAuth 2.0 authorization
flow provided by TikTok. When you choose to connect your TikTok account, you are redirected
to TikTok's official authorization page (https://www.tiktok.com/v2/auth/authorize/) where
you review and grant specific permissions.

We request only the following scopes:

- `user.info.basic` — basic profile information (avatar, username, unique identifier)
  needed to show which TikTok account is connected;
- `video.publish` — permission to publish videos directly to your TikTok account when you
  explicitly request it.

You may grant or deny each permission, and you can revoke Pipeline's access at any time in
your TikTok account settings or through Pipeline.

## 2. Tokens

After you authorize Pipeline, our backend exchanges the authorization code issued by TikTok
for an access token and a refresh token. These tokens are stored server-side on our OAuth
backend, hosted on Cloudflare Workers / Cloudflare KV. They are never stored in your
browser, never included in any public page, and never committed to our source repository.

- **Access token** — used to call TikTok APIs on your behalf (posting videos and querying
  your posting settings). TikTok expires it 24 hours after issuance.
- **Refresh token** — used only to obtain new access tokens without asking you to log in
  again. TikTok expires it 365 days after issuance.

Transmission of tokens happens exclusively over HTTPS between our backend and TikTok's
official API endpoints.

## 3. What data we process for publishing

- **Video files** that you choose to publish. They are transferred directly to TikTok's
  official upload servers so TikTok can process and publish them. We do not keep copies of
  your videos beyond what is needed to complete the transfer and to let you retry a failed
  publish.
- **Post metadata** you provide (caption, hashtags, privacy level, comment/duet/stitch
  settings). This data is sent to TikTok as part of the publishing request.
- **Creator settings returned by TikTok** (privacy level options, maximum video duration,
  interaction settings). Used only to render publishing options and comply with TikTok's
  requirements; not retained long-term.

## 4. Account data we receive from TikTok

Through the authorized scopes we receive: your TikTok unique identifier (`open_id`), avatar
URL, username and nickname, and the posting-related settings of your account. We use this
data solely to (a) show which account is connected, (b) publish videos to the correct
account, and (c) display the publish status.

## 5. Data retention and deletion

- You can disconnect your TikTok account at any time. We then delete the stored access and
  refresh tokens and stop all API access.
- TikTok's own moderation and record-keeping of published posts is governed by TikTok's
  privacy policy, not ours.
- To request deletion of any data we hold about you, contact us. We will delete it unless
  retention is required by law.

## 6. Security

Tokens are kept server-side with access restricted to the OAuth backend itself. All
connections use HTTPS. Client credentials and API secrets are stored only as server
environment secrets and are never exposed to the website or your browser. No method of
transmission or storage is 100% secure, but we take commercially reasonable measures to
protect your data.

## 7. Third-party services

- **TikTok (ByteDance)** — the TikTok Content Posting API and Login Kit process the data
  described above as an independent data controller under its own privacy policy:
  https://www.tiktok.com/legal/privacy-policy
- **Cloudflare** — hosts our OAuth backend (Workers, KV). Data processed there is limited
  to tokens and request metadata needed to perform authorization.
- **GitHub** — hosts our public website and source code. No tokens or secrets are hosted there.

We do not sell personal data, and we do not share it with anyone except the service
providers listed above, or when required by law.

## 8. Children's privacy

The Service is not directed to children under 16 and we do not knowingly collect their data.

## 9. Changes to this policy

We may update this Privacy Policy from time to time. The updated version will always be
available at https://jakolp1488.github.io/pipeline/privacy.html with a revised date.

## 10. Contact us

Email: dongmeier2009@jugarmail.com
