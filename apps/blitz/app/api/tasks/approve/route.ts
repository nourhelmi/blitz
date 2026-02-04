import { NextResponse } from 'next/server'
import { getTaskList, saveTaskList } from '@/lib/tasks'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { nowIso } from '@/lib/time'
import { getTasksPath } from '@/lib/paths'
import { logInfo, logWarn } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = async (): Promise<Response> => {
  const taskList = await getTaskList()
  if (!taskList) {
    await logWarn('tasks.approve.missing_tasks')
    return NextResponse.json({ error: 'Task list not found.' }, { status: 404 })
  }

  const approved = await saveTaskList({ ...taskList, approved_at: nowIso() })
  await updateState((state) => ({
    ...state,
    pipeline: {
      ...state.pipeline,
      stage: 'tasks_approved',
      tasks_path: getTasksPath(),
      error: undefined,
    },
  }))

  emitEvent({ type: 'stage_change', stage: 'tasks_approved' })
  await logInfo('tasks.approve.success', { task_list_id: approved.id })

  return NextResponse.json({ stage: 'tasks_approved', task_list_id: approved.id })
}
