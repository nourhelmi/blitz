import { NextResponse } from 'next/server'
import { updateState, getState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { nowIso } from '@/lib/time'
import { initRunControl } from '@/lib/run-control'
import { runOrchestrator } from '@/lib/orchestrator'
import { getTaskList } from '@/lib/tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RunBody = {
  max_parallel?: number
}

export const GET = async (): Promise<Response> => {
  const state = await getState()
  return NextResponse.json({ runs: state.runs, current_run: state.current_run })
}

export const POST = async (request: Request): Promise<Response> => {
  const body = (await request.json()) as RunBody
  const taskList = await getTaskList()
  if (!taskList || !taskList.approved_at) {
    return NextResponse.json(
      { error: 'Task list must be approved before running.' },
      { status: 400 }
    )
  }
  const maxParallel = clampParallel(body.max_parallel)
  const runId = crypto.randomUUID()
  const startedAt = nowIso()

  await updateState((state) => ({
    ...state,
    pipeline: {
      ...state.pipeline,
      stage: 'running',
      current_run_id: runId,
      error: undefined,
    },
    current_run: {
      id: runId,
      started_at: startedAt,
      status: 'running',
      max_parallel: maxParallel,
      task_runs: [],
    },
    runs: [
      ...state.runs.filter((run) => run.id !== runId),
      {
        id: runId,
        started_at: startedAt,
        status: 'running',
        max_parallel: maxParallel,
        task_runs: [],
      },
    ],
  }))

  emitEvent({ type: 'stage_change', stage: 'running' })

  initRunControl(runId)
  setTimeout(() => {
    runOrchestrator({ runId, maxParallel }).catch(async (error) => {
      await updateState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          stage: 'paused',
          error: error instanceof Error ? error.message : 'Run failed.',
        },
      }))
      emitEvent({ type: 'run_completed', success: false })
    })
  }, 0)

  return NextResponse.json({ run_id: runId, status: 'running', stage: 'running' })
}

const clampParallel = (value: number | undefined): number => {
  const fallback = Number(process.env.BLITZ_MAX_PARALLEL ?? 3)
  const parsed = value ?? fallback
  return Math.max(1, Math.min(10, parsed))
}
