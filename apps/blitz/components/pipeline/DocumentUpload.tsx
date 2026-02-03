'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type DocumentUploadProps = {
  onComplete: () => void
}

export const DocumentUpload = ({ onComplete }: DocumentUploadProps) => {
  const [name, setName] = useState('pasted-doc')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const handleFile = async (file: File): Promise<void> => {
    setName(file.name || 'uploaded-doc')
    setContent(await file.text())
  }

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, name }),
      })
      if (!response.ok) throw new Error(await response.text())
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">Stage 1</p>
          <h2 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            Document Intake
          </h2>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed border-white/10 bg-[var(--surface-2)] px-4 py-2 text-xs uppercase tracking-[0.08em] text-[var(--muted)] hover:border-[var(--accent)] hover:text-white">
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
          <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Document Name
          </label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <p className="text-xs text-[var(--muted)]">
            Markdown, text, or JSON. The pipeline extracts structure automatically.
          </p>
        </div>
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
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
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
          Output: data/documents/*
        </p>
        <Button onClick={submit} disabled={busy || content.trim().length === 0}>
          {busy ? 'Uploading...' : 'Lock Document'}
        </Button>
      </div>
    </Card>
  )
}
