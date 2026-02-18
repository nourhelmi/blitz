import { NextResponse } from 'next/server'
import { updateState } from '@/lib/state'
import { emitEvent } from '@/lib/events'
import { getClarificationsPath } from '@/lib/paths'
import { ensureDataDirs, readJsonFile, writeJsonFile } from '@/lib/storage'
import { ClarificationListSchema, type ClarificationList } from '@/lib/schema'
import { nowIso } from '@/lib/time'
import { logInfo, logWarn } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST: approve clarifications and transition to spec generation
export const POST = async (): Promise<Response> => {
  try {
    await ensureDataDirs()
    const current = await readJsonFile(
      getClarificationsPath(),
      ClarificationListSchema,
      null as unknown as ClarificationList
    )
    if (!current) {
      await logWarn('clarify.approve.no_clarifications')
      return NextResponse.json({ error: 'No clarifications found.' }, { status: 404 })
    }

    // Fill in defaults for unanswered questions
    const finalized = {
      ...current,
      approved_at: nowIso(),
      clarifications: current.clarifications.map((c) => ({
        ...c,
        answer: c.answer ?? c.assumption ?? 'No answer provided',
      })),
    }

    await writeJsonFile(getClarificationsPath(), finalized)

    await updateState((state) => ({
      ...state,
      pipeline: { ...state.pipeline, stage: 'doc_uploaded' },
    }))

    emitEvent({ type: 'stage_change', stage: 'doc_uploaded' })
    await logInfo('clarify.approved', { count: finalized.clarifications.length })

    return NextResponse.json({ success: true, clarification_list: finalized })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Approval failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
