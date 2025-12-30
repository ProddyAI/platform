/**
 * ESLint config for a strict, type-safe TypeScript codebase.
 *
 * Why so strict?
 * - Prevents unsafe patterns that often slip into TS code (including AI-written code)
 * - Forces type-safe access/calls/returns when TypeScript types are available
 */

// eslint-disable-next-line no-undef
module.exports = {
  root: true,
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'dist/',
    'out/',
    // Convex generated code is machine-written.
    'convex/_generated/',
    // Built artifacts
    'public/sw.js',
    'public/workbox-*.js',
    'public/worker-*.js',
  ],

  env: {
    browser: true,
    es2021: true,
    node: true,
  },

  extends: [
    // Next.js base rules (React/JSX + perf best practices).
    'next/core-web-vitals',
  ],

  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        // Type-aware linting (required for the *-type-checked configs and no-unsafe-* rules).
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json', './convex/tsconfig.json'],
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:@typescript-eslint/stylistic-type-checked',
      ],
      rules: {
        // STRICT (required): ban common unsafe patterns.
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'error',
        '@typescript-eslint/no-unsafe-call': 'error',
        '@typescript-eslint/no-unsafe-return': 'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            disallowTypeAnnotations: false,
            fixStyle: 'separate-type-imports',
          },
        ],

        // Disallow "unknown"-style cast chains and other unsafe assertions.
        '@typescript-eslint/no-unsafe-type-assertion': 'error',
      },
    },

    // Config/build scripts: allow CommonJS globals in config files.
    {
      files: ['**/*.cjs', 'next.config.mjs', 'postcss.config.mjs', 'tailwind.config.ts'],
      env: {
        node: true,
        browser: false,
      },
    },
  ],
};
