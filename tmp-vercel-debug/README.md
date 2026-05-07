# Proddy - Agentic Work Management Suite 

Collaborate with your team using real-time messaging, boards, notes, calendar, and AI features. Built with Next.js, Convex, and Shadcn UI.

[![GitHub branches](https://flat.badgen.net/github/branches/george-bobby/proddy-platform?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/branches)
[![Github commits](https://flat.badgen.net/github/commits/george-bobby/proddy-platform?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/commits)
[![GitHub pull requests](https://flat.badgen.net/github/prs/george-bobby/proddy-platform?icon=github&color=black&scale=1.01)](https://github.com/george-bobby/proddy-platform/pulls)

## Tech stack

- **Next.js** 14 — React framework
- **Convex** — Backend and real-time data
- **Bun** — Package manager and runtime
- **Shadcn UI** / **Radix UI** — Components
- **Tailwind CSS** — Styling
- **TypeScript** — Type safety

## Getting started

### Prerequisites

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) (v1.3.6 recommended, see `packageManager` in `package.json`)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/ProddyAI/platform.git
   cd platform
   ```

2. **Install dependencies**
   ```bash
   bun i
   ```

3. **Environment — Next.js**  
   Copy `.env.next.example` to `.env.local` in the project root and fill in the values.

4. **Environment — Convex**  
   In the [Convex dashboard](https://dashboard.convex.dev/), open your project → **Settings** → **Environment Variables**, and add the variables listed in `.env.convex.example`.

5. **Run the app**
   - Terminal 1 (Next.js): `bun next` → open [https://localhost:3000](https://localhost:3000)
   - Terminal 2 (Convex): `bun convex`

6. You’re set to contribute.

## Folder structure

```
platform/
├── .github/           # PR template, agents
├── convex/            # Convex backend
│   ├── _generated/    # Convex generated (do not edit)
│   └── *.ts           # Domain modules (auth, board, messages, etc.)
├── public/            # Static assets
├── src/
│   ├── app/           # Next.js App Router (routes, layouts, api/)
│   ├── components/    # Shared components + ui/
│   ├── config/        # App config (e.g. Convex provider)
│   ├── features/      # Feature modules (see below)
│   ├── hooks/         # Shared hooks
│   └── lib/           # Utilities, clients, helpers
└── worker/            # Worker scripts
```

**Features** (`src/features/<feature>/`) typically contain:

- `api/` — Convex queries/mutations hooks (e.g. `use-get-channels.ts`)
- `components/` — Feature UI components
- `hooks/`, `utils/`, `types/`, `store/`, `contexts/` — when needed

## Naming conventions

| What              | Convention        | Example                          |
|-------------------|-------------------|----------------------------------|
| **Convex modules**| camelCase         | `workspaceInvites.ts`, `ragchat.ts` |
| **React components** | kebab-case or PascalCase | `board-card.tsx`, `sign-in-card.tsx` |
| **Hooks**         | `use-` prefix, kebab-case | `use-channel-id.ts`, `use-debounce.ts` |
| **API routes**    | kebab-case dirs   | `src/app/api/connections/`, `password-reset/` |
| **Path aliases**  | `@/`              | `@/components`, `@/lib`, `@/hooks`, `@/components/ui` |
