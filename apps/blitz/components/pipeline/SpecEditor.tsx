"use client"

import { useEffect, useMemo, useState } from "react"
import type { Spec } from "@/lib/schema"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"

type SpecEditorProps = {
  spec: Spec
  onRefresh: () => void
}

type Mode = "visual" | "json"

export const SpecEditor = ({ spec, onRefresh }: SpecEditorProps) => {
  const [mode, setMode] = useState<Mode>("visual")
  const [draft, setDraft] = useState<Spec>(spec)
  const [guidance, setGuidance] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const jsonValue = useMemo(() => JSON.stringify(draft, null, 2), [draft])
  const [jsonDraft, setJsonDraft] = useState(jsonValue)

  useEffect(() => {
    setDraft(spec)
  }, [spec])

  useEffect(() => {
    if (mode === "json") setJsonDraft(jsonValue)
  }, [jsonValue, mode])

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/spec", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spec update failed.")
    } finally {
      setBusy(false)
    }
  }

  const approve = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/spec/approve", { method: "POST" })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spec approval failed.")
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidance }),
      })
      if (!response.ok) throw new Error(await response.text())
      setGuidance("")
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed.")
    } finally {
      setBusy(false)
    }
  }

  const updateList =
    (key: "goals" | "constraints" | "conventions") =>
    (items: string[]): void => {
      setDraft({ ...draft, [key]: items })
    }

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">Stage 2</p>
          <h2 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            Spec Review
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={mode === "visual" ? "solid" : "ghost"}
            size="sm"
            onClick={() => setMode("visual")}
          >
            Visual
          </Button>
          <Button
            variant={mode === "json" ? "solid" : "ghost"}
            size="sm"
            onClick={() => setMode("json")}
          >
            JSON
          </Button>
        </div>
      </div>

      {mode === "visual" ? (
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Project
              </label>
              <Input
                value={draft.project}
                onChange={(event) => setDraft({ ...draft, project: event.target.value })}
              />
            </div>
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Version
              </label>
              <Input
                value={draft.version}
                onChange={(event) => setDraft({ ...draft, version: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Summary</label>
            <Textarea
              value={draft.summary}
              onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            />
          </div>

          <ListEditor title="Goals" items={draft.goals} onChange={updateList("goals")} />
          <ListEditor
            title="Constraints"
            items={draft.constraints ?? []}
            onChange={updateList("constraints")}
          />
          <ListEditor
            title="Conventions"
            items={draft.conventions ?? []}
            onChange={updateList("conventions")}
          />
        </div>
      ) : (
        <Textarea
          className="min-h-[340px] font-mono text-xs"
          value={jsonDraft}
          onChange={(event) => {
            const nextValue = event.target.value
            setJsonDraft(nextValue)
            try {
              const parsed = JSON.parse(nextValue) as Spec
              setDraft(parsed)
              setError(undefined)
            } catch (err) {
              setError(err instanceof Error ? err.message : "Invalid JSON.")
            }
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Regeneration Guidance
          </label>
          <Input
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            placeholder="Tighten scope, enforce constraints, rename phases..."
          />
        </div>
        <div className="flex flex-wrap items-end justify-end gap-3">
          <Button variant="outline" onClick={regenerate} disabled={busy}>
            Regenerate
          </Button>
          <Button variant="outline" onClick={save} disabled={busy}>
            Save
          </Button>
          <Button onClick={approve} disabled={busy}>
            Approve
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </Card>
  )
}

type ListEditorProps = {
  title: string
  items: string[]
  onChange: (items: string[]) => void
}

const ListEditor = ({ title, items, onChange }: ListEditorProps) => (
  <div className="space-y-3">
    <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{title}</label>
    <div className="space-y-3">
      {items.map((item, index) => (
        <Input
          key={`${title}-${index}`}
          value={item}
          onChange={(event) => {
            const next = [...items]
            next[index] = event.target.value
            onChange(next)
          }}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange([...items, ""])}
      >
        Add {title}
      </Button>
    </div>
  </div>
)
