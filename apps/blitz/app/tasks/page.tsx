"use client"

import { TaskReview } from "@/components/pipeline/TaskReview"
import { Card } from "@/components/ui/Card"
import { usePipelineData } from "@/components/pipeline/usePipelineData"

export default function TasksPage() {
  const { data, refresh } = usePipelineData()

  if (data.loading) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">Loading...</p>
      </Card>
    )
  }

  if (!data.taskList || !data.tasks) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">
          No tasks generated yet.
        </p>
      </Card>
    )
  }

  return <TaskReview taskList={data.taskList} tasks={data.tasks} onRefresh={refresh} />
}
