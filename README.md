<a name="readme-top"></a>

# Collaborate with your team in Proddy built using Next.js

[![GitHub license](https://flat.badgen.net/github/license/george-bobby/proddy-platform?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/blob/main/LICENSE 'GitHub license')
[![Maintenance](https://flat.badgen.net/static/Maintained/yes?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/commits/main 'Maintenance')
[![GitHub branches](https://flat.badgen.net/github/branches/george-bobby/proddy-platform?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/branches 'GitHub branches')
[![Github commits](https://flat.badgen.net/github/commits/george-bobby/proddy-platform?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/commits 'Github commits')
[![GitHub issues](https://flat.badgen.net/github/issues/george-bobby/proddy-platform?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/issues 'GitHub issues')
[![GitHub pull requests](https://flat.badgen.net/github/prs/george-bobby/proddy-platform?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/pulls 'GitHub pull requests')

<!-- Table of Contents -->
<details>

<summary>

# :notebook_with_decorative_cover: Table of Contents

</summary>

- [Folder Structure](#bangbang-folder-structure)
- [Getting Started](#toolbox-getting-started)
- [Screenshots](#camera-screenshots)
- [Tech Stack](#gear-tech-stack)
- [Stats](#wrench-stats)
- [Contribute](#raised_hands-contribute)
- [Acknowledgements](#gem-acknowledgements)
- [Buy Me a Coffee](#coffee-buy-me-a-coffee)
- [Follow Me](#rocket-follow-me)
- [Learn More](#books-learn-more)
- [Deploy on Vercel](#page_with_curl-deploy-on-vercel)
- [Give A Star](#star-give-a-star)
- [Star History](#star2-star-history)
- [Give A Star](#star-give-a-star)

</details>

## :toolbox: Getting Started

1. Make sure **Git** and **NodeJS** is installed.
2. Clone this repository to your local computer.
3. Create `.env.local` file in **root** directory.
4. Contents of `.env.local`:

```env
# .env.local

# disabled next.js telemetry
NEXT_TELEMETRY_DISABLED=1

# deployment used by `npx convex dev` or `bunx convex dev`
CONVEX_DEPLOYMENT=dev:<deployment-name> # team: <team-name>, project: <project-name>

# convex public url
NEXT_PUBLIC_CONVEX_URL="https://<deployment-name>.convex.cloud"

# Composio API Key for external integrations
COMPOSIO_API_KEY=your-composio-api-key

# Integration Auth Config IDs from Composio
# Auth config ID for GitHub integration (e.g., ac_abc123)
NEXT_PUBLIC_GITHUB_AUTH_CONFIG_ID=your-github-auth-config-id

# Auth config ID for Gmail integration (e.g., ac_xyz789)
NEXT_PUBLIC_GMAIL_AUTH_CONFIG_ID=your-gmail-auth-config-id

# Auth config ID for Slack integration (e.g., ac_def456)
NEXT_PUBLIC_SLACK_AUTH_CONFIG_ID=your-slack-auth-config-id

# Auth config ID for Notion integration (e.g., ac_ghi789)
NEXT_PUBLIC_NOTION_AUTH_CONFIG_ID=your-notion-auth-config-id

# Auth config ID for ClickUp integration (e.g., ac_jkl012)
NEXT_PUBLIC_CLICKUP_AUTH_CONFIG_ID=your-clickup-auth-config-id

# Auth config ID for Linear integration (e.g., ac_mno345)
NEXT_PUBLIC_LINEAR_AUTH_CONFIG_ID=your-linear-auth-config-id

# OpenAI API Key for AI assistant features
OPENAI_API_KEY=your-openai-api-key

```

5. Convex Deployment

- Visit the Convex website: [https://convex.dev](https://convex.dev)
- Log in to your Convex account or sign up if you don't have one.
- Once logged in, navigate to the "Deployments" section.
- Create a new deployment or select an existing one.
- Replace `<deployment-name>`, `<team-name>`, and `<project-name>` in the `.env.local` file with your Convex deployment details.
- In the Convex dashboard, find the public URL associated with your deployment.
- Replace `<your-convex-url>` in the `.env.local` file with your Convex public URL.

6. Initialise Convex Auth Development Keys

- Run the initialization command: `npx @convex-dev/auth` or `bunx @convex-dev/auth` to setup your project for authenticating via the library.
- Make sure your **SITE_URL** environment variable is set correctly. This is the URL where your app is hosted, e.g., `http://localhost:3000` for development.
- Your project authentication is setup for logging in with credentials.

7. Setting Up Google OAuth

**Step 1: Create a Google Cloud Project**

- Go to the [Google Cloud Console](https://console.cloud.google.com/).
- Create a new project (if you don’t have one) by clicking on **Select a project** > **New Project**, and give it a name.
- Enable the **Google OAuth 2.0** API by navigating to **APIs & Services > Library** and searching for **Google OAuth 2.0**.

**Step 2: Create OAuth Credentials**

- In the **APIs & Services > Credentials** section, click **Create Credentials** and choose **OAuth 2.0 Client IDs**.
- Select **Web Application** as the application type.
- Set the **Authorized Redirect URI** to your Convex callback URL. The origin (domain) of the callback URL is your Convex backend's **HTTP Actions URL**. You can find it in your Convex dashboard and it is similar to your `CONVEX_URL`, but with `.site` instead of `.cloud`.

- After setting the redirect URI, click **Create**. You’ll be provided with a **Client ID** and **Client Secret**.

**Step 3: Set Google OAuth Environment Variables in Convex**
To configure Google OAuth in your Convex backend, run the following commands with your actual values:

```bash
npx convex env set AUTH_GOOGLE_CLIENT_ID your-google-client-id
npx convex env set AUTH_GOOGLE_CLIENT_SECRET your-google-client-secret
```

OR

```bash
bunx convex env set AUTH_GOOGLE_CLIENT_ID your-google-client-id
bunx convex env set AUTH_GOOGLE_CLIENT_SECRET your-google-client-secret
```

8. Setting Up GitHub OAuth

**Step 1: Create a GitHub OAuth Application**

- Go to [GitHub Developer Settings](https://github.com/settings/developers).
- Under **OAuth Apps**, click **New OAuth App**.
- Fill in the following:

  - **Application Name**: Name your app (e.g., "Proddy").
  - **Homepage URL**: Your app’s homepage URL, like `http://localhost:3000` for local development.
  - **Authorization Callback URL**: Set this to your Convex callback URL (Similar to Google OAuth **Authorized Redirect URI**).

- After registering the app, you’ll get a **Client ID** and **Client Secret**.

**Step 2: Set GitHub OAuth Environment Variables in Convex**

- To configure GitHub OAuth in your Convex backend, run the following commands with your actual values:

```bash
npx convex env set AUTH_GITHUB_ID your-github-client-id
npx convex env set AUTH_GITHUB_SECRET your-github-client-secret
```

OR

```bash
bunx convex env set AUTH_GITHUB_ID your-github-client-id
bunx convex env set AUTH_GITHUB_SECRET your-github-client-secret
```

9. Install Project Dependencies using `npm install --legacy-peer-deps` or `yarn install --legacy-peer-deps` or `bun install --legacy-peer-deps`.

10. Now app is fully configured 👍 and you can start using this app using either one of `npm run dev` or `yarn dev` or `bun dev`.

**NOTE:** Please make sure to keep your API keys and configuration values secure and do not expose them publicly.

## :gear: Tech Stack

[![React JS](https://skillicons.dev/icons?i=react 'React JS')](https://react.dev/ 'React JS') [![Next JS](https://skillicons.dev/icons?i=next 'Next JS')](https://nextjs.org/ 'Next JS') [![Typescript](https://skillicons.dev/icons?i=ts 'Typescript')](https://www.typescriptlang.org/ 'Typescript') [![Tailwind CSS](https://skillicons.dev/icons?i=tailwind 'Tailwind CSS')](https://tailwindcss.com/ 'Tailwind CSS') [![Vercel](https://skillicons.dev/icons?i=vercel 'Vercel')](https://vercel.app/ 'Vercel')

## :raised_hands: Contribute

You might encounter some bugs while using this app. You are more than welcome to contribute. Just submit changes via pull request and I will review them before merging. Make sure you follow community guidelines.