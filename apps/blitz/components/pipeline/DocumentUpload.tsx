'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { PipelineStage } from '@/lib/schema'

type DocumentUploadProps = {
  onComplete: () => void
  stage?: PipelineStage
}

export const DocumentUpload = ({ onComplete, stage }: DocumentUploadProps) => {
  const [name, setName] = useState('pasted-doc')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const stageLabel = useMemo(() => stage?.replaceAll('_', ' ') ?? 'empty', [stage])
  const hasRemoteDoc = stage ? stage !== 'empty' : false
  const hasLocalDoc = content.trim().length > 0
  const shouldUpload = hasLocalDoc || !hasRemoteDoc

  const handleFile = async (file: File): Promise<void> => {
    setName(file.name || 'uploaded-doc')
    setContent(await file.text())
  }

  const upload = async (): Promise<boolean> => {
    if (!hasLocalDoc) {
      setError('Document content is required to upload.')
      return false
    }
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, name }),
    })
    if (!response.ok) throw new Error(await response.text())
    return true
  }

  const lockDocument = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const ok = await upload()
      if (ok) onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const generateClarifications = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      if (shouldUpload) {
        const ok = await upload()
        if (!ok) return
      }
      const response = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error(await response.text())
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clarification generation failed.')
    } finally {
      setBusy(false)
    }
  }

  const generateSpec = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      if (shouldUpload) {
        const ok = await upload()
        if (!ok) return
      }
      const response = await fetch('/api/generate-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error(await response.text())
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spec generation failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Stage 1</p>
          <h2 className="font-[var(--font-display)] text-2xl uppercase tracking-[0.2em]">
            Document Intake
          </h2>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Status: {stageLabel}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed border-white/10 bg-[var(--surface-2)] px-4 py-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)] hover:border-[var(--accent)] hover:text-white">
          <input
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          Upload File
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Document Name
          </label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <p className="text-xs text-[var(--muted)]">
            Markdown, text, or JSON. The pipeline extracts structure automatically.
          </p>
        </div>
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Document Content
          </label>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Paste requirements, PRD, or raw notes..."
          />
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Output: data/documents/*
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={lockDocument} disabled={busy || !hasLocalDoc}>
            {busy ? 'Uploading...' : 'Lock Document'}
          </Button>
          <Button
            variant="outline"
            onClick={generateClarifications}
            disabled={busy || (!hasLocalDoc && !hasRemoteDoc)}
          >
            {busy ? 'Generating...' : 'Clarify First'}
          </Button>
          <Button
            variant="outline"
            onClick={generateSpec}
            disabled={busy || (!hasLocalDoc && !hasRemoteDoc)}
          >
            {busy ? 'Generating...' : 'Generate Spec'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
