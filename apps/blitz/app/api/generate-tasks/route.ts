import { NextResponse } from 'next/server'
import { generateTasks } from '@/lib/llm/generate-tasks'
import { getSpec } from '@/lib/spec'
import { saveTaskList } from '@/lib/tasks'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { nowIso } from '@/lib/time'
import { getTasksPath } from '@/lib/paths'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { getLlmErrorMeta } from '@/lib/llm/error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateTasksBody = {
  guidance?: string
}

export const POST = async (request: Request): Promise<Response> => {
  const spec = await getSpec()
  if (!spec) {
    await logWarn('tasks.generate.missing_spec')
    return NextResponse.json({ error: 'Spec not found.' }, { status: 404 })
  }

  const body = (await request.json()) as GenerateTasksBody
  await logInfo('tasks.generate.start', { spec_id: spec.id })
  await updateState((state) => ({
    ...state,
    pipeline: { ...state.pipeline, stage: 'tasks_generating', error: undefined },
  }))
  emitEvent({ type: 'stage_change', stage: 'tasks_generating' })

  try {
    const taskList = await generateTasks({ spec, guidance: body.guidance })
    const stored = await saveTaskList({ ...taskList, generated_at: nowIso() })

    await updateState((state) => ({
      ...state,
      pipeline: { ...state.pipeline, stage: 'tasks_review', tasks_path: getTasksPath(), error: undefined },
    }))

    emitEvent({ type: 'tasks_ready', count: stored.tasks.length })
    emitEvent({ type: 'stage_change', stage: 'tasks_review' })

    return NextResponse.json({
      task_list_id: stored.id,
      path: getTasksPath(),
      task_count: stored.tasks.length,
      stage: 'tasks_review',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Task generation failed.'
    await logError('tasks.generate.failed', { error: message, ...getLlmErrorMeta(error) })
    await updateState((state) => ({
      ...state,
      pipeline: { ...state.pipeline, stage: 'spec_approved', error: message },
    }))
    emitEvent({ type: 'stage_change', stage: 'spec_approved' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
