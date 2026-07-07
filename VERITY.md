# VERITY.md — Quality Gate

> This project uses [Verity](https://verity.md) to enforce quality and security standards on AI-generated code.

**URL:** https://ofcamwrjwrkazqvdchko.supabase.co/functions/v1
**Project:** c78557da-785c-4141-8f3e-6735d601b78d
**Standard:** v1

## Quality Dimensions
- Comprehensibility (file length, complexity, naming)
- Modularity (separation of concerns, shallow abstractions)
- Type Safety (strict types, explicit returns)
- Test Adequacy (coverage, test quality)

## Security Patterns
- No hardcoded secrets (CWE-798)
- Input sanitization (CWE-20)
- Parameterized queries (CWE-89)
- Dependency verification (CWE-1395)
- No unsafe deserialization (CWE-502)
- Access control checks (CWE-639)
- Config file integrity (CWE-15)

## Project-Specific Patterns
- Convex workspace authz — identity from `ctx.auth`, not client args; verify membership/ownership (critical)
- Server-only secrets — third-party keys never in client bundles or `NEXT_PUBLIC_` env (critical)
- Convex args validators — object-form functions with explicit `v.*` validators (high)
- Feature-scoped modules — new frontend logic under `src/features/<feature>/` (low)
- Safe React keys — no array-index keys on dynamic lists, per DeepSource JS-0437 (low)

## How It Works
This project gates at **commit time** (`git commit` reviews the staged diff and blocks on FAIL).
When triggered, the Verity hook:
1. Runs static analysis via @codacy/analysis-cli (ESLint9 + Semgrep + Trivy, curated patterns)
2. Sends results + code to the Verity service
3. An independent LLM reviewer evaluates the code against this Standard
4. Returns PASS / WARN / FAIL with actionable findings (max 2 self-heal cycles)
