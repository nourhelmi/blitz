"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import type { TaskStatus, TaskWithStatus } from "@/lib/schema"
import { Card } from "@/components/ui/Card"

type AgentLogsProps = {
  tasks: TaskWithStatus[]
}

// Status colors for tab indicators
const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  pending: "bg-(--muted)",
  blocked: "bg-[#f7b955]",
  ready: "bg-[#8dff9e]",
  in_progress: "bg-(--accent-3)",
  completed: "bg-(--accent)",
  failed: "bg-(--danger)",
}

type TaskError = Record<string, string>

export const AgentLogs = ({ tasks }: AgentLogsProps) => {
  // Only store the user's explicit tab selection; auto-selection is derived.
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [log, setLog] = useState("")
  const [autoScroll, setAutoScroll] = useState(true)
  const [taskErrors, setTaskErrors] = useState<TaskError>({})
  const logRef = useRef<HTMLDivElement>(null)

  // Fetch task errors from run state
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const response = await fetch("/api/runs")
        const payload = (await response.json()) as { current_run?: { task_runs?: Array<{ task_id: string; error?: string }> } }
        const errors: TaskError = {}
        payload.current_run?.task_runs?.forEach((tr) => {
          if (tr.error) errors[tr.task_id] = tr.error
        })
        setTaskErrors(errors)
      } catch {
        // Ignore fetch errors
      }
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const getTaskError = (taskId: string): string =>
    taskErrors[taskId] ?? "Unknown error"

  // Filter to tasks that have activity (not pending)
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "pending" && t.status !== "blocked"),
    [tasks]
  )

  // Derive active task: user selection > running task > first active.
  // Pure computation — no effect, no cascading setState.
  const activeTask = useMemo(() => {
    const selected = selectedId ? tasks.find((t) => t.id === selectedId) : undefined
    if (selected) return selected
    const running = tasks.find((t) => t.status === "in_progress")
    if (running) return running
    return activeTasks[0]
  }, [selectedId, tasks, activeTasks])

  // Poll for logs
  useEffect(() => {
    if (!activeTask) return
    const load = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/logs/${activeTask.id}`)
        const payload = (await response.json()) as { log?: string }
        setLog(payload.log ?? "")
      } catch {
        // Ignore fetch errors during polling
      }
    }
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [activeTask])

  // Auto-scroll to bottom when log updates
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log, autoScroll])

  const handleScroll = (): void => {
    if (!logRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logRef.current
    // If user scrolled up, disable auto-scroll; if at bottom, enable
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }

  const activeTaskData = activeTask ? tasks.find((t) => t.id === activeTask.id) : undefined

  return (
    <Card className="space-y-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg uppercase tracking-[0.06em]">
            Agent Logs
          </h3>
          {activeTaskData?.status === "in_progress" && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-(--accent-3) animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-(--accent-3)">Live</span>
            </span>
          )}
        </div>
        {activeTask && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-(--muted)">
            {activeTask.id}
          </span>
        )}
      </div>

      {/* Task tabs */}
      {activeTasks.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {activeTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => setSelectedId(task.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-widest transition-all ${
                activeTask?.id === task.id
                  ? "border-(--accent) bg-(--accent)/10 text-white shadow-[0_0_8px_rgba(183,255,42,0.2)]"
                  : "border-white/10 text-(--muted) hover:border-white/20 hover:text-white"
              }`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[task.status]} ${
                task.status === "in_progress" ? "animate-pulse" : ""
              }`} />
              {task.id}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[10px] uppercase tracking-widest text-(--muted)">
          No active tasks yet
        </p>
      )}

      {/* Error banner for failed tasks */}
      {activeTaskData?.status === "failed" && (
        <div className="rounded-lg border border-(--danger)/30 bg-(--danger)/10 p-3 space-y-1">
          <p className="text-xs uppercase tracking-widest text-(--danger) font-semibold">
            Task Failed
          </p>
          <p className="font-mono text-[11px] text-(--danger)/80 whitespace-pre-wrap">
            {getTaskError(activeTaskData.id)}
          </p>
        </div>
      )}

      {/* Log output */}
      <div
        ref={logRef}
        onScroll={handleScroll}
        className="flex-1 min-h-[280px] max-h-[400px] overflow-auto rounded-lg border border-white/10 bg-[rgba(6,8,12,0.9)] p-4 font-mono text-[11px] leading-relaxed"
      >
        {log ? (
          <pre className="whitespace-pre-wrap text-(--muted)">{log}</pre>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">
              {activeTask ? "Waiting for output..." : "Select a task to view logs"}
            </p>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between text-[10px] text-(--muted)">
        <span className="uppercase tracking-widest">
          {log.split("\n").length} lines
        </span>
        <button
          onClick={() => {
            setAutoScroll(true)
            if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
          }}
          className={`uppercase tracking-widest transition-colors ${
            autoScroll ? "text-(--accent)" : "hover:text-white"
          }`}
        >
          {autoScroll ? "Auto-scroll on" : "Jump to bottom"}
        </button>
      </div>
    </Card>
  )
}
