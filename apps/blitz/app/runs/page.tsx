"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { usePipelineData } from "@/components/pipeline/usePipelineData"
import { formatIso } from "@/lib/time"

export default function RunsPage() {
  const { data } = usePipelineData()
  const runs = useMemo(() => data.state?.runs ?? [], [data.state?.runs])

  if (data.loading) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">Loading...</p>
      </Card>
    )
  }

  return (
    <Card className="space-y-4">
      <h1 className="font-semibold text-2xl uppercase tracking-[0.06em]">
        Run History
      </h1>
      <div className="space-y-3">
        {runs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No runs yet.</p>
        ) : (
          runs.map((run) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-white/5 bg-[var(--surface-2)] px-4 py-3 text-sm text-white hover:border-[var(--accent)]"
            >
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                {run.id.slice(0, 8)}
              </span>
              <span>{formatIso(run.started_at)}</span>
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                {run.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </Card>
  )
}
