"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { Task, TaskList, TaskWithStatus } from "@/lib/schema"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { StatusBadge } from "@/components/ui/StatusBadge"

type TaskReviewProps = {
  taskList: TaskList
  tasks: TaskWithStatus[]
  onRefresh: () => void
}

export const TaskReview = ({ taskList, tasks, onRefresh }: TaskReviewProps) => {
  const [guidance, setGuidance] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const grouped = useMemo(() => {
    return tasks.reduce<Record<string, TaskWithStatus[]>>((acc, task) => {
      const key = task.phase && task.phase.trim().length > 0 ? task.phase : "Unphased"
      acc[key] = acc[key] ? [...acc[key], task] : [task]
      return acc
    }, {})
  }, [tasks])

  const regenerate = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidance }),
      })
      if (!response.ok) throw new Error(await response.text())
      setGuidance("")
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed.")
    } finally {
      setBusy(false)
    }
  }

  const approve = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/tasks/approve", { method: "POST" })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">Stage 3</p>
          <h2 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            Task Review
          </h2>
          <p className="text-xs text-[var(--muted)]">{taskList.tasks.length} tasks</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={regenerate} disabled={busy}>
            Regenerate
          </Button>
          <Button onClick={approve} disabled={busy}>
            Approve
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {Object.entries(grouped).map(([phase, phaseTasks]) => (
          <div key={phase} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg uppercase tracking-[0.08em] text-white">
                {phase}
              </h3>
              <span className="text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
                {phaseTasks.length} tasks
              </span>
            </div>
            <div className="grid gap-4">
              {phaseTasks.map((task) => (
                <TaskCard key={task.id} task={task} onRefresh={onRefresh} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <NewTaskForm onRefresh={onRefresh} />

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Regeneration Guidance
          </label>
          <Input
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            placeholder="Split tasks, add infra, change priorities..."
          />
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </Card>
  )
}

const TaskCard = ({ task, onRefresh }: { task: TaskWithStatus; onRefresh: () => void }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Task>(task)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (!editing) setDraft(task)
  }, [editing, task])

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      if (!response.ok) throw new Error(await response.text())
      setEditing(false)
      setError(undefined)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-white/5 bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              {task.id}
            </p>
            <StatusBadge status={task.status} />
          </div>
          {editing ? (
            <Input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          ) : (
            <h4 className="font-semibold text-lg uppercase tracking-[0.06em]">
              {task.title}
            </h4>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
        {editing ? (
          <Textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        ) : (
          <p>{task.description}</p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Phase">
            {editing ? (
              <Input
                value={draft.phase ?? ""}
                onChange={(event) => setDraft({ ...draft, phase: event.target.value })}
              />
            ) : (
            <span>
              {task.phase && task.phase.trim().length > 0 ? task.phase : "Unphased"}
            </span>
            )}
          </Field>
          <Field label="Priority">
            {editing ? (
              <Input
                type="number"
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })}
              />
            ) : (
              <span>{task.priority}</span>
            )}
          </Field>
        </div>

        <Field label="Blocked By">
          {editing ? (
            <Input
              value={draft.blocked_by.join(", ")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  blocked_by: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          ) : (
            <span>{task.blocked_by.length ? task.blocked_by.join(", ") : "None"}</span>
          )}
        </Field>

        <Field label="Acceptance">
          {editing ? (
            <Textarea
              value={draft.acceptance.join("\n")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  acceptance: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          ) : (
            <ul className="list-disc pl-5">
              {task.acceptance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </Field>

        {editing ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={save} disabled={busy}>
              {busy ? "Saving..." : "Save Task"}
            </Button>
          </div>
        ) : null}
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      </div>
    </div>
  )
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-2">
    <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
    <div className="text-sm text-white">{children}</div>
  </div>
)

const NewTaskForm = ({ onRefresh }: { onRefresh: () => void }) => {
  const [draft, setDraft] = useState<Task>({
    id: "",
    title: "",
    description: "",
    category: "functional",
    blocked_by: [],
    acceptance: [],
    priority: 0,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const payload = {
        ...draft,
        blocked_by: draft.blocked_by.filter(Boolean),
        acceptance: draft.acceptance.filter(Boolean),
      }
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await response.text())
      setDraft({
        id: "",
        title: "",
        description: "",
        category: "functional",
        blocked_by: [],
        acceptance: [],
        priority: 0,
      })
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add task failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-white/5 bg-[rgba(18,25,39,0.7)] p-5">
      <h4 className="font-semibold text-lg uppercase tracking-[0.06em]">
        Add Task
      </h4>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Input
          placeholder="Task ID"
          value={draft.id}
          onChange={(event) => setDraft({ ...draft, id: event.target.value })}
        />
        <Input
          placeholder="Title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <Textarea
          className="md:col-span-2"
          placeholder="Description"
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
        <Textarea
          placeholder="Acceptance criteria (one per line)"
          value={draft.acceptance.join("\n")}
          onChange={(event) =>
            setDraft({
              ...draft,
              acceptance: event.target.value.split("\n").map((item) => item.trim()),
            })
          }
        />
        <Input
          placeholder="Blocked by (comma separated)"
          value={draft.blocked_by.join(", ")}
          onChange={(event) =>
            setDraft({
              ...draft,
              blocked_by: event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={create} disabled={busy}>
          {busy ? "Adding..." : "Add Task"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
