"use client"

import { useEffect, useMemo, useState } from "react"
import type { TaskWithStatus } from "@/lib/schema"
import { Card } from "@/components/ui/Card"
import { cx } from "@/lib/cx"

type AgentLogsProps = {
  tasks: TaskWithStatus[]
}

export const AgentLogs = ({ tasks }: AgentLogsProps) => {
  const [activeTask, setActiveTask] = useState<TaskWithStatus | undefined>(tasks[0])
  const [log, setLog] = useState("")

  const tabs = useMemo(() => tasks.filter((task) => task.status !== "pending"), [tasks])

  useEffect(() => {
    if (!activeTask && tasks.length > 0) setActiveTask(tasks[0])
    if (activeTask && !tasks.find((task) => task.id === activeTask.id)) {
      setActiveTask(tasks[0])
    }
  }, [activeTask, tasks])

  useEffect(() => {
    if (!activeTask) return
    const load = async (): Promise<void> => {
      const response = await fetch(`/api/logs/${activeTask.id}`)
      const payload = (await response.json()) as { log?: string }
      setLog(payload.log ?? "")
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [activeTask])

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg uppercase tracking-[0.06em]">
          Live Logs
        </h3>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
          {activeTask ? `Task ${activeTask.id}` : "No task selected"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((task) => (
          <button
            key={task.id}
            className={cx(
              "rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] transition-colors hover:text-white",
              activeTask?.id === task.id
                ? "border-[var(--accent)] text-white"
                : "border-white/10"
            )}
            onClick={() => setActiveTask(task)}
          >
            {task.id}
          </button>
        ))}
      </div>

      <div className="max-h-[360px] overflow-auto rounded-[14px] border border-white/10 bg-black/60 p-4 font-mono text-xs text-[var(--muted)]">
        {log ? (
          <pre className="whitespace-pre-wrap">{log}</pre>
        ) : (
          <p className="text-[var(--muted)]">No log output yet.</p>
        )}
      </div>
    </Card>
  )
}
