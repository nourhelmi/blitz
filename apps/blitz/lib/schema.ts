import { z } from 'zod'

// High-signal schema definitions keep IO and validation aligned across UI + API.

export const PipelineStage = z.enum([
  'empty',
  'doc_uploaded',
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
    spec_path: z.string().optional(),
    tasks_path: z.string().optional(),
    current_run_id: z.string().optional(),
    error: z.string().optional(),
  })
  .default({ stage: 'empty' })

export type PipelineState = z.infer<typeof PipelineStateSchema>

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  content_type: z.enum(['markdown', 'text', 'json', 'unknown']),
  uploaded_at: z.string(),
})

export type Document = z.infer<typeof DocumentSchema>

export const SpecSchema = z.object({
  id: z.string(),
  project: z.string(),
  version: z.string().default('1.0.0'),
  summary: z.string(),
  goals: z.array(z.string()).default([]),
  architecture: z
    .object({
      overview: z.string(),
      tech_stack: z.record(z.string(), z.array(z.string())).optional(),
      key_components: z
        .array(
          z.object({
            name: z.string(),
            description: z.string(),
            responsibilities: z.array(z.string()),
          })
        )
        .optional(),
    })
    .optional(),
  constraints: z.array(z.string()).optional(),
  conventions: z.array(z.string()).optional(),
  init_script: z.string().optional(),
  working_directory: z.string().optional(),
  phases: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        depends_on: z.array(z.string()).default([]),
      })
    )
    .optional(),
  generated_at: z.string(),
  approved_at: z.string().optional(),
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
  id: z.string(),
  title: z.string(),
  description: z.string(),
  phase: z.string().optional(),
  category: TaskCategory.default('functional'),
  blocked_by: z.array(z.string()).default([]),
  acceptance: z.array(z.string()),
  hints: z.array(z.string()).optional(),
  files_likely_touched: z.array(z.string()).optional(),
  priority: z.number().default(0),
  estimated_minutes: z.number().optional(),
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
