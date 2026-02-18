"use client"

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react"
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type Edge,
  type Node,
  type Connection,
} from "@xyflow/react"
import type { Task, TaskList, TaskStatus, TaskWithStatus } from "@/lib/schema"
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

type Mode = "board" | "graph" | "json"

// Status lanes for board view — ordered by workflow progression
const STATUS_LANES: Array<{ status: TaskStatus; label: string; accent: string }> = [
  { status: "pending", label: "Pending", accent: "text-(--muted)" },
  { status: "blocked", label: "Blocked", accent: "text-[#f7b955]" },
  { status: "ready", label: "Ready", accent: "text-[#8dff9e]" },
  { status: "in_progress", label: "In Progress", accent: "text-[var(--accent-3)]" },
  { status: "completed", label: "Completed", accent: "text-[var(--accent)]" },
  { status: "failed", label: "Failed", accent: "text-[var(--danger)]" },
]

export const TaskReview = ({ taskList, tasks, onRefresh }: TaskReviewProps) => {
  const [mode, setMode] = useState<Mode>("board")
  const [guidance, setGuidance] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [selectedTask, setSelectedTask] = useState<TaskWithStatus | undefined>()

  // Group tasks by status for board lanes
  const byStatus = useMemo(() => {
    return tasks.reduce<Record<TaskStatus, TaskWithStatus[]>>(
      (acc, task) => {
        acc[task.status] = [...(acc[task.status] ?? []), task]
        return acc
      },
      { pending: [], blocked: [], ready: [], in_progress: [], completed: [], failed: [] }
    )
  }, [tasks])

  // Stats for header
  const stats = useMemo(() => ({
    total: tasks.length,
    pending: byStatus.pending.length + byStatus.blocked.length,
    ready: byStatus.ready.length,
    active: byStatus.in_progress.length,
    done: byStatus.completed.length,
    failed: byStatus.failed.length,
  }), [tasks.length, byStatus])

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

  const jsonValue = useMemo(() => JSON.stringify(taskList.tasks, null, 2), [taskList.tasks])

  return (
    <Card className="space-y-6">
      {/* Header with stats and controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-(--muted)">Stage 3</p>
          <h2 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            Task Review
          </h2>
          <div className="mt-2 flex flex-wrap gap-3">
            <StatChip label="Total" value={stats.total} />
            <StatChip label="Queue" value={stats.pending} tone="text-(--muted)" />
            <StatChip label="Ready" value={stats.ready} tone="text-[#8dff9e]" />
            <StatChip label="Active" value={stats.active} tone="text-[var(--accent-3)]" pulse={stats.active > 0} />
            <StatChip label="Done" value={stats.done} tone="text-[var(--accent)]" />
            {stats.failed > 0 && <StatChip label="Failed" value={stats.failed} tone="text-[var(--danger)]" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            <ModeButton active={mode === "board"} onClick={() => setMode("board")}>Board</ModeButton>
            <ModeButton active={mode === "graph"} onClick={() => setMode("graph")}>Graph</ModeButton>
            <ModeButton active={mode === "json"} onClick={() => setMode("json")}>JSON</ModeButton>
          </div>
        </div>
      </div>

      {/* Main content area */}
      {mode === "board" ? (
        <div className="rounded-(--radius) border border-white/5 bg-[rgba(10,14,20,0.7)] p-3">
          <div className="grid-surface rounded-(--radius) p-3">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STATUS_LANES.map((lane) => (
                <StatusLane
                  key={lane.status}
                  status={lane.status}
                  label={lane.label}
                  accent={lane.accent}
                  tasks={byStatus[lane.status]}
                  onSelect={setSelectedTask}
                  selectedId={selectedTask?.id}
                />
              ))}
            </div>
          </div>
        </div>
      ) : mode === "graph" ? (
        <TaskGraph tasks={tasks} onSelect={setSelectedTask} selectedId={selectedTask?.id} />
      ) : (
        <div className="rounded-(--radius) border border-white/5 bg-[rgba(10,14,20,0.7)] p-4">
          <pre className="max-h-[500px] overflow-auto font-mono text-xs text-(--muted) whitespace-pre-wrap">
            {jsonValue}
          </pre>
        </div>
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(undefined)}
          onRefresh={onRefresh}
        />
      )}

      {/* Add task + regeneration controls */}
      <div className="grid gap-4 lg:grid-cols-2">
        <NewTaskForm onRefresh={onRefresh} />
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.12em] text-(--muted)">
              Regeneration Guidance
            </label>
            <Input
              value={guidance}
              onChange={(event) => setGuidance(event.target.value)}
              placeholder="Split tasks, add infra, change priorities..."
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={regenerate} disabled={busy}>
              Regenerate
            </Button>
            <Button onClick={approve} disabled={busy}>
              Approve Tasks
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-(--danger)">{error}</p> : undefined}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Chip — compact metric display
// ─────────────────────────────────────────────────────────────────────────────

