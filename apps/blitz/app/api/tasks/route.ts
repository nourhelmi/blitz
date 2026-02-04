import { NextResponse } from 'next/server'
import { TaskSchema, type Task } from '@/lib/schema'
import { addTask, getTaskList, saveTaskList } from '@/lib/tasks'
import { getState, updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { getTasksPath } from '@/lib/paths'
import { logInfo, logWarn } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (): Promise<Response> => {
  const taskList = await getTaskList()
  if (!taskList) {
    await logWarn('tasks.get.missing')
    return NextResponse.json({ error: 'Task list not found.' }, { status: 404 })
  }
  const state = await getState()
  await logInfo('tasks.get', { task_list_id: taskList.id })
  return NextResponse.json({ task_list: taskList, task_states: state.task_states })
}

export const POST = async (request: Request): Promise<Response> => {
  const payload = (await request.json()) as Task
  const task = TaskSchema.parse(payload)
  const updated = await addTask(task)
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
  await logInfo('tasks.add', { task_id: task.id, task_list_id: updated.id })
  return NextResponse.json({ task_list: updated })
}

export const PATCH = async (request: Request): Promise<Response> => {
  const taskList = await getTaskList()
  if (!taskList) {
    await logWarn('tasks.patch.missing')
    return NextResponse.json({ error: 'Task list not found.' }, { status: 404 })
  }
  const payload = (await request.json()) as { tasks?: Task[] }
  if (!payload.tasks) {
    await logWarn('tasks.patch.missing_payload')
    return NextResponse.json({ error: 'Tasks payload missing.' }, { status: 400 })
  }
  const nextTasks = payload.tasks.map((task) => TaskSchema.parse(task))
  const updated = await saveTaskList({ ...taskList, tasks: nextTasks, approved_at: undefined })
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
  await logInfo('tasks.patch', { task_list_id: updated.id, count: updated.tasks.length })
  return NextResponse.json({ task_list: updated })
}
