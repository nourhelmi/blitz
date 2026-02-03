"use client"

import { useParams } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { AgentLogs } from "@/components/dashboard/AgentLogs"
import { usePipelineData } from "@/components/pipeline/usePipelineData"
import { formatIso } from "@/lib/time"

export default function RunDetailPage() {
  const params = useParams<{ id: string }>()
  const { data } = usePipelineData()
  const run = data.state?.runs.find((item) => item.id === params.id)

  if (!run) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">Run not found.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h1 className="font-semibold text-2xl uppercase tracking-[0.06em]">
          Run {run.id.slice(0, 8)}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          <span>Started: {formatIso(run.started_at)}</span>
          <span>Status: {run.status}</span>
          <span>Max Parallel: {run.max_parallel}</span>
        </div>
      </Card>

      {data.tasks ? (
        <Card>
          <h2 className="mb-4 font-semibold text-lg uppercase tracking-[0.06em]">
            Task Status
          </h2>
          <div className="space-y-2">
            {data.tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-white/5 bg-[var(--surface-2)] px-4 py-2"
              >
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  {task.id}
                </span>
                <span className="text-sm text-white">{task.title}</span>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {data.tasks ? <AgentLogs tasks={data.tasks} /> : null}
    </div>
  )
}
