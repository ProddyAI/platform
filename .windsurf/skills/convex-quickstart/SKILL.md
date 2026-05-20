---
name: convex-quickstart
<<<<<<< HEAD
description: Initializes a new Convex project from scratch or adds Convex to an existing app. Use this skill when starting a new project with Convex, scaffolding with npm create convex@latest, adding Convex to an existing React, Next.js, Vue, Svelte, or other frontend, wiring up ConvexProvider, configuring environment variables for the deployment URL, or running npx convex dev for the first time, even if the user just says "set up Convex" or "add a backend."
=======
description:
  Creates or adds Convex to an app. Use for new Convex projects, npm create
  convex@latest, frontend setup, env vars, or the first npx convex dev run.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534
---

# Convex Quickstart

Set up a working Convex project as fast as possible.

## When to Use

- Starting a brand new project with Convex
- Adding Convex to an existing React, Next.js, Vue, Svelte, or other app
- Scaffolding a Convex app for prototyping

## When Not to Use

<<<<<<< HEAD
- The project already has Convex installed and `convex/` exists - just start building
- You only need to add auth to an existing Convex app - use the `convex-setup-auth` skill
=======
- The project already has Convex installed and `convex/` exists - just start
  building
- You only need to add auth to an existing Convex app - use the
  `convex-setup-auth` skill
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

## Workflow

1. Determine the starting point: new project or existing app
2. If new project, pick a template and scaffold with `npm create convex@latest`
3. If existing app, install `convex` and wire up the provider
4. Run `npx convex dev` to connect a deployment and start the dev loop
5. Verify the setup works

## Path 1: New Project (Recommended)

<<<<<<< HEAD
Use the official scaffolding tool. It creates a complete project with the frontend framework, Convex backend, and all config wired together.
=======
Use the official scaffolding tool. It creates a complete project with the
frontend framework, Convex backend, and all config wired together.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

### Pick a template

| Template                   | Stack                                     |
| -------------------------- | ----------------------------------------- |
| `react-vite-shadcn`        | React + Vite + Tailwind + shadcn/ui       |
| `nextjs-shadcn`            | Next.js App Router + Tailwind + shadcn/ui |
| `react-vite-clerk-shadcn`  | React + Vite + Clerk auth + shadcn/ui     |
| `nextjs-clerk`             | Next.js + Clerk auth                      |
| `nextjs-convexauth-shadcn` | Next.js + Convex Auth + shadcn/ui         |
| `nextjs-lucia-shadcn`      | Next.js + Lucia auth + shadcn/ui          |
| `bare`                     | Convex backend only, no frontend          |

<<<<<<< HEAD
If the user has not specified a preference, default to `react-vite-shadcn` for simple apps or `nextjs-shadcn` for apps that need SSR or API routes.
=======
If the user has not specified a preference, default to `react-vite-shadcn` for
simple apps or `nextjs-shadcn` for apps that need SSR or API routes.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

You can also use any GitHub repo as a template:

```bash
npm create convex@latest my-app -- -t owner/repo
npm create convex@latest my-app -- -t owner/repo#branch
```

### Scaffold the project

Always pass the project name and template flag to avoid interactive prompts:

```bash
npm create convex@latest my-app -- -t react-vite-shadcn
cd my-app
npm install
```

<<<<<<< HEAD
The scaffolding tool creates files but does not run `npm install`, so you must run it yourself.
=======
The scaffolding tool creates files but does not run `npm install`, so you must
run it yourself.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

To scaffold in the current directory (if it is empty):

```bash
npm create convex@latest . -- -t react-vite-shadcn
npm install
```

### Start the dev loop

<<<<<<< HEAD
`npx convex dev` is a long-running watcher process that syncs backend code to a Convex deployment on every save. It also requires authentication on first run (browser-based OAuth). Both of these make it unsuitable for an agent to run directly.

**Ask the user to run this themselves:**

Tell the user to run `npx convex dev` in their terminal. On first run it will prompt them to log in or develop anonymously. Once running, it will:
=======
`npx convex dev` is a long-running watcher process that syncs backend code to a
Convex deployment on every save. It also requires authentication on first run
(browser-based OAuth). Both of these make it unsuitable for an agent to run
directly.

