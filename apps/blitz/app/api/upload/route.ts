import { writeFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { DocumentSchema, type Document } from '@/lib/schema'
import { getDocumentPath } from '@/lib/paths'
import { ensureDataDirs } from '@/lib/storage'
import { updateState } from '@/lib/state'
import { nowIso } from '@/lib/time'
import { emitEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type UploadBody = {
  content?: string
  name?: string
}

export const POST = async (request: Request): Promise<Response> => {
  const contentType = request.headers.get('content-type') ?? ''
  const payload = await readUploadPayload(request, contentType)

  if (!payload.content.trim()) {
    return NextResponse.json({ error: 'Document content is required.' }, { status: 400 })
  }

  const document: Document = DocumentSchema.parse({
    id: crypto.randomUUID(),
    name: payload.name,
    content: payload.content,
    content_type: detectContentType(payload.name),
    uploaded_at: nowIso(),
  })

  await ensureDataDirs()
  const path = getDocumentPath(document.id, document.name)
  await writeFile(path, document.content, 'utf-8')

  await updateState((state) => ({
    ...state,
    pipeline: {
      ...state.pipeline,
      stage: 'doc_uploaded',
      document_path: path,
      spec_path: undefined,
      tasks_path: undefined,
      error: undefined,
    },
  }))

  emitEvent({ type: 'stage_change', stage: 'doc_uploaded' })

  return NextResponse.json({
    document_id: document.id,
    path,
    stage: 'doc_uploaded',
  })
}

const readUploadPayload = async (
  request: Request,
  contentType: string
): Promise<{ content: string; name: string }> => {
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as UploadBody
    return {
      content: body.content ?? '',
      name: body.name ?? 'pasted-doc',
    }
  }

  if (contentType.includes('multipart/form-data')) {
    const data = await request.formData()
    const file = data.get('file')
    if (file instanceof File) {
      return {
        content: await file.text(),
        name: file.name || 'uploaded-doc',
      }
    }
  }

  return {
    content: await request.text(),
    name: 'pasted-doc',
  }
}

const detectContentType = (name: string): Document['content_type'] => {
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown'
  if (name.endsWith('.json')) return 'json'
  return 'text'
}
