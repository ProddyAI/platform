# Import Integrations Setup — Production (Slack · Linear · Todoist)

This branch (`jgk2k4/eng-84-import-data-from-platforms`) adds "Import data from platforms"
for **Slack**, **Linear**, and **Todoist**. This guide is for the **production** environment
running at **https://proddyai.app**, backed by the **prod** Convex deployment
`elated-mammoth-115`.

---

## TL;DR — what redirect URL to register

Register your **app domain** with each provider — **not** the Convex URL:

```
https://proddyai.app/api/import/linear/callback
https://proddyai.app/api/import/slack/callback
https://proddyai.app/api/import/todoist/callback
```

**Why proddyai.app and not the `.convex.cloud` / `.convex.site` URL:** the provider
redirects the browser to the **Next.js route** `/api/import/<provider>/callback`, which
lives on `proddyai.app`. That route forwards the request internally to Convex
(`elated-mammoth-115.convex.site/import/<provider>/callback`). The Convex domain does not
serve the `/api/...` path, and the code builds `redirect_uri = <APP_URL>/api/import/<provider>/callback`
for **both** the authorize step and the token exchange — so whatever you register must
equal that string exactly. `<APP_URL>` on prod = `https://proddyai.app`.

---

## 1. Flow (production)

```
User clicks "Connect"  ─▶  Convex mutation initiate<Provider>OAuth
                            redirect_uri = https://proddyai.app/api/import/<provider>/callback
        │
        ▼
Provider consent screen  ─▶  redirects to
                             https://proddyai.app/api/import/<provider>/callback   (Next.js route)
        │
        ▼
Next.js route forwards params to
                             https://elated-mammoth-115.convex.site/import/<provider>/callback
        │
        ▼
Convex HTTP action exchanges code→token, stores it in `import_connections`,
                             redirects to https://proddyai.app/workspace/<id>/manage
```

`redirect_uri` is derived in Convex from `NEXT_PUBLIC_APP_URL || SITE_URL`. This is a
fallback chain, not two things you must set — **`SITE_URL` alone is enough.** The prod
deployment already has `SITE_URL=https://proddyai.app`, so nothing extra is needed here.
The Next.js forward target is derived from `NEXT_PUBLIC_CONVEX_HTTP_URL`, or from
`NEXT_PUBLIC_CONVEX_URL` with `.convex.cloud`→`.convex.site` — make sure your prod hosting
sets `NEXT_PUBLIC_CONVEX_URL` to `https://elated-mammoth-115.convex.cloud`.

---

## 2. App URL — already covered by `SITE_URL`

The redirect URI is built from `NEXT_PUBLIC_APP_URL || SITE_URL || "https://localhost:3000"`.
Your prod deployment already has:

```
SITE_URL = https://proddyai.app
```

So there is **nothing to set here** — the code falls through to `SITE_URL` and produces
`https://proddyai.app/api/import/<provider>/callback`. Do **not** create a duplicate
`NEXT_PUBLIC_APP_URL` in Convex; it's only an optional override that takes precedence if
present. (`NEXT_PUBLIC_APP_URL` still exists as a front-end build var for the Next.js app —
that's separate from Convex's env.)

---

## 3. Required env vars on prod (`elated-mammoth-115`)

| Variable                | Needed for | Action                                     |
| ----------------------- | ---------- | ------------------------------------------ |
| `SITE_URL`              | all        | already `https://proddyai.app` — nothing to do |
| `LINEAR_CLIENT_ID`      | Linear     | create Linear OAuth app (Step 4a)          |
| `LINEAR_CLIENT_SECRET`  | Linear     |                                            |
| `TODOIST_CLIENT_ID`     | Todoist    | create Todoist app (Step 4b)               |
| `TODOIST_CLIENT_SECRET` | Todoist    |                                            |
| `SLACK_CLIENT_ID`       | Slack      | from your Slack app (Step 4c)              |
| `SLACK_CLIENT_SECRET`   | Slack      |                                            |
| `ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` | push notifications | set if using notifications |

> These must be set on the **prod** Convex deployment (`--prod`). Convex functions cannot
> read `.env.local`; they only see variables set via `convex env set` / the dashboard.
> Verify anytime with `bunx convex env list --prod`.

---

## 4. Provider setup

### 4a. Linear  (verified against linear.app/developers/oauth-2-0-authentication)

Code uses: authorize `https://linear.app/oauth/authorize`, token
`https://api.linear.app/oauth/token`, `scope=read`, `grant_type=authorization_code`. ✅

1. **linear.app/settings/api → OAuth applications → Create**.
2. Redirect URI (exactly):
   ```
   https://proddyai.app/api/import/linear/callback
   ```