type StatChipProps = {
  label: string
  value: number
  tone?: string
  pulse?: boolean
}

const StatChip = ({ label, value, tone = "text-white", pulse = false }: StatChipProps) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] uppercase tracking-[0.14em] text-(--muted)">{label}</span>
    <span
      className={`font-mono text-sm font-semibold ${tone} ${pulse ? "animate-pulse" : ""}`}
    >
      {value}
    </span>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Mode Button — toggle for board/graph/json
// ─────────────────────────────────────────────────────────────────────────────

type ModeButtonProps = {
  active: boolean
  onClick: () => void
  children: ReactNode
}

const ModeButton = ({ active, onClick, children }: ModeButtonProps) => (
  <button
    onClick={onClick}
    className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-all ${
      active
        ? "bg-(--accent) text-black font-semibold shadow-[0_0_12px_rgba(183,255,42,0.4)]"
        : "text-(--muted) hover:text-white"
    }`}
  >
    {children}
  </button>
)

// ─────────────────────────────────────────────────────────────────────────────
// Status Lane — board column for a specific status
// ─────────────────────────────────────────────────────────────────────────────

type StatusLaneProps = {
  status: TaskStatus
  label: string
  accent: string
  tasks: TaskWithStatus[]
  onSelect: (task: TaskWithStatus) => void
  selectedId?: string
}

const StatusLane = ({ label, accent, tasks, onSelect, selectedId }: StatusLaneProps) => (
  <div className="min-w-[200px] max-w-[240px] flex-1">
    <div className="rounded-(--radius) border border-white/10 bg-[rgba(14,18,28,0.85)] p-3 shadow-[0_16px_36px_rgba(6,9,16,0.5)]">
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[11px] uppercase tracking-[0.14em] font-semibold ${accent}`}>
          {label}
        </p>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-(--muted)">
          {tasks.length}
        </span>
      </div>
      <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskMiniCard
              key={task.id}
              task={task}
              onClick={() => onSelect(task)}
              selected={selectedId === task.id}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/2 p-3">
            <p className="text-[10px] uppercase tracking-widest text-(--muted)">Empty</p>
          </div>
        )}
      </div>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Task Mini Card — compact card for board lanes
// ─────────────────────────────────────────────────────────────────────────────

type TaskMiniCardProps = {
  task: TaskWithStatus
  onClick: () => void
  selected: boolean
}

const TaskMiniCard = ({ task, onClick, selected }: TaskMiniCardProps) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-lg border p-3 transition-all hover:border-(--accent)/50 ${
      selected
        ? "border-(--accent) bg-(--accent)/10 shadow-[0_0_12px_rgba(183,255,42,0.15)]"
        : "border-white/10 bg-(--surface)"
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-(--muted)">
        {task.id}
      </span>
      {task.priority > 0 && (
        <span className="text-[9px] uppercase tracking-[0.08em] text-(--accent-2)">
          P{task.priority}
        </span>
      )}
    </div>
    <p className="mt-1.5 text-xs font-medium text-white line-clamp-2">{task.title}</p>
    {task.blocked_by.length > 0 && (
      <p className="mt-1.5 text-[10px] text-(--muted)">
        Blocked by {task.blocked_by.length}
      </p>
    )}
  </button>
)

// ─────────────────────────────────────────────────────────────────────────────
// Task Detail Panel — expanded view for editing
// ─────────────────────────────────────────────────────────────────────────────

type TaskDetailPanelProps = {
  task: TaskWithStatus
  onClose: () => void
  onRefresh: () => void
}

