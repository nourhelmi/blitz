"use client"

import { useParams } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { usePipelineData } from "@/components/pipeline/usePipelineData"

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>()
  const { data } = usePipelineData()
  const task = data.tasks?.find((item) => item.id === params.id)

  if (!task) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">
          Task not found.
        </p>
      </Card>
    )
  }

  return (
    <Card className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{task.id}</p>
          <h1 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            {task.title}
          </h1>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <p className="text-sm text-[var(--muted)]">{task.description}</p>

      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Acceptance</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white">
          {task.acceptance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
