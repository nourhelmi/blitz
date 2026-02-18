'use client'

import { useState } from 'react'
import type { ClarificationList } from '@/lib/schema'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

type ClarificationReviewProps = {
  clarificationList: ClarificationList
  onRefresh: () => void
}

export const ClarificationReview = ({
  clarificationList,
  onRefresh,
}: ClarificationReviewProps) => {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    clarificationList.clarifications.forEach((c) => {
      initial[c.id] = c.answer ?? c.assumption ?? ''
    })
    return initial
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const updateAnswer = (id: string, value: string): void => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const acceptAllDefaults = (): void => {
    const defaults: Record<string, string> = {}
    clarificationList.clarifications.forEach((c) => {
      defaults[c.id] = c.assumption ?? ''
    })
    setAnswers(defaults)
  }

  const saveAndApprove = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      // Save answers
      const patchResponse = await fetch('/api/clarify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!patchResponse.ok) throw new Error(await patchResponse.text())

      // Approve
      const approveResponse = await fetch('/api/clarify/approve', {
        method: 'POST',
      })
      if (!approveResponse.ok) throw new Error(await approveResponse.text())

      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve.')
    } finally {
      setBusy(false)
    }
  }

  const generateSpec = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      // Save answers first
      const patchResponse = await fetch('/api/clarify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!patchResponse.ok) throw new Error(await patchResponse.text())

      // Approve clarifications
      const approveResponse = await fetch('/api/clarify/approve', {
        method: 'POST',
      })
      if (!approveResponse.ok) throw new Error(await approveResponse.text())

      // Generate spec
      const specResponse = await fetch('/api/generate-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!specResponse.ok) throw new Error(await specResponse.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate spec.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
            Stage 1.5
          </p>
          <h2 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            Clarifying Questions
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            Answer these questions to improve spec quality. Defaults are pre-filled.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={acceptAllDefaults}>
          Accept All Defaults
        </Button>
      </div>

      <div className="space-y-4">
        {clarificationList.clarifications.map((c, index) => (
          <div
            key={c.id}
            className="rounded-lg border border-white/5 bg-[var(--surface-2)] p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold">
                {index + 1}
              </span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-white">{c.question}</p>
                <p className="text-xs text-[var(--muted)]">{c.context}</p>
              </div>
            </div>

            {c.options && c.options.length > 0 ? (
              <div className="flex flex-wrap gap-2 pl-9">
                {c.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => updateAnswer(c.id, option)}
                    className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition-all ${
                      answers[c.id] === option
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-white'
                        : 'border-white/10 text-[var(--muted)] hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="pl-9">
              <Input
                value={answers[c.id] ?? ''}
                onChange={(e) => updateAnswer(c.id, e.target.value)}
                placeholder={c.assumption ?? 'Type your answer...'}
                className="text-xs"
              />
              {c.assumption && answers[c.id] !== c.assumption && (
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Default: {c.assumption}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
        <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
          {clarificationList.clarifications.length} questions
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={saveAndApprove} disabled={busy}>
            {busy ? 'Saving...' : 'Save Answers'}
          </Button>
          <Button onClick={generateSpec} disabled={busy}>
            {busy ? 'Generating...' : 'Approve & Generate Spec'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