3. Copy Client ID + Secret, then:
   ```bash
   bunx convex env set --prod LINEAR_CLIENT_ID <your-client-id>
   bunx convex env set --prod LINEAR_CLIENT_SECRET <your-client-secret>
   ```
   Both are required — `initiateLinearOAuth` errors with "Linear OAuth not configured" if
   either is missing.

### 4b. Todoist  (verified against developer.todoist.com/api/v1)

Code uses: authorize `https://todoist.com/oauth/authorize`, token
`https://todoist.com/oauth/access_token`, `scope=data:read_write`. ✅ (Todoist does not
issue refresh tokens; the code handles that.)

1. **todoist.com/app_console → Create a new app** (or open your existing app).
2. OAuth redirect URL (exactly):
   ```
   https://proddyai.app/api/import/todoist/callback
   ```
3. Copy Client ID + Secret, then:
   ```bash
   bunx convex env set --prod TODOIST_CLIENT_ID <your-client-id>
   bunx convex env set --prod TODOIST_CLIENT_SECRET <your-client-secret>
   ```

### 4c. Slack  (verified against Slack Web API OAuth v2)

Code uses: authorize `https://slack.com/oauth/v2/authorize`, token
`https://slack.com/api/oauth.v2.access`. It stores the top-level **bot token** (`xoxb-…`)
and requests these **bot** scopes:
`channels:read`, `channels:history`, `users:read`, `users:read.email`, `files:read`, `team:read`.

Creating a new Slack app from scratch:

1. **api.slack.com/apps → Create New App → From scratch**. Give it a name (e.g. "Proddy
   Import") and select the workspace to develop it in.
2. **OAuth & Permissions → Redirect URLs → Add New Redirect URL** — enter exactly the
   following, then **Save URLs**:
   ```
   https://proddyai.app/api/import/slack/callback
   ```
3. **OAuth & Permissions → Scopes → Bot Token Scopes → Add an OAuth Scope** — add all six
   (they go under *Bot* Token Scopes, not User Token Scopes):
   ```
   channels:read
   channels:history
   users:read
   users:read.email
   files:read
   team:read
   ```
4. **Install App** (button at the top of *OAuth & Permissions*, or the *Install App* page) →
   **Allow**. This is required for the token to reflect the scopes and redirect URL.
5. **Basic Information → App Credentials** — copy the **Client ID** and **Client Secret**,
   then set them on prod:
   ```bash
   bunx convex env set --prod SLACK_CLIENT_ID <your-client-id>
   bunx convex env set --prod SLACK_CLIENT_SECRET <your-client-secret>
   ```

> If you ever change the scopes or the redirect URL, you must **re-install** the app for the
> changes to take effect.

⚠️ **Slack import caveats (functional, not setup):**
- The bot token can only read history of **public channels the bot is a member of**.
  `conversations.history` returns `not_in_channel` otherwise, and the code does not
  auto-join. **Invite the bot to each channel you want to import** (`/invite @yourbot`).
- Only **public** channels are covered. Private channels need `groups:read` /
  `groups:history` scopes, which are not requested — they will not import.
- To broaden coverage, add `channels:join` (auto-join public channels) and/or the
  private-channel scopes, then re-install the Slack app.

---

## 5. Verify each connection in production

1. Confirm prod env: `bunx convex env list --prod` shows the client IDs/secrets and
   `SITE_URL=https://proddyai.app`.
2. Confirm the prod front-end has `NEXT_PUBLIC_CONVEX_URL=https://elated-mammoth-115.convex.cloud`
   (in your hosting env, e.g. Vercel).
3. On https://proddyai.app open a workspace → **Manage → Import**, click Connect for each
   provider, complete consent, and confirm you land on `…/manage?success=<provider>_connected`.
4. Check the `import_connections` table in the prod Convex dashboard, then run an import and
   watch `import_jobs`.

Failure signals:
- `"<Provider> OAuth not configured"` → client id/secret missing on prod (`--prod`).
- `redirect_uri_mismatch` / invalid redirect → the registered URI is not *exactly*
  `https://proddyai.app/api/import/<provider>/callback`, or `SITE_URL` on prod
  isn't `https://proddyai.app`.
- Redirect lands on a wrong/blank page → `NEXT_PUBLIC_CONVEX_URL` in the front-end isn't the
  prod deployment, so the Next.js route can't forward to Convex.
- Slack import runs but a channel has 0 messages → the bot isn't a member of that channel.

---

## 6. DB & code notes

- Schema is already in place: `import_connections`, `import_jobs`, `import_channel_metadata`,
  `import_message_metadata`, `import_issue_metadata`, `import_file_metadata`, `rateLimits`
  (in `convex/schema.ts`). A `bunx convex deploy` / `convex dev` push applies them to prod.
- Before shipping: `convex/importIntegrations.ts` and `convex/http.ts` log the full Linear
  authorize URL and an access-token prefix/length for debugging — remove those debug
  `console.log`s so tokens aren't written to prod logs.