**Ask the user to run this themselves:**

Tell the user to run `npx convex dev` in their terminal. On first run it will
prompt them to log in or develop anonymously. Once running, it will:
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

- Create a Convex project and dev deployment
- Write the deployment URL to `.env.local`
- Create the `convex/` directory with generated types
- Watch for changes and sync continuously

<<<<<<< HEAD
The user should keep `npx convex dev` running in the background while you work on code. The watcher will automatically pick up any files you create or edit in `convex/`.

**Exception - cloud or headless agents:** Environments that cannot open a browser for interactive login should use Agent Mode (see below) to run anonymously without user interaction.
=======
The user should keep `npx convex dev` running in the background while you work
on code. The watcher will automatically pick up any files you create or edit in
`convex/`.

**Exception - cloud or headless agents:** Environments that cannot open a
browser for interactive login should use Agent Mode (see below) to run
anonymously without user interaction.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

### Start the frontend

The user should also run the frontend dev server in a separate terminal:

```bash
npm run dev
```

Vite apps serve on `http://localhost:5173`, Next.js on `http://localhost:3000`.

### What you get

After scaffolding, the project structure looks like:

<<<<<<< HEAD
```
=======
```text
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534
my-app/
  convex/           # Backend functions and schema
    _generated/     # Auto-generated types (check this into git)
    schema.ts       # Database schema (if template includes one)
  src/              # Frontend code (or app/ for Next.js)
  package.json
  .env.local        # CONVEX_URL / VITE_CONVEX_URL / NEXT_PUBLIC_CONVEX_URL
```

The template already has:

- `ConvexProvider` wired into the app root
- Correct env var names for the framework
- Tailwind and shadcn/ui ready (for shadcn templates)
- Auth provider configured (for auth templates)

Proceed to adding schema, functions, and UI.

## Path 2: Add Convex to an Existing App

<<<<<<< HEAD
Use this when the user already has a frontend project and wants to add Convex as the backend.
=======
Use this when the user already has a frontend project and wants to add Convex as
the backend.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

### Install

```bash
npm install convex
```

### Initialize and start dev loop

<<<<<<< HEAD
Ask the user to run `npx convex dev` in their terminal. This handles login, creates the `convex/` directory, writes the deployment URL to `.env.local`, and starts the file watcher. See the notes in Path 1 about why the agent should not run this directly.
=======
Ask the user to run `npx convex dev` in their terminal. This handles login,
creates the `convex/` directory, writes the deployment URL to `.env.local`, and
starts the file watcher. See the notes in Path 1 about why the agent should not
run this directly.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

### Wire up the provider

The Convex client must wrap the app at the root. The setup varies by framework.

Create the `ConvexReactClient` at module scope, not inside a component:

```tsx
// Bad: re-creates the client on every render
function App() {
  const convex = new ConvexReactClient(
    import.meta.env.VITE_CONVEX_URL as string,
  );
  return <ConvexProvider client={convex}>...</ConvexProvider>;
}

// Good: created once at module scope
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
function App() {
  return <ConvexProvider client={convex}>...</ConvexProvider>;
}
```

#### React (Vite)

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
```

#### Next.js (App Router)

```tsx
// app/ConvexClientProvider.tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

```tsx
// app/layout.tsx
import { ConvexClientProvider } from "./ConvexClientProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

#### Other frameworks

<<<<<<< HEAD
For Vue, Svelte, React Native, TanStack Start, Remix, and others, follow the matching quickstart guide:
=======
For Vue, Svelte, React Native, TanStack Start, Remix, and others, follow the
matching quickstart guide:
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