const TaskDetailPanel = ({ task, onClose, onRefresh }: TaskDetailPanelProps) => {
  const [draft, setDraft] = useState<Task>(task)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    setDraft(task)
  }, [task])

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-(--radius) border border-(--accent)/30 bg-[rgba(18,25,39,0.95)] p-5 shadow-[0_0_24px_rgba(183,255,42,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.08em] text-(--muted)">
            {task.id}
          </span>
          <StatusBadge status={task.status} />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">Title</label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">Description</label>
          <Textarea
            className="min-h-[100px]"
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">Phase</label>
            <Input
              value={draft.phase ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, phase: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">Priority</label>
            <Input
              type="number"
              value={draft.priority}
              onChange={(e) => setDraft((prev) => ({ ...prev, priority: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">Category</label>
            <Input value={draft.category} disabled />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">
            Blocked By (comma separated)
          </label>
          <Input
            value={draft.blocked_by.join(", ")}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                blocked_by: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.12em] text-(--muted)">
            Acceptance Criteria (one per line)
          </label>
          <Textarea
            className="min-h-[80px]"
            value={draft.acceptance.join("\n")}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                acceptance: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              }))
            }
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save Changes"}
          </Button>
        </div>
        {error && <p className="text-xs text-(--danger)">{error}</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Graph — dependency DAG visualization
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "#7b8496",
  blocked: "#f7b955",
  ready: "#8dff9e",
  in_progress: "#5ad2ff",
  completed: "#b7ff2a",
  failed: "#ff7a90",
}

type TaskGraphProps = {
  tasks: TaskWithStatus[]
  onSelect: (task: TaskWithStatus) => void
  selectedId?: string
}

const TaskGraph = ({ tasks, onSelect, selectedId }: TaskGraphProps) => {
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const initialNodes = useMemo((): Node[] => {
    const columns = 4
    return tasks.map((task, index) => ({
      id: task.id,
      position: { x: (index % columns) * 280, y: Math.floor(index / columns) * 140 },
      data: { label: `${task.id}\n${task.title}`, task },
      style: {
        border: `2px solid ${STATUS_COLORS[task.status]}`,
        background: selectedId === task.id ? "rgba(183,255,42,0.15)" : "rgba(18,25,39,0.95)",
        color: "white",
        padding: "12px 16px",
        borderRadius: "12px",
        width: 240,
        fontSize: "11px",
        fontWeight: 500,
        cursor: "pointer",
      },
    }))
  }, [tasks, selectedId])

  const initialEdges = useMemo((): Edge[] => {
    const taskIds = new Set(tasks.map((t) => t.id))
    return tasks.flatMap((task) =>
      task.blocked_by
        .filter((dep) => taskIds.has(dep))
        .map((dep) => ({
          id: `${dep}->${task.id}`,
          source: dep,
          target: task.id,
          animated: task.status === "in_progress",
          style: { stroke: "#3b4d6b", strokeWidth: 2 },
          markerEnd: { type: "arrowclosed" as const, color: STATUS_COLORS[task.status] },
        }))
    )
  }, [tasks])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const task = taskMap.get(node.id)
      if (task) onSelect(task)
    },
    [taskMap, onSelect]
  )

  if (tasks.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-(--radius) border border-dashed border-white/15 bg-[rgba(10,14,20,0.7)]">
        <p className="text-sm uppercase tracking-[0.12em] text-(--muted)">No tasks to visualize</p>
      </div>
    )
  }

  return (
    <div className="h-[450px] w-full overflow-hidden rounded-(--radius) border border-white/5 bg-[rgba(10,14,20,0.8)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const task = taskMap.get(node.id)
            return task ? STATUS_COLORS[task.status] : "#3b4d6b"
          }}
          style={{ background: "rgba(12,16,24,0.95)" }}
        />
        <Controls />
        <Background gap={24} color="#1a2436" />
      </ReactFlow>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// New Task Form — compact inline form
// ─────────────────────────────────────────────────────────────────────────────

const NewTaskForm = ({ onRefresh }: { onRefresh: () => void }) => {
  const [expanded, setExpanded] = useState(false)
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
      setExpanded(false)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add task failed.")
    } finally {
      setBusy(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-(--radius) border border-dashed border-white/15 bg-[rgba(16,22,34,0.5)] p-4 text-left transition-all hover:border-(--accent)/30 hover:bg-[rgba(16,22,34,0.8)]"
      >
        <p className="text-xs uppercase tracking-[0.12em] text-(--muted)">+ Add New Task</p>
      </button>
    )
  }

  return (
    <div className="rounded-(--radius) border border-white/10 bg-[rgba(16,22,34,0.8)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.12em] text-white font-semibold">New Task</p>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Input
          placeholder="Task ID (e.g. TASK-001)"
          value={draft.id}
          onChange={(e) => setDraft((prev) => ({ ...prev, id: e.target.value }))}
        />
        <Input
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
        />
        <Textarea
          className="md:col-span-2 min-h-[80px]"
          placeholder="Description"
          value={draft.description}
          onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
        />
        <Input
          placeholder="Blocked by (comma separated)"
          value={draft.blocked_by.join(", ")}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              blocked_by: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            }))
          }
        />
        <Input
          type="number"
          placeholder="Priority"
          value={draft.priority}
          onChange={(e) => setDraft((prev) => ({ ...prev, priority: Number(e.target.value) }))}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="outline" onClick={create} disabled={busy}>
          {busy ? "Adding..." : "Add Task"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-(--danger)">{error}</p>}
    </div>
  )
}
