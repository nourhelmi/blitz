"use client"

import { useMemo } from "react"
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react"
import type { TaskWithStatus } from "@/lib/schema"

type DependencyGraphProps = {
  tasks: TaskWithStatus[]
}

const statusColors: Record<TaskWithStatus["status"], string> = {
  pending: "#7b8496",
  blocked: "#f7b955",
  ready: "#8dff9e",
  in_progress: "#5ad2ff",
  completed: "#7dff9c",
  failed: "#ff7a90",
}

export const DependencyGraph = ({ tasks }: DependencyGraphProps) => {
  const { nodes, edges } = useMemo(() => {
    const columns = 3
    const nodes: Node[] = tasks.map((task, index) => ({
      id: task.id,
      position: { x: (index % columns) * 320, y: Math.floor(index / columns) * 160 },
      data: { label: `${task.id} — ${task.title}`, statusColor: statusColors[task.status] },
      style: {
        border: `1px solid ${statusColors[task.status]}`,
        background: "rgba(18,25,39,0.9)",
        color: "white",
        padding: "12px 16px",
        borderRadius: "14px",
        width: 280,
      },
    }))

    const taskIds = new Set(tasks.map((task) => task.id))
    const edges: Edge[] = tasks.flatMap((task) =>
      task.blocked_by
        .filter((dep) => taskIds.has(dep))
        .map((dep) => ({
          id: `${dep}-${task.id}`,
          source: dep,
          target: task.id,
          animated: task.status === "in_progress",
          style: { stroke: "#3b4d6b" },
        }))
    )

    return { nodes, edges }
  }, [tasks])

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-[var(--radius)] border border-white/5 bg-[rgba(12,16,24,0.8)]">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) =>
            typeof node.data?.statusColor === "string" ? node.data.statusColor : "#3b4d6b"
          }
        />
        <Controls />
        <Background gap={24} color="#1f2b40" />
      </ReactFlow>
    </div>
  )
}
