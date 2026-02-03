import { NextResponse } from 'next/server'
import { generateSpec } from '@/lib/llm/generate-spec'
import { getState, updateState } from '@/lib/state'
import { saveSpec } from '@/lib/spec'
import { emitEvent } from '@/lib/events'
import { nowIso } from '@/lib/time'
import { getSpecPath } from '@/lib/paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerateSpecBody = {
  document_id?: string
  guidance?: string
}

export const POST = async (request: Request): Promise<Response> => {
  const body = (await request.json()) as GenerateSpecBody
  const state = await getState()
  const documentPath = state.pipeline.document_path

  if (!documentPath) {
    return NextResponse.json({ error: 'No document uploaded yet.' }, { status: 400 })
  }

  await updateState((current) => ({
    ...current,
    pipeline: { ...current.pipeline, stage: 'spec_generating', error: undefined },
  }))
  emitEvent({ type: 'stage_change', stage: 'spec_generating' })

  try {
    const spec = await generateSpec({ documentPath, guidance: body.guidance })
    const stored = await saveSpec({ ...spec, generated_at: nowIso() })

    await updateState((current) => ({
      ...current,
      pipeline: {
        ...current.pipeline,
        stage: 'spec_review',
        spec_path: getSpecPath(),
        tasks_path: undefined,
        error: undefined,
      },
    }))

    emitEvent({ type: 'spec_ready', spec_id: stored.id })
    emitEvent({ type: 'stage_change', stage: 'spec_review' })

    return NextResponse.json({
      spec_id: stored.id,
      path: getSpecPath(),
      stage: 'spec_review',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spec generation failed.'
    await updateState((current) => ({
      ...current,
      pipeline: { ...current.pipeline, stage: 'doc_uploaded', error: message },
    }))
    emitEvent({ type: 'stage_change', stage: 'doc_uploaded' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
