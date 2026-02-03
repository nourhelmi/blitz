import { NextResponse } from 'next/server'
import { stopRun } from '@/lib/run-control'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: {
    id: string
  }
}

export const POST = async (_request: Request, { params }: Params): Promise<Response> => {
  stopRun()
  await updateState((state) => ({
    ...state,
    pipeline: { ...state.pipeline, stage: 'paused', error: 'Run stopped by user.' },
    current_run: state.current_run
      ? { ...state.current_run, status: 'failed' }
      : state.current_run,
  }))
  emitEvent({ type: 'run_completed', success: false })
  emitEvent({ type: 'stage_change', stage: 'paused' })
  return NextResponse.json({ run_id: params.id, status: 'failed' })
}
