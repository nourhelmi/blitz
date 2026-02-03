"use client"

import { DependencyGraph } from "@/components/dashboard/DependencyGraph"
import { Card } from "@/components/ui/Card"
import { usePipelineData } from "@/components/pipeline/usePipelineData"

export default function GraphPage() {
  const { data } = usePipelineData()

  if (data.loading) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">Loading...</p>
      </Card>
    )
  }

  if (!data.tasks) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">
          No tasks available for graphing.
        </p>
      </Card>
    )
  }

  return <DependencyGraph tasks={data.tasks} />
}
