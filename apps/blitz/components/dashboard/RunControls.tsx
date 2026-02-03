"use client"

import { useState } from "react"
import type { State, TaskWithStatus } from "@/lib/schema"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"

type RunControlsProps = {
  state: State
  tasks: TaskWithStatus[]
  onRefresh: () => void
}

export const RunControls = ({ state, tasks, onRefresh }: RunControlsProps) => {
  const [maxParallel, setMaxParallel] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const runId = state.current_run?.id
  const status = state.current_run?.status ?? "idle"
  const canStart = state.pipeline.stage === "tasks_approved" || status === "completed"

  const start = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_parallel: maxParallel }),
      })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed to start.")
    } finally {
      setBusy(false)
    }
  }

  const pause = async (): Promise<void> => {
    if (!runId) return
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/runs/${runId}/pause`, { method: "POST" })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed.")
    } finally {
      setBusy(false)
    }
  }

  const resume = async (): Promise<void> => {
    if (!runId) return
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/runs/${runId}/resume`, { method: "POST" })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume failed.")
    } finally {
      setBusy(false)
    }
  }

  const stop = async (): Promise<void> => {
    if (!runId) return
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/runs/${runId}/stop`, { method: "POST" })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stop failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">Stage 4</p>
          <h2 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            Execution Run
          </h2>
        </div>
        <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
          Status: {status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Ready Tasks" value={tasks.filter((task) => task.status === "ready").length} />
        <Stat
          label="In Progress"
          value={tasks.filter((task) => task.status === "in_progress").length}
        />
        <Stat
          label="Completed"
          value={tasks.filter((task) => task.status === "completed").length}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Max Parallel
          </label>
          <Input
            type="number"
            min={1}
            max={10}
            value={maxParallel}
            onChange={(event) => setMaxParallel(Number(event.target.value))}
          />
        </div>
        <div className="flex flex-wrap items-end justify-end gap-3">
          <Button variant="outline" onClick={start} disabled={busy || !canStart}>
            Start Run
          </Button>
          <Button variant="outline" onClick={pause} disabled={busy}>
            Pause
          </Button>
          <Button variant="outline" onClick={resume} disabled={busy}>
            Resume
          </Button>
          <Button variant="danger" onClick={stop} disabled={busy}>
            Stop
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </Card>
  )
}

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-[14px] border border-white/5 bg-[var(--surface-2)] p-4">
    <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
    <p className="mt-2 font-semibold text-2xl">{value}</p>
  </div>
)
