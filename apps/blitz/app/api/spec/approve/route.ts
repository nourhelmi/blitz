import { NextResponse } from 'next/server'
import { getSpec, saveSpec } from '@/lib/spec'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { nowIso } from '@/lib/time'
import { getSpecPath } from '@/lib/paths'
import { logInfo, logWarn } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = async (): Promise<Response> => {
  const spec = await getSpec()
  if (!spec) {
    await logWarn('spec.approve.missing_spec')
    return NextResponse.json({ error: 'Spec not found.' }, { status: 404 })
  }
  const approved = await saveSpec({ ...spec, approved_at: nowIso() })

  await updateState((state) => ({
    ...state,
    pipeline: {
      ...state.pipeline,
      stage: 'spec_approved',
      spec_path: getSpecPath(),
      error: undefined,
    },
  }))

  emitEvent({ type: 'stage_change', stage: 'spec_approved' })
  await logInfo('spec.approve.success', { spec_id: approved.id })

  return NextResponse.json({ stage: 'spec_approved', spec_id: approved.id })
}
