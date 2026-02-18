"use client"

import { useEffect, useMemo, useState, useRef, type ReactNode, useCallback } from "react"
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
import type { Spec } from "@/lib/schema"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { SpecChat } from "./SpecChat"
import { cx } from "@/lib/cx"

type SpecEditorProps = {
  spec: Spec
  onRefresh: () => void
}

type Mode = "board" | "graph" | "json"

type BoardListColumnConfig = {
  id: "goals" | "constraints" | "conventions"
  title: string
  description: string
  accent: string
  cardLabel: string
  placeholder: string
  empty: string
  metaPrefix: string
  items: string[]
  onChange: (items: string[]) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec change detection — diffs two spec objects and returns changed section IDs
// ─────────────────────────────────────────────────────────────────────────────

type SpecSection = "overview" | "goals" | "constraints" | "conventions" | "architecture" | "phases"

const diffSpecSections = (prev: Spec, next: Spec): Set<SpecSection> => {
  const changed = new Set<SpecSection>()

  if (prev.project !== next.project || prev.version !== next.version || prev.summary !== next.summary) {
    changed.add("overview")
  }
  if (JSON.stringify(prev.goals) !== JSON.stringify(next.goals)) {
    changed.add("goals")
  }
  if (JSON.stringify(prev.constraints) !== JSON.stringify(next.constraints)) {
    changed.add("constraints")
  }
  if (JSON.stringify(prev.conventions) !== JSON.stringify(next.conventions)) {
    changed.add("conventions")
  }
  if (JSON.stringify(prev.architecture) !== JSON.stringify(next.architecture)) {
    changed.add("architecture")
  }
  if (JSON.stringify(prev.phases) !== JSON.stringify(next.phases)) {
    changed.add("phases")
  }

  return changed
}

export const SpecEditor = ({ spec, onRefresh }: SpecEditorProps) => {
  const [mode, setMode] = useState<Mode>("board")
  const [draft, setDraft] = useState<Spec>(spec)
  const [guidance, setGuidance] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [showChat, setShowChat] = useState(false)
  const [changedSections, setChangedSections] = useState<Set<SpecSection>>(new Set())
  const canGenerateTasks = Boolean(draft.approved_at)

  // Track previous spec for diffing (only server-originated changes)
  const prevSpecRef = useRef<Spec>(spec)
  // Flag to suppress animation on local saves
  const localSaveRef = useRef(false)

  const jsonValue = useMemo(() => JSON.stringify(draft, null, 2), [draft])
  const [jsonDraft, setJsonDraft] = useState(jsonValue)

  // Detect spec changes from server (AI chat edits, regeneration, etc.)
  // and trigger section-level animations
  useEffect(() => {
    if (localSaveRef.current) {
      localSaveRef.current = false
      prevSpecRef.current = spec
      setDraft(spec)
      return
    }

    const prev = prevSpecRef.current
    const changes = diffSpecSections(prev, spec)
    prevSpecRef.current = spec
    setDraft(spec)

    if (changes.size > 0) {
      setChangedSections(changes)
      const timer = setTimeout(() => setChangedSections(new Set()), 2500)
      return () => clearTimeout(timer)
    }
  }, [spec])

  useEffect(() => {
    if (mode === "json") setJsonDraft(jsonValue)
  }, [jsonValue, mode])

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    localSaveRef.current = true // Suppress animation for our own saves
    try {
      const response = await fetch("/api/spec", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      localSaveRef.current = false
      setError(err instanceof Error ? err.message : "Spec update failed.")
    } finally {
      setBusy(false)
    }
  }

  const approve = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/spec/approve", { method: "POST" })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spec approval failed.")
    } finally {
      setBusy(false)
    }
  }

  const generateTasks = async (): Promise<void> => {
    if (!canGenerateTasks) {
      setError("Approve the spec before generating tasks.")
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error(await response.text())
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task generation failed.")
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch("/api/generate-spec", {
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

  const updateList =
    (key: "goals" | "constraints" | "conventions") =>
    (items: string[]): void => {
      setDraft((prev) => ({ ...prev, [key]: items }))
    }

  const constraints = draft.constraints ?? []
  const conventions = draft.conventions ?? []

  // Board lanes map spec fields into a grooming-style flow.
  const listColumns: BoardListColumnConfig[] = [
    {
      id: "goals",
      title: "Goals",
      description: "Outcomes we must hit.",
      accent: "text-[var(--accent)]",
      cardLabel: "Goal",
      placeholder: "Ship X that unlocks Y.",
      empty: "Pin the outcomes that define success.",
      metaPrefix: "G",
      items: draft.goals,
      onChange: updateList("goals"),
    },
    {
      id: "constraints",
      title: "Constraints",
      description: "Non-negotiables and guardrails.",
      accent: "text-[var(--accent-2)]",
      cardLabel: "Constraint",
      placeholder: "Must run on ...",
      empty: "Capture the hard constraints early.",
      metaPrefix: "C",
      items: constraints,
      onChange: updateList("constraints"),
    },
    {
      id: "conventions",
      title: "Conventions",
      description: "Standards we agree to follow.",
      accent: "text-[var(--accent-3)]",
      cardLabel: "Convention",
      placeholder: "Use ... patterns",
      empty: "Align on style before execution.",
      metaPrefix: "V",
      items: conventions,
      onChange: updateList("conventions"),
    },
  ]

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-(--muted)">Stage 2</p>
          <h2 className="font-semibold text-2xl uppercase tracking-[0.06em]">
            Spec Review
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant={mode === "board" ? "solid" : "ghost"}
              size="sm"
              onClick={() => setMode("board")}
            >
              Outline
            </Button>
            <Button
              variant={mode === "graph" ? "solid" : "ghost"}
              size="sm"
              onClick={() => setMode("graph")}
            >
              Graph
            </Button>
            <Button
              variant={mode === "json" ? "solid" : "ghost"}
              size="sm"
              onClick={() => setMode("json")}
            >
              JSON
            </Button>
          </div>

          {/* Chat toggle */}
          <div className="h-5 w-px bg-white/10" />
          <button
            onClick={() => setShowChat((prev) => !prev)}
            className={cx(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-all",
              showChat
                ? "bg-(--accent)/15 text-(--accent) border border-(--accent)/30"
                : "text-(--muted) hover:text-white hover:bg-white/5 border border-transparent"
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
            {showChat && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--accent) opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-(--accent)" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Split layout: spec content + optional chat panel */}
      <div className={cx(showChat && "grid grid-cols-[1fr_380px] gap-4")}>
        <div className="min-w-0">
          {mode === "board" ? (
            <SpecBoardView
              draft={draft}
              setDraft={setDraft}
              listColumns={listColumns}
              changedSections={changedSections}
            />
          ) : mode === "graph" ? (
            <SpecGraph spec={draft} />
          ) : (
            <Textarea
              className="min-h-[340px] font-mono text-xs"
              value={jsonDraft}
              onChange={(event) => {
                const nextValue = event.target.value
                setJsonDraft(nextValue)
                try {
                  const parsed = JSON.parse(nextValue) as Spec
                  setDraft(parsed)
                  setError(undefined)
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Invalid JSON.")
                }
              }}
            />
          )}
        </div>

        {showChat && (
          <div className="h-[620px]">
            <SpecChat onRefresh={onRefresh} />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.12em] text-(--muted)">
            Regeneration Guidance
          </label>
          <Input
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            placeholder="Tighten scope, enforce constraints, rename phases..."
          />
        </div>
        <div className="flex flex-wrap items-end justify-end gap-3">
          <Button variant="outline" onClick={regenerate} disabled={busy}>
            Regenerate
          </Button>
          <Button variant="outline" onClick={save} disabled={busy}>
            Save
          </Button>
          <Button variant="outline" onClick={generateTasks} disabled={busy || !canGenerateTasks}>
            Generate Tasks
          </Button>
          <Button onClick={approve} disabled={busy}>
            Approve
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-(--danger)">{error}</p> : undefined}
    </Card>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Spec Outline View — Accordion-based hierarchical view with inline editing
// ─────────────────────────────────────────────────────────────────────────────

type SpecBoardViewProps = {
  draft: Spec
  setDraft: React.Dispatch<React.SetStateAction<Spec>>
  listColumns: BoardListColumnConfig[]
  changedSections: Set<SpecSection>
}

const SpecBoardView = ({ draft, setDraft, listColumns, changedSections }: SpecBoardViewProps) => {
  // Track which sections the user has manually toggled
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["overview", "architecture"]))

  // Derive effective expanded set: user toggles + AI-changed sections auto-expand.
  // No effect needed — changed sections are transient and union'd at render time.
  const effectiveExpanded = useMemo(
    () => changedSections.size > 0 ? new Set([...expanded, ...changedSections]) : expanded,
    [expanded, changedSections]
  )

  // Track which sub-items are expanded (for inline editing)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggle = (section: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const phases = draft.phases ?? []
  const techStack = draft.architecture?.tech_stack ?? []
  const keyComponents = draft.architecture?.key_components ?? []
  const archOverview = draft.architecture?.overview ?? ""

  // Validation helpers
  const isOverviewComplete = draft.project.length > 0 && draft.summary.length > 0
  const isGoalsComplete = draft.goals.length > 0
  const isArchComplete = keyComponents.length > 0
  const isPhasesComplete = phases.length > 0

  // Update helpers
  const updateArchOverview = (overview: string) => {
    setDraft((prev) => ({
      ...prev,
      architecture: { ...prev.architecture, overview },
    }))
  }

  const updateTechStack = (index: number, field: "category" | "items", value: string | string[]) => {
    setDraft((prev) => {
      const newStack = [...(prev.architecture?.tech_stack ?? [])]
      newStack[index] = { ...newStack[index], [field]: value }
      return { ...prev, architecture: { ...prev.architecture, overview: prev.architecture?.overview ?? "", tech_stack: newStack } }
    })
  }

  const addTechStack = () => {
    setDraft((prev) => ({
      ...prev,
      architecture: {
        ...prev.architecture,
        overview: prev.architecture?.overview ?? "",
        tech_stack: [...(prev.architecture?.tech_stack ?? []), { category: "", items: [] }],
      },
    }))
  }

  const removeTechStack = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      architecture: {
        ...prev.architecture,
        overview: prev.architecture?.overview ?? "",
        tech_stack: prev.architecture?.tech_stack?.filter((_, i) => i !== index) ?? [],
      },
    }))
  }

  const updateComponent = (index: number, field: "name" | "description" | "responsibilities", value: string | string[]) => {
    setDraft((prev) => {
      const newComponents = [...(prev.architecture?.key_components ?? [])]
      newComponents[index] = { ...newComponents[index], [field]: value }
      return { ...prev, architecture: { ...prev.architecture, overview: prev.architecture?.overview ?? "", key_components: newComponents } }
    })
  }

  const addComponent = () => {
    setDraft((prev) => ({
      ...prev,
      architecture: {
        ...prev.architecture,
        overview: prev.architecture?.overview ?? "",
        key_components: [...(prev.architecture?.key_components ?? []), { name: "", description: "", responsibilities: [] }],
      },
    }))
  }

  const removeComponent = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      architecture: {
        ...prev.architecture,
        overview: prev.architecture?.overview ?? "",
        key_components: prev.architecture?.key_components?.filter((_, i) => i !== index) ?? [],
      },
    }))
  }

  const updatePhase = (index: number, field: "id" | "name" | "description" | "depends_on", value: string | string[]) => {
    setDraft((prev) => {
      const newPhases = [...(prev.phases ?? [])]
      newPhases[index] = { ...newPhases[index], [field]: value }
      return { ...prev, phases: newPhases }
    })
  }

  const addPhase = () => {
    setDraft((prev) => ({
      ...prev,
      phases: [...(prev.phases ?? []), { id: `phase-${(prev.phases?.length ?? 0) + 1}`, name: "", description: "", depends_on: [] }],
    }))
  }

  const removePhase = (index: number) => {
    setDraft((prev) => ({ ...prev, phases: prev.phases?.filter((_, i) => i !== index) ?? [] }))
  }

  return (
    <div className="space-y-2">
      {/* OVERVIEW */}
      <AccordionSection
        title="Overview"
        icon="📋"
        expanded={effectiveExpanded.has("overview")}
        onToggle={() => toggle("overview")}
        status={isOverviewComplete ? "complete" : "incomplete"}
        preview={`${draft.project} v${draft.version}`}
        isChanged={changedSections.has("overview")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-(--muted)">Project Name</label>
            <Input value={draft.project} onChange={(e) => setDraft((prev) => ({ ...prev, project: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-(--muted)">Version</label>
            <Input value={draft.version} onChange={(e) => setDraft((prev) => ({ ...prev, version: e.target.value }))} />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-(--muted)">Summary</label>
          <Textarea
            className="min-h-[100px] text-sm"
            value={draft.summary}
            onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
          />
        </div>
      </AccordionSection>

      {/* GOALS */}
      <AccordionSection
        title="Goals"
        icon="🎯"
        count={draft.goals.length}
        expanded={effectiveExpanded.has("goals")}
        onToggle={() => toggle("goals")}
        status={isGoalsComplete ? "complete" : "incomplete"}
        preview={draft.goals.slice(0, 2).map((g) => g.slice(0, 40) + (g.length > 40 ? "..." : "")).join(" • ")}
        onAdd={() => listColumns[0].onChange([...listColumns[0].items, ""])}
        isChanged={changedSections.has("goals")}
      >
        <div className="space-y-2">
          {listColumns[0].items.map((item, index) => (
            <InlineListItem
              key={`goal-${index}`}
              value={item}
              placeholder="Describe a goal..."
              onChange={(v) => listColumns[0].onChange(listColumns[0].items.map((x, i) => (i === index ? v : x)))}
              onRemove={() => listColumns[0].onChange(listColumns[0].items.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      </AccordionSection>

      {/* CONSTRAINTS */}
      <AccordionSection
        title="Constraints"
        icon="🚧"
        count={listColumns[1].items.length}
        expanded={effectiveExpanded.has("constraints")}
        onToggle={() => toggle("constraints")}
        status={listColumns[1].items.length > 0 ? "complete" : "optional"}
        preview={listColumns[1].items.slice(0, 2).map((c) => c.slice(0, 30) + "...").join(" • ")}
        onAdd={() => listColumns[1].onChange([...listColumns[1].items, ""])}
        isChanged={changedSections.has("constraints")}
      >
        <div className="space-y-2">
          {listColumns[1].items.map((item, index) => (
            <InlineListItem
              key={`constraint-${index}`}
              value={item}
              placeholder="Describe a constraint..."
              onChange={(v) => listColumns[1].onChange(listColumns[1].items.map((x, i) => (i === index ? v : x)))}
              onRemove={() => listColumns[1].onChange(listColumns[1].items.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      </AccordionSection>

      {/* CONVENTIONS */}
      <AccordionSection
        title="Conventions"
        icon="📐"
        count={listColumns[2].items.length}
        expanded={effectiveExpanded.has("conventions")}
        onToggle={() => toggle("conventions")}
        status={listColumns[2].items.length > 0 ? "complete" : "optional"}
        preview={listColumns[2].items.slice(0, 2).map((c) => c.slice(0, 30) + "...").join(" • ")}
        onAdd={() => listColumns[2].onChange([...listColumns[2].items, ""])}
        isChanged={changedSections.has("conventions")}
      >
        <div className="space-y-2">
          {listColumns[2].items.map((item, index) => (
            <InlineListItem
              key={`convention-${index}`}
              value={item}
              placeholder="Describe a convention..."
              onChange={(v) => listColumns[2].onChange(listColumns[2].items.map((x, i) => (i === index ? v : x)))}
              onRemove={() => listColumns[2].onChange(listColumns[2].items.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      </AccordionSection>

      {/* ARCHITECTURE */}
      <AccordionSection
        title="Architecture"
        icon="🏗"
        expanded={effectiveExpanded.has("architecture")}
        onToggle={() => toggle("architecture")}
        status={isArchComplete ? "complete" : "incomplete"}
        preview={`${keyComponents.length} components • ${techStack.length} tech categories`}
        isChanged={changedSections.has("architecture")}
      >
        {/* Overview */}
        <div className="space-y-2 mb-4">
          <label className="text-[10px] uppercase tracking-widest text-(--muted)">Architecture Overview</label>
          <Textarea
            className="min-h-[80px] text-sm"
            value={archOverview}
            placeholder="High-level architecture description..."
            onChange={(e) => updateArchOverview(e.target.value)}
          />
        </div>

        {/* Tech Stack */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-(--muted)">Tech Stack ({techStack.length})</span>
            <button onClick={addTechStack} className="text-[10px] uppercase tracking-widest text-(--accent) hover:underline">+ Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {techStack.map((stack, index) => (
              <div key={index} className="group relative rounded-lg border border-white/10 bg-(--surface) px-3 py-2">
                <span className="text-xs font-medium text-white">{stack.category || "Category"}</span>
                <span className="ml-2 text-xs text-(--muted)">{stack.items.join(", ") || "items..."}</span>
                <button
                  onClick={() => removeTechStack(index)}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-(--danger) text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Key Components */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-(--muted)">Key Components ({keyComponents.length})</span>
            <button onClick={addComponent} className="text-[10px] uppercase tracking-widest text-(--accent) hover:underline">+ Add</button>
          </div>
          <div className="space-y-2">
            {keyComponents.map((comp, index) => (
              <ExpandableCard
                key={`comp-${index}`}
                title={comp.name || "Unnamed Component"}
                subtitle={comp.description.slice(0, 60) + (comp.description.length > 60 ? "..." : "")}
                badge={`${comp.responsibilities.length} resp`}
                expanded={expandedItems.has(`comp-${index}`)}
                onToggle={() => toggleItem(`comp-${index}`)}
                onRemove={() => removeComponent(index)}
              >
                <div className="space-y-3 pt-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-(--muted)">Name</label>
                      <Input value={comp.name} onChange={(e) => updateComponent(index, "name", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-(--muted)">Description</label>
                    <Textarea className="min-h-[60px] text-sm" value={comp.description} onChange={(e) => updateComponent(index, "description", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-(--muted)">Responsibilities (one per line)</label>
                    <Textarea
                      className="min-h-[80px] text-sm"
                      value={comp.responsibilities.join("\n")}
                      onChange={(e) => updateComponent(index, "responsibilities", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                    />
                  </div>
                </div>
              </ExpandableCard>
            ))}
          </div>
        </div>
      </AccordionSection>

      {/* PHASES */}
      <AccordionSection
        title="Phases"
        icon="📦"
        count={phases.length}
        expanded={effectiveExpanded.has("phases")}
        onToggle={() => toggle("phases")}
        status={isPhasesComplete ? "complete" : "incomplete"}
        onAdd={addPhase}
        isChanged={changedSections.has("phases")}
      >
        {/* Visual Phase Flow */}
        {phases.length > 0 && (
          <div className="mb-4 p-4 rounded-lg bg-[rgba(10,14,20,0.6)] border border-white/5 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {phases.map((phase, index) => {
                const hasDeps = phase.depends_on.length > 0
                return (
                  <div key={phase.id} className="flex items-center gap-2">
                    {index > 0 && <span className="text-(--muted)">→</span>}
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                        expandedItems.has(`phase-${index}`)
                          ? "border-(--accent) bg-(--accent)/10 text-white"
                          : "border-white/20 bg-(--surface) text-(--muted) hover:border-white/40"
                      }`}
                      onClick={() => toggleItem(`phase-${index}`)}
                    >
                      {phase.name || phase.id}
                      {hasDeps && <span className="ml-1 text-[10px] text-(--muted)">({phase.depends_on.length})</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Phase Cards */}
        <div className="space-y-2">
          {phases.map((phase, index) => (
            <ExpandableCard
              key={`phase-${index}`}
              title={phase.name || phase.id || "Unnamed Phase"}
              subtitle={phase.description.slice(0, 80) + (phase.description.length > 80 ? "..." : "")}
              badge={phase.depends_on.length > 0 ? `depends: ${phase.depends_on.join(", ")}` : undefined}
              expanded={expandedItems.has(`phase-${index}`)}
              onToggle={() => toggleItem(`phase-${index}`)}
              onRemove={() => removePhase(index)}
            >
              <div className="space-y-3 pt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-(--muted)">ID</label>
                    <Input value={phase.id} onChange={(e) => updatePhase(index, "id", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-(--muted)">Name</label>
                    <Input value={phase.name} onChange={(e) => updatePhase(index, "name", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-(--muted)">Description</label>
                  <Textarea className="min-h-[60px] text-sm" value={phase.description} onChange={(e) => updatePhase(index, "description", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-(--muted)">Depends On (comma separated)</label>
                  <Input
                    value={phase.depends_on.join(", ")}
                    placeholder="phase-1, phase-2"
                    onChange={(e) => updatePhase(index, "depends_on", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  />
                </div>
              </div>
            </ExpandableCard>
          ))}
        </div>
      </AccordionSection>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Accordion Section — collapsible section wrapper
// ─────────────────────────────────────────────────────────────────────────────

type AccordionSectionProps = {
  title: string
  icon: string
  count?: number
  expanded: boolean
  onToggle: () => void
  status: "complete" | "incomplete" | "optional"
  preview?: string
  onAdd?: () => void
  isChanged?: boolean
  children: ReactNode
}

const AccordionSection = ({
  title,
  icon,
  count,
  expanded,
  onToggle,
  status,
  preview,
  onAdd,
  isChanged,
  children,
}: AccordionSectionProps) => {
  const statusColors = {
    complete: "bg-(--accent) text-black",
    incomplete: "bg-(--accent-2) text-black",
    optional: "bg-white/10 text-(--muted)",
  }

  return (
    <div className={cx("rounded-(--radius) border border-white/10 bg-[rgba(15,20,32,0.9)] overflow-hidden", isChanged && "spec-changed")}>
      {/* Header — div avoids nested <button> violation when onAdd renders its own button */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" || e.key === " " ? onToggle() : undefined}
        className="w-full flex items-center justify-between gap-4 p-4 hover:bg-white/5 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm uppercase tracking-wider text-white">{title}</span>
              {typeof count === "number" && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-(--muted)">
                  {count}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-medium ${statusColors[status]}`}>
                {status === "complete" ? "✓" : status === "incomplete" ? "!" : "○"}
              </span>
              {isChanged && (
                <span className="spec-badge-active px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-medium bg-(--accent)/20 text-(--accent) border border-(--accent)/30">
                  Updated
                </span>
              )}
            </div>
            {!expanded && preview && (
              <p className="mt-0.5 text-xs text-(--muted) truncate max-w-[500px]">{preview}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAdd && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd() }}
              className="px-2 py-1 text-[10px] uppercase tracking-wider text-(--accent) hover:bg-(--accent)/10 rounded transition-colors"
            >
              + Add
            </button>
          )}
          <span className={`text-(--muted) transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </div>

      {/* Content */}
      {expanded && <div className="px-4 pb-4 border-t border-white/5 pt-4">{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Expandable Card — inline expandable sub-item
// ─────────────────────────────────────────────────────────────────────────────

type ExpandableCardProps = {
  title: string
  subtitle?: string
  badge?: string
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
  children: ReactNode
}

const ExpandableCard = ({ title, subtitle, badge, expanded, onToggle, onRemove, children }: ExpandableCardProps) => (
  <div className={`rounded-lg border transition-all ${expanded ? "border-(--accent)/50 bg-(--surface)" : "border-white/10 bg-white/5"}`}>
    <div className="flex items-center justify-between p-3 cursor-pointer group" onClick={onToggle}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-white">{title}</span>
          {badge && <span className="text-[10px] text-(--muted) bg-white/5 px-2 py-0.5 rounded">{badge}</span>}
        </div>
        {!expanded && subtitle && <p className="text-xs text-(--muted) truncate mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="text-[10px] text-(--muted) hover:text-(--danger) opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Remove
        </button>
        <span className={`text-(--muted) text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
      </div>
    </div>
    {expanded && <div className="px-3 pb-3 border-t border-white/5">{children}</div>}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Inline List Item — simple editable list item with delete
// ─────────────────────────────────────────────────────────────────────────────

type InlineListItemProps = {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onRemove: () => void
}

const InlineListItem = ({ value, placeholder, onChange, onRemove }: InlineListItemProps) => (
  <div className="relative group">
    <Textarea
      className="min-h-[50px] text-sm pr-8"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
    <button
      onClick={onRemove}
      className="absolute top-2 right-2 text-xs text-(--muted) hover:text-(--danger) opacity-0 group-hover:opacity-100 transition-opacity"
    >
      ×
    </button>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Graph View — visualizes phases + architecture as a DAG
// ─────────────────────────────────────────────────────────────────────────────

type SpecGraphProps = {
  spec: Spec
}

const phaseColors = [
  "#b7ff2a", // accent
  "#ffb347", // accent-2
  "#5ad2ff", // accent-3
  "#ff7a90", // danger-ish
  "#c4a7ff", // purple
  "#7dff9c", // green
]

// Compute vertical DAG layout based on dependencies
const computeVerticalLayout = (
  phases: Array<{ id: string; depends_on: string[] }>
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>()
  const phaseMap = new Map(phases.map((p) => [p.id, p]))
  
  // Compute depth (longest path from root) for each phase
  const depths = new Map<string, number>()
  const getDepth = (id: string, visited = new Set<string>()): number => {
    if (depths.has(id)) return depths.get(id)!
    if (visited.has(id)) return 0 // cycle protection
    visited.add(id)
    
    const phase = phaseMap.get(id)
    if (!phase || phase.depends_on.length === 0) {
      depths.set(id, 0)
      return 0
    }
    
    const maxParentDepth = Math.max(
      ...phase.depends_on.map((dep) => (phaseMap.has(dep) ? getDepth(dep, visited) : -1))
    )
    const depth = maxParentDepth + 1
    depths.set(id, depth)
    return depth
  }
  
  phases.forEach((p) => getDepth(p.id))
  
  // Group by depth level
  const levels = new Map<number, string[]>()
  phases.forEach((p) => {
    const depth = depths.get(p.id) ?? 0
    const level = levels.get(depth) ?? []
    level.push(p.id)
    levels.set(depth, level)
  })
  
  // Position nodes: vertical flow, centered horizontally per level
  const nodeWidth = 280
  const nodeHeight = 100
  const horizontalGap = 40
  const verticalGap = 120
  
  levels.forEach((ids, depth) => {
    const totalWidth = ids.length * nodeWidth + (ids.length - 1) * horizontalGap
    const startX = -totalWidth / 2 + nodeWidth / 2
    
    ids.forEach((id, index) => {
      positions.set(id, {
        x: startX + index * (nodeWidth + horizontalGap),
        y: depth * (nodeHeight + verticalGap),
      })
    })
  })
  
  return positions
}

const SpecGraph = ({ spec }: SpecGraphProps) => {
  const phases = useMemo(() => spec.phases ?? [], [spec.phases])
  const components = useMemo(
    () => spec.architecture?.key_components ?? [],
    [spec.architecture?.key_components]
  )

  // Build nodes with vertical DAG layout
  const initialNodes = useMemo((): Node[] => {
    const positions = computeVerticalLayout(phases)
    const maxDepth = phases.length > 0 
      ? Math.max(...[...positions.values()].map((p) => p.y)) 
      : 0
    
    const phaseNodes: Node[] = phases.map((phase, index) => {
      const pos = positions.get(phase.id) ?? { x: index * 320, y: 0 }
      return {
        id: phase.id,
        position: pos,
        data: {
          label: phase.name,
          description: phase.description,
          type: "phase",
        },
        style: {
          border: `2px solid ${phaseColors[index % phaseColors.length]}`,
          background: "rgba(18,25,39,0.95)",
          color: "white",
          padding: "16px 20px",
          borderRadius: "14px",
          width: 280,
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
        },
      }
    })

    const componentNodes: Node[] = components.map((comp, index) => ({
      id: `comp-${comp.name}`,
      position: { x: index * 300 - (components.length * 150), y: maxDepth + 200 },
      data: {
        label: comp.name,
        description: comp.description,
        type: "component",
      },
      style: {
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(21,31,50,0.9)",
        color: "#9aa7bd",
        padding: "12px 16px",
        borderRadius: "12px",
        width: 260,
        fontSize: "12px",
      },
    }))

    return [...phaseNodes, ...componentNodes]
  }, [phases, components])

  // Edges from phase.depends_on
  const initialEdges = useMemo((): Edge[] => {
    const phaseIds = new Set(phases.map((p) => p.id))
    return phases.flatMap((phase) =>
      phase.depends_on
        .filter((dep) => phaseIds.has(dep))
        .map((dep) => ({
          id: `${dep}->${phase.id}`,
          source: dep,
          target: phase.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#5ad2ff", strokeWidth: 2 },
          markerEnd: { type: "arrowclosed" as const, color: "#5ad2ff", width: 20, height: 20 },
        }))
    )
  }, [phases])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync when spec changes
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const hasContent = phases.length > 0 || components.length > 0

  if (!hasContent) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-(--radius) border border-dashed border-white/15 bg-[rgba(12,16,24,0.6)]">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.12em] text-(--muted)">
            No phases or components
          </p>
          <p className="mt-2 text-xs text-(--muted)">
            Add phases to your spec to visualize the dependency graph.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-(--radius) border border-white/5 bg-[rgba(12,16,24,0.8)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.data?.type === "phase") {
              const idx = phases.findIndex((p) => p.id === node.id)
              return phaseColors[idx % phaseColors.length]
            }
            return "#3b4d6b"
          }}
          style={{ background: "rgba(15,20,30,0.9)" }}
        />
        <Controls />
        <Background gap={28} color="#1f2b40" />
      </ReactFlow>
    </div>
  )
}
