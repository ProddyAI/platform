## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy to keep main context window clean

- Offload research, exploration, parallel analysis to subagents
- For complex problems, throw more compute via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction: update `tasks/lessons.md` with pattern
- Write rules preventing same mistake
- Ruthlessly iterate until mistake rate drops
- Review lessons at session start

### 4. Verification Before Done

- Never mark task complete without proving it works
- Diff behavior between main and changes when relevant
- Ask: "Would staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause, ask "is there more elegant way?"
- If fix feels hacky: "Knowing everything I know now, implement elegant solution"
- Skip for simple, obvious fixes — don't over-engineer
- Challenge own work before presenting

### 6. Autonomous Bug Fixing

- Given bug report: just fix it. No hand-holding
- Point at logs, errors, failing tests → resolve them
- Zero context switching from user
- Fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary each step
5. **Document Results**: Add review to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temp fixes. Senior dev standards.
- **Minimal Impact**: Touch only what's necessary. Avoid introducing bugs.