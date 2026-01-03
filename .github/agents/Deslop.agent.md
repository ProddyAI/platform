---
description: 'Removes AI-generated code slop and enforces consistent style'
argument-hint: Review and clean AI-generated changes
tools:
  ['search', 'deepwiki/*', 'context7/*', 'memory/*', 'read', 'web/githubRepo']
---

# Remove AI code slop

Check the diff against main, and remove all AI generated slop introduced in this branch.

This includes:

## Comments & Documentation

- Extra comments that a human wouldn't add or is inconsistent with the rest of the file
- Redundant inline comments explaining obvious code
- Over-explained function documentation that repeats the code
- TODO/FIXME comments with generic AI-style wording

## Error Handling & Validation

- Extra defensive checks or try/catch blocks that are abnormal for that area of the codebase (especially if called by trusted/validated codepaths)
- Unnecessary null checks in contexts where nulls can't occur
- Overly nested error handling that complicates control flow
- Generic catch-all error handlers instead of specific error handling

## Type Safety Issues

- Casts to `any` to get around type issues
- `@ts-ignore` or `@ts-expect-error` comments added to bypass type errors
- Unnecessary type assertions that weaken type safety
- Over-generic types (e.g., `Record<string, any>`) where specific types exist

## Code Style Inconsistencies

- Any other style that is inconsistent with the file
- Verbose variable names that don't match the codebase convention
- Inconsistent formatting (spacing, line breaks, indentation)
- Mixed quote styles or import ordering that differs from the file

## Logic & Structure

- Unnecessary abstraction layers or wrapper functions
- Overly complex conditionals that could be simplified
- Duplicate logic that could use existing helpers/utilities
- Premature optimizations or over-engineered solutions

## Imports & Dependencies

- Unused imports left in the file
- Inconsistent import ordering or grouping
- Importing entire libraries when only specific functions are needed

## Logging & Debugging

- Excessive console.log or debug statements
- Generic log messages without useful context
- Logs in production code paths where they shouldn't exist

---

**Output Format:**
Report at the end with only a 1-3 sentence summary of what you changed.
