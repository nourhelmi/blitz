import { NextResponse } from 'next/server'
import { TaskSchema, type Task } from '@/lib/schema'
import { removeTask, updateTask } from '@/lib/tasks'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { getTasksPath } from '@/lib/paths'
import { logInfo } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{
    id: string
  }>
}

export const PATCH = async (request: Request, { params }: Params): Promise<Response> => {
  const { id } = await params
  const payload = (await request.json()) as Partial<Task>
  const patch = TaskSchema.partial().parse(payload)
  const updated = await updateTask(id, patch)
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
  await logInfo('tasks.update', { task_id: id, task_list_id: updated.id })
  return NextResponse.json({ task_list: updated })
}

export const DELETE = async (_request: Request, { params }: Params): Promise<Response> => {
  const { id } = await params
  const updated = await removeTask(id)
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
  await logInfo('tasks.delete', { task_id: id, task_list_id: updated.id })
  return NextResponse.json({ task_list: updated })
}
