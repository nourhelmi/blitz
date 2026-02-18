import { z } from 'zod'

// High-signal schema definitions keep IO and validation aligned across UI + API.

export const PipelineStage = z.enum([
  'empty',
  'doc_uploaded',
  'clarifying',
  'spec_generating',
  'spec_review',
  'spec_approved',
  'tasks_generating',
  'tasks_review',
  'tasks_approved',
  'running',
  'paused',
  'completed',
])

export type PipelineStage = z.infer<typeof PipelineStage>

export const PipelineStateSchema = z
  .object({
    stage: PipelineStage,
    document_path: z.string().optional(),
    clarifications_path: z.string().optional(),
    spec_path: z.string().optional(),
    tasks_path: z.string().optional(),
    current_run_id: z.string().optional(),
    error: z.string().optional(),
  })
  .default({ stage: 'empty' })

export type PipelineState = z.infer<typeof PipelineStateSchema>

export const ClarificationSchema = z.object({
  id: z.string().describe('Unique clarification identifier.'),
  question: z.string().describe('The clarifying question to ask the user.'),
  context: z.string().describe('Why this question matters for the spec.'),
  options: z.array(z.string()).optional().describe('Suggested answer options.'),
  answer: z.string().optional().describe('User-provided answer.'),
  assumption: z.string().optional().describe('LLM default assumption if user skips.'),
})

export type Clarification = z.infer<typeof ClarificationSchema>

export const ClarificationListSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  clarifications: z.array(ClarificationSchema),
  generated_at: z.string(),
  approved_at: z.string().optional(),
})

export type ClarificationList = z.infer<typeof ClarificationListSchema>

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  content_type: z.enum(['markdown', 'text', 'json', 'unknown']),
  uploaded_at: z.string(),
})

export type Document = z.infer<typeof DocumentSchema>

export const TechStackEntrySchema = z
  .object({
    category: z.string().describe('Area like frontend, backend, infra, or data.'),
    items: z.array(z.string()).describe('Tools, frameworks, or services in this area.'),
  })
  .describe('Grouped tech stack items.')

export const SpecSchema = z.object({
  id: z.string().describe('Unique spec identifier.'),
  project: z.string().describe('Project name.'),
  version: z.string().default('1.0.0').describe('Spec version string.'),
  summary: z.string().describe('High-level project summary.'),
  goals: z.array(z.string()).default([]).describe('Primary outcomes the project targets.'),
  architecture: z
    .object({
      overview: z.string().describe('Concise architecture overview.'),
      tech_stack: z.array(TechStackEntrySchema).optional(),
      key_components: z
        .array(
          z.object({
            name: z.string().describe('Component name.'),
            description: z.string().describe('What this component does.'),
            responsibilities: z.array(z.string()).describe('Key responsibilities.'),
          })
        )
        .optional(),
    })
    .optional(),
  constraints: z.array(z.string()).optional().describe('Non-negotiable constraints.'),
  conventions: z.array(z.string()).optional().describe('Coding or product conventions to follow.'),
  init_script: z.string().optional().describe('How to start the app locally.'),
  working_directory: z.string().optional().describe('Root directory for the project.'),
  phases: z
    .array(
      z.object({
        id: z.string().describe('Phase identifier.'),
        name: z.string().describe('Short phase name.'),
        description: z.string().describe('What this phase delivers.'),
        depends_on: z.array(z.string()).default([]).describe('Phase IDs that must finish first.'),
      })
    )
    .optional(),
  generated_at: z.string().describe('ISO timestamp for generation time.'),
  approved_at: z.string().optional().describe('ISO timestamp for approval time.'),
})

export type Spec = z.infer<typeof SpecSchema>

export const TaskStatus = z.enum([
  'pending',
  'blocked',
  'ready',
  'in_progress',
  'completed',
  'failed',
])

export type TaskStatus = z.infer<typeof TaskStatus>

export const TaskCategory = z.enum(['functional', 'refactor', 'infrastructure', 'test'])

export type TaskCategory = z.infer<typeof TaskCategory>

export const TaskSchema = z.object({
  id: z.string().describe('Unique task identifier.'),
  title: z.string().describe('Short, action-oriented task title.'),
  description: z.string().describe('What to implement.'),
  phase: z.string().optional().describe('Phase bucket for grouping.'),
  category: TaskCategory.default('functional').describe('Task type.'),
  blocked_by: z.array(z.string()).default([]).describe('Task IDs that must complete first.'),
  acceptance: z.array(z.string()).describe('Concrete, verifiable criteria.'),
  hints: z.array(z.string()).optional().describe('Implementation guidance.'),
  files_likely_touched: z.array(z.string()).optional().describe('Predicted file paths.'),
  priority: z.number().default(0).describe('Higher means earlier scheduling.'),
  estimated_minutes: z.number().optional().describe('Rough time estimate in minutes.'),
})

export type Task = z.infer<typeof TaskSchema>

export const TaskListSchema = z.object({
  id: z.string(),
  spec_id: z.string(),
  tasks: z.array(TaskSchema),
  generated_at: z.string(),
  approved_at: z.string().optional(),
})

export type TaskList = z.infer<typeof TaskListSchema>

export const TaskRunSchema = z.object({
  task_id: z.string(),
  status: TaskStatus,
  attempt: z.number().default(0),
  agent_pid: z.number().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  error: z.string().optional(),
  log_file: z.string().optional(),
  git_commit: z.string().optional(),
  context: z.string().optional(),
})

export type TaskRun = z.infer<typeof TaskRunSchema>

export const RunSchema = z.object({
  id: z.string(),
  started_at: z.string(),
  status: z.enum(['running', 'paused', 'completed', 'failed']),
  max_parallel: z.number().default(3),
  max_retries: z.number().default(2),
  task_runs: z.array(TaskRunSchema).default([]),
})

export type Run = z.infer<typeof RunSchema>

export const StateSchema = z
  .object({
    pipeline: PipelineStateSchema,
    current_run: RunSchema.optional(),
    runs: z.array(RunSchema).default([]),
    task_states: z.record(z.string(), TaskStatus).default({}),
  })
  .default({ pipeline: { stage: 'empty' }, runs: [], task_states: {} })

export type State = z.infer<typeof StateSchema>

export type TaskWithStatus = Task & { status: TaskStatus }
