import { NextResponse } from 'next/server'
import { SpecSchema, type Spec } from '@/lib/schema'
import { getSpec, saveSpec } from '@/lib/spec'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { getSpecPath } from '@/lib/paths'
import { logInfo, logWarn } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (): Promise<Response> => {
  const spec = await getSpec()
  if (!spec) {
    await logWarn('spec.get.missing')
    return NextResponse.json({ error: 'Spec not found.' }, { status: 404 })
  }
  await logInfo('spec.get', { spec_id: spec.id })
  return NextResponse.json({ spec })
}

export const PATCH = async (request: Request): Promise<Response> => {
  const spec = await getSpec()
  if (!spec) {
    await logWarn('spec.patch.missing')
    return NextResponse.json({ error: 'Spec not found.' }, { status: 404 })
  }
  const patch = SpecSchema.partial().parse((await request.json()) as Partial<Spec>)
  const next = await saveSpec({ ...spec, ...patch, approved_at: undefined })
  await updateState((state) => ({
    ...state,
    pipeline: {
      ...state.pipeline,
      stage: 'spec_review',
      spec_path: getSpecPath(),
      error: undefined,
    },
  }))
  emitEvent({ type: 'stage_change', stage: 'spec_review' })
  await logInfo('spec.patch', { spec_id: next.id })
  return NextResponse.json({ spec: next })
}
