import { generateText, Output } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { TaskListSchema, TaskSchema, type TaskList, type Spec } from '../schema'
import { getModelId } from './client'
import { loadPrompt } from './prompts'
import { nowIso } from '../time'

const TasksDraftSchema = z.object({
  tasks: z.array(TaskSchema),
})

type GenerateTasksInput = {
  spec: Spec
  guidance?: string
}

// Builds user prompt with structured analysis triggers
const buildUserPrompt = (spec: Spec, guidance?: string): string => {
  const guidanceSection = guidance
    ? `
## Reviewer Guidance

Incorporate this feedback from a human reviewer:

<guidance>
${guidance}
</guidance>
`
    : ''

  // Extract phase info for context
  const phaseSummary = spec.phases?.length
    ? `\n\nPhases defined: ${spec.phases.map((p) => p.id).join(' → ')}`
    : ''

  return `## Project Specification

Break this specification into atomic, parallelizable tasks for AI coding agents.

<spec>
${JSON.stringify(spec, null, 2)}
</spec>
${guidanceSection}
## Analysis Checklist

Before generating tasks, consider:

1. **Critical path**: What sequence of tasks determines minimum completion time?
2. **Parallelism**: Which tasks have no dependencies on each other?
3. **Risk ordering**: Should high-uncertainty work come early to surface issues?
4. **Completeness**: Does every goal in the spec have corresponding tasks?
${phaseSummary}

## Instructions

Generate a comprehensive task list that:
- Covers all goals and components from the spec
- Maximizes parallel execution where possible
- Has realistic time estimates (15-60 min per task)
- Forms a valid dependency DAG (no cycles)
- Includes concrete, verifiable acceptance criteria

Produce the task list now.`
}

export const generateTasks = async ({ spec, guidance }: GenerateTasksInput): Promise<TaskList> => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required to generate tasks.')
  }

  const system = await loadPrompt('task-generation.md')

  const { output } = await generateText({
    model: openrouter(getModelId()),
    system,
    output: Output.object({
      schema: TasksDraftSchema,
      name: 'task_list',
      description: 'Atomic task breakdown for execution orchestration.',
    }),
    prompt: buildUserPrompt(spec, guidance),
  })

  return TaskListSchema.parse({
    id: crypto.randomUUID(),
    spec_id: spec.id,
    tasks: output.tasks,
    generated_at: nowIso(),
  })
}
