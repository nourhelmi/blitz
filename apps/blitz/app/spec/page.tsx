"use client"

import { SpecEditor } from "@/components/pipeline/SpecEditor"
import { Card } from "@/components/ui/Card"
import { usePipelineData } from "@/components/pipeline/usePipelineData"

export default function SpecPage() {
  const { data, refresh } = usePipelineData()

  if (data.loading) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">Loading...</p>
      </Card>
    )
  }

  if (!data.spec) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">
          No spec available yet.
        </p>
      </Card>
    )
  }

  return <SpecEditor spec={data.spec} onRefresh={refresh} />
}
