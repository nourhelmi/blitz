import { NextResponse } from 'next/server'
import { TaskSchema, type Task } from '@/lib/schema'
import { addTask, getTaskList, saveTaskList } from '@/lib/tasks'
import { getState, updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { getTasksPath } from '@/lib/paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (): Promise<Response> => {
  const taskList = await getTaskList()
  if (!taskList) {
    return NextResponse.json({ error: 'Task list not found.' }, { status: 404 })
  }
  const state = await getState()
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
  return NextResponse.json({ task_list: updated })
}

export const PATCH = async (request: Request): Promise<Response> => {
  const taskList = await getTaskList()
  if (!taskList) {
    return NextResponse.json({ error: 'Task list not found.' }, { status: 404 })
  }
  const payload = (await request.json()) as { tasks?: Task[] }
  if (!payload.tasks) {
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
  return NextResponse.json({ task_list: updated })
}
