"use client"

import { useMemo, useState } from "react"
import type { State, TaskStatus, TaskWithStatus } from "@/lib/schema"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"

type RunControlsProps = {
  state: State
  tasks: TaskWithStatus[]
  onRefresh: () => void
}

// Status indicator styling for run states
const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  idle: { label: "Idle", color: "text-(--muted)", pulse: false },
  running: { label: "Running", color: "text-[var(--accent-3)]", pulse: true },
  paused: { label: "Paused", color: "text-[var(--accent-2)]", pulse: false },
  completed: { label: "Completed", color: "text-[var(--accent)]", pulse: false },
  failed: { label: "Failed", color: "text-[var(--danger)]", pulse: false },
}

export const RunControls = ({ state, tasks, onRefresh }: RunControlsProps) => {
  const [maxParallel, setMaxParallel] = useState(3)
  const [maxRetries, setMaxRetries] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const runId = state.current_run?.id
  const status = state.current_run?.status ?? "idle"
  const canStart = state.pipeline.stage === "tasks_approved" || status === "completed"
  const isRunning = status === "running"
  const isPaused = status === "paused"

  const statusConfig = RUN_STATUS_CONFIG[status] ?? RUN_STATUS_CONFIG.idle

  // Compute stats
  const stats = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      pending: 0,
      blocked: 0,
      ready: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    }
    tasks.forEach((t) => counts[t.status]++)
    const progress = tasks.length > 0 ? Math.round((counts.completed / tasks.length) * 100) : 0
    return { ...counts, total: tasks.length, progress }
  }, [tasks])

  const start = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_parallel: maxParallel, max_retries: maxRetries }),
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
    <Card className="space-y-5">
      {/* Header with status indicator */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-(--muted)">Stage 4</p>
          <h2 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            Execution
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 ${statusConfig.pulse ? "animate-pulse" : ""}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${
              status === "running" ? "bg-(--accent-3)" :
              status === "paused" ? "bg-(--accent-2)" :
              status === "completed" ? "bg-(--accent)" :
              status === "failed" ? "bg-(--danger)" : "bg-(--muted)"
            }`} />
            <span className={`text-xs uppercase tracking-[0.12em] font-semibold ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          {runId && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-(--muted)">
              {runId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">Progress</span>
          <span className="font-mono text-sm font-semibold text-white">{stats.progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-linear-to-r from-(--accent-3) to-(--accent) transition-all duration-500"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="Queue" value={stats.pending + stats.blocked} sub={`${stats.ready} ready`} />
        <StatBlock
          label="Active"
          value={stats.in_progress}
          accent="text-[var(--accent-3)]"
          pulse={stats.in_progress > 0}
        />
        <StatBlock label="Done" value={stats.completed} accent="text-[var(--accent)]" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-2 border-t border-white/5">
        <div className="flex gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">
              Parallelism
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxParallel}
              onChange={(event) => setMaxParallel(Number(event.target.value))}
              className="w-20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">
              Max Retries
            </label>
            <Input
              type="number"
              min={0}
              max={10}
              value={maxRetries}
              onChange={(event) => setMaxRetries(Number(event.target.value))}
              className="w-20"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isRunning && !isPaused && (
            <Button onClick={start} disabled={busy || !canStart}>
              {canStart ? "Start Run" : "Approve Tasks First"}
            </Button>
          )}
          {isRunning && (
            <Button variant="outline" onClick={pause} disabled={busy}>
              Pause
            </Button>
          )}
          {isPaused && (
            <Button onClick={resume} disabled={busy}>
              Resume
            </Button>
          )}
          {(isRunning || isPaused) && (
            <Button variant="danger" onClick={stop} disabled={busy}>
              Stop
            </Button>
          )}
        </div>
      </div>

      {stats.failed > 0 && (
        <div className="rounded-lg border border-(--danger)/30 bg-(--danger)/10 p-3 space-y-1">
          <p className="text-xs uppercase tracking-widest text-(--danger)">
            {stats.failed} task{stats.failed > 1 ? "s" : ""} failed
          </p>
          {state.current_run?.task_runs
            .filter((tr) => tr.status === "failed")
            .map((tr) => (
              <p key={tr.task_id} className="font-mono text-[10px] text-(--danger)/70">
                {tr.task_id}: {tr.error ?? "Unknown error"} (attempt {tr.attempt ?? 1})
              </p>
            ))}
        </div>
      )}

      {error && <p className="text-sm text-(--danger)">{error}</p>}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Block — compact metric display
// ─────────────────────────────────────────────────────────────────────────────

type StatBlockProps = {
  label: string
  value: number
  sub?: string
  accent?: string
  pulse?: boolean
}

const StatBlock = ({ label, value, sub, accent = "text-white", pulse = false }: StatBlockProps) => (
  <div className="rounded-lg border border-white/5 bg-(--surface-2) p-3">
    <p className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">{label}</p>
    <p className={`mt-1 font-mono text-xl font-semibold ${accent} ${pulse ? "animate-pulse" : ""}`}>
      {value}
    </p>
    {sub && <p className="mt-0.5 text-[10px] text-(--muted)">{sub}</p>}
  </div>
)