- [Vue](https://docs.convex.dev/quickstart/vue)
- [Svelte](https://docs.convex.dev/quickstart/svelte)
- [React Native](https://docs.convex.dev/quickstart/react-native)
- [TanStack Start](https://docs.convex.dev/quickstart/tanstack-start)
- [Remix](https://docs.convex.dev/quickstart/remix)
- [Node.js (no frontend)](https://docs.convex.dev/quickstart/nodejs)

### Environment variables

The env var name depends on the framework:

| Framework    | Variable                 |
| ------------ | ------------------------ |
| Vite         | `VITE_CONVEX_URL`        |
| Next.js      | `NEXT_PUBLIC_CONVEX_URL` |
| Remix        | `CONVEX_URL`             |
| React Native | `EXPO_PUBLIC_CONVEX_URL` |

`npx convex dev` writes the correct variable to `.env.local` automatically.

## Agent Mode (Cloud and Headless Agents)

<<<<<<< HEAD
When running in a cloud or headless agent environment where interactive browser login is not possible, set `CONVEX_AGENT_MODE=anonymous` to use a local anonymous deployment.
=======
When running in a cloud or headless agent environment where interactive browser
login is not possible, set `CONVEX_AGENT_MODE=anonymous` to use a local
anonymous deployment.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

Add `CONVEX_AGENT_MODE=anonymous` to `.env.local`, or set it inline:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

<<<<<<< HEAD
This runs a local Convex backend on the VM without requiring authentication, and avoids conflicting with the user's personal dev deployment.
=======
This runs a local Convex backend on the VM without requiring authentication, and
avoids conflicting with the user's personal dev deployment.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

## Verify the Setup

After setup, confirm everything is working:

1. The user confirms `npx convex dev` is running without errors
2. The `convex/_generated/` directory exists and has `api.ts` and `server.ts`
3. `.env.local` contains the deployment URL

## Writing Your First Function

<<<<<<< HEAD
Once the project is set up, create a schema and a query to verify the full loop works.
=======
Once the project is set up, create a schema and a query to verify the full loop
works.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

`convex/schema.ts`:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
});
```

`convex/tasks.ts`:

```ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

export const create = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", { text: args.text, completed: false });
  },
});
```

<<<<<<< HEAD
Use in a React component (adjust the import path based on your file location relative to `convex/`):
=======
Use in a React component (adjust the import path based on your file location
relative to `convex/`):
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function Tasks() {
  const tasks = useQuery(api.tasks.list);
  const create = useMutation(api.tasks.create);

  return (
    <div>
      <button onClick={() => create({ text: "New task" })}>Add</button>
      {tasks?.map((t) => (
        <div key={t._id}>{t.text}</div>
      ))}
    </div>
  );
}
```

## Development vs Production

<<<<<<< HEAD
Always use `npx convex dev` during development. It runs against your personal dev deployment and syncs code on save.
=======
Always use `npx convex dev` during development. It runs against your personal
dev deployment and syncs code on save.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

When ready to ship, deploy to production:

```bash
npx convex deploy
```

<<<<<<< HEAD
This pushes to the production deployment, which is separate from dev. Do not use `deploy` during development.
=======
This pushes to the production deployment, which is separate from dev. Do not use
`deploy` during development.
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534

## Next Steps

- Add authentication: use the `convex-setup-auth` skill
<<<<<<< HEAD
- Design your schema: see [Schema docs](https://docs.convex.dev/database/schemas)
- Build components: use the `convex-create-component` skill
- Plan a migration: use the `convex-migration-helper` skill
- Add file storage: see [File Storage docs](https://docs.convex.dev/file-storage)
=======
- Design your schema: see
  [Schema docs](https://docs.convex.dev/database/schemas)
- Build components: use the `convex-create-component` skill
- Plan a migration: use the `convex-migration-helper` skill
- Add file storage: see
  [File Storage docs](https://docs.convex.dev/file-storage)
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534
- Set up cron jobs: see [Scheduling docs](https://docs.convex.dev/scheduling)

## Checklist

- [ ] Determined starting point: new project or existing app
<<<<<<< HEAD
- [ ] If new project: scaffolded with `npm create convex@latest` using appropriate template
=======
- [ ] If new project: scaffolded with `npm create convex@latest` using
      appropriate template
>>>>>>> 7c1f9518c31e7b2b1b14eb8db8a16ab3d1d42534
- [ ] If existing app: installed `convex` and wired up the provider
- [ ] User has `npx convex dev` running and connected to a deployment
- [ ] `convex/_generated/` directory exists with types
- [ ] `.env.local` has the deployment URL
- [ ] Verified a basic query/mutation round-trip works
