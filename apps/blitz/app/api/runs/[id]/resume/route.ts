import { NextResponse } from 'next/server'
import { resumeRun } from '@/lib/run-control'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { logInfo } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{
    id: string
  }>
}

export const POST = async (_request: Request, { params }: Params): Promise<Response> => {
  const { id } = await params
  resumeRun()
  await updateState((state) => ({
    ...state,
    pipeline: { ...state.pipeline, stage: 'running' },
    current_run: state.current_run
      ? { ...state.current_run, status: 'running' }
      : state.current_run,
  }))
  emitEvent({ type: 'stage_change', stage: 'running' })
  await logInfo('runs.resume', { run_id: id })
  return NextResponse.json({ run_id: id, status: 'running' })
}
