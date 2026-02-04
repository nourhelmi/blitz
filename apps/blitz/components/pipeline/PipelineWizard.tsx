"use client"

import { DocumentUpload } from "./DocumentUpload"
import { SpecEditor } from "./SpecEditor"
import { TaskReview } from "./TaskReview"
import { RunControls } from "@/components/dashboard/RunControls"
import { AgentLogs } from "@/components/dashboard/AgentLogs"
import { Card } from "@/components/ui/Card"
import { usePipelineData } from "./usePipelineData"

export const PipelineWizard = () => {
  const { data, refresh } = usePipelineData()

  if (data.loading) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--muted)]">
          Loading pipeline...
        </p>
      </Card>
    )
  }

  if (!data.state) {
    return (
      <Card>
        <p className="text-sm uppercase tracking-[0.12em] text-[var(--danger)]">
          Failed to load state.
        </p>
      </Card>
    )
  }

  const stage = data.state.pipeline.stage

  return (
    <div className="space-y-10">
      {data.error ? (
        <Card>
          <p className="text-sm text-[var(--danger)]">{data.error}</p>
        </Card>
      ) : null}
      <Card glow className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[var(--accent)] opacity-10 blur-3xl" />
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
            Pipeline Stage
          </p>
          <h1 className="font-semibold text-3xl uppercase tracking-[0.08em]">
            {stage.replace("_", " ")}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Orchestrate spec, tasks, and execution with human control at every handoff.
          </p>
        </div>
      </Card>

      <DocumentUpload onComplete={refresh} stage={data.state.pipeline.stage} />

      {data.spec ? <SpecEditor spec={data.spec} onRefresh={refresh} /> : null}

      {data.taskList && data.tasks ? (
        <TaskReview taskList={data.taskList} tasks={data.tasks} onRefresh={refresh} />
      ) : null}

      {data.tasks ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <RunControls state={data.state} tasks={data.tasks} onRefresh={refresh} />
          <AgentLogs tasks={data.tasks} />
        </div>
      ) : null}
    </div>
  )
}
