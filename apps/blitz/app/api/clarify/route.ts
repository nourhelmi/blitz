import { NextResponse } from 'next/server'
import { updateState, getState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { generateClarifications } from '@/lib/llm/generate-clarifications'
import { getClarificationsPath } from '@/lib/paths'
import { ensureDataDirs, readJsonFile, writeJsonFile } from '@/lib/storage'
import { ClarificationListSchema, type ClarificationList } from '@/lib/schema'
import { logError, logInfo, logWarn } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST: trigger clarification generation from the uploaded document
export const POST = async (): Promise<Response> => {
  const state = await getState()
  if (!state.pipeline.document_path) {
    await logWarn('clarify.no_document')
    return NextResponse.json({ error: 'Upload a document first.' }, { status: 400 })
  }

  try {
    await updateState((current) => ({
      ...current,
      pipeline: { ...current.pipeline, stage: 'clarifying', error: undefined },
    }))
    emitEvent({ type: 'stage_change', stage: 'clarifying' })

    // Extract document ID from state
    const documentId = state.pipeline.document_path.split('/').pop()?.split('-')[0] ?? 'unknown'

    const clarificationList = await generateClarifications({
      documentPath: state.pipeline.document_path,
      documentId,
    })

    await ensureDataDirs()
    const clarificationsPath = getClarificationsPath()
    await writeJsonFile(clarificationsPath, clarificationList)

    await updateState((current) => ({
      ...current,
      pipeline: { ...current.pipeline, clarifications_path: clarificationsPath },
    }))

    emitEvent({ type: 'clarifications_ready', count: clarificationList.clarifications.length })
    await logInfo('clarify.generated', { count: clarificationList.clarifications.length })

    return NextResponse.json({ clarification_list: clarificationList })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clarification generation failed.'
    await logError('clarify.failed', { error: message })
    await updateState((current) => ({
      ...current,
      pipeline: { ...current.pipeline, stage: 'doc_uploaded', error: message },
    }))
    emitEvent({ type: 'stage_change', stage: 'doc_uploaded' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET: fetch current clarifications
export const GET = async (): Promise<Response> => {
  try {
    await ensureDataDirs()
    const raw = await readJsonFile(
      getClarificationsPath(),
      ClarificationListSchema,
      null as unknown as ClarificationList
    )
    if (!raw) {
      return NextResponse.json({ clarification_list: null })
    }
    return NextResponse.json({ clarification_list: raw })
  } catch {
    return NextResponse.json({ clarification_list: null })
  }
}

// PATCH: update answers on clarifications
export const PATCH = async (request: Request): Promise<Response> => {
  const body = (await request.json()) as {
    answers: Record<string, string>
  }

  try {
    await ensureDataDirs()
    const current = await readJsonFile(
      getClarificationsPath(),
      ClarificationListSchema,
      null as unknown as ClarificationList
    )
    if (!current) {
      return NextResponse.json({ error: 'No clarifications found.' }, { status: 404 })
    }

    const updated = {
      ...current,
      clarifications: current.clarifications.map((c) => ({
        ...c,
        answer: body.answers[c.id] ?? c.answer,
      })),
    }

    await writeJsonFile(getClarificationsPath(), updated)
    await logInfo('clarify.answers_updated', { count: Object.keys(body.answers).length })

    return NextResponse.json({ clarification_list: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update answers.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
