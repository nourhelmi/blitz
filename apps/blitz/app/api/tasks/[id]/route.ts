import { NextResponse } from 'next/server'
import { TaskSchema, type Task } from '@/lib/schema'
import { removeTask, updateTask } from '@/lib/tasks'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { getTasksPath } from '@/lib/paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: {
    id: string
  }
}

export const PATCH = async (request: Request, { params }: Params): Promise<Response> => {
  const payload = (await request.json()) as Partial<Task>
  const patch = TaskSchema.partial().parse(payload)
  const updated = await updateTask(params.id, patch)
  await updateState((state) => ({
    ...state,
    pipeline: {
      ...state.pipeline,
      stage: 'tasks_review',
      tasks_path: getTasksPath(),
      error: undefined,
    },
  }))
  emitEvent({ type: 'stage_change', stage: 'tasks_review' })
  return NextResponse.json({ task_list: updated })
}

export const DELETE = async (_request: Request, { params }: Params): Promise<Response> => {
  const updated = await removeTask(params.id)
  await updateState((state) => ({
    ...state,
    pipeline: {
      ...state.pipeline,
      stage: 'tasks_review',
      tasks_path: getTasksPath(),
      error: undefined,
    },
  }))
  emitEvent({ type: 'stage_change', stage: 'tasks_review' })
  return NextResponse.json({ task_list: updated })
}
