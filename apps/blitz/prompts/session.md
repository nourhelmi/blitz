You are working on task {{TASK_ID}}: {{TASK_TITLE}}

## Description
{{TASK_DESCRIPTION}}

## Acceptance Criteria
{{TASK_ACCEPTANCE}}

## Hints
{{TASK_HINTS}}

## Project Context
{{SPEC_CONVENTIONS}}

## Working Directory
{{WORKING_DIRECTORY}}

## Getting Started
1. Read `data/blitz-context.md` for decisions made by previous tasks
2. Check `git log --oneline -10` to see recent changes
3. Explore the codebase to understand current state

## Before Finishing
Output any important decisions/discoveries using this format (orchestrator will capture and append):

```
<blitz-context>
## Task {{TASK_ID}}: {{TASK_TITLE}}
- [Your decisions and discoveries here]
- File paths you created
- Architectural choices you made
- Patterns you established
</blitz-context>
```

## Rules
1. Complete this ONE task only
2. Verify ALL acceptance criteria before finishing
3. Do NOT commit changes
4. Output context using <blitz-context> tags (orchestrator captures this)
5. When complete, output: <promise>COMPLETE</promise>
6. If blocked, exit with error explaining why
