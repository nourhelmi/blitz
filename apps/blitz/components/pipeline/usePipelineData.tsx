'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClarificationList, Spec, State, TaskList, TaskWithStatus } from '@/lib/schema'
import { withTaskStatuses } from '@/lib/task-status'

type PipelineData = {
  state?: State
  spec?: Spec
  taskList?: TaskList
  tasks?: TaskWithStatus[]
  clarificationList?: ClarificationList
  loading: boolean
  error?: string
}

export const usePipelineData = () => {
  const [data, setData] = useState<PipelineData>({ loading: true })
  const refreshRef = useRef<() => void>(() => {})

  const fetchJson = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init)
    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `Request failed: ${response.status}`)
    }
    return (await response.json()) as T
  }, [])

  const load = useCallback(async (): Promise<void> => {
    try {
      const stateResult = await fetchJson<{ state: State }>('/api/state')
      const state = stateResult.state
      const [specResult, tasksResult, clarifyResult] = await Promise.all([
        state.pipeline.spec_path
          ? fetchJson<{ spec: Spec }>('/api/spec')
          : Promise.resolve(undefined),
        state.pipeline.tasks_path
          ? fetchJson<{ task_list: TaskList }>('/api/tasks')
          : Promise.resolve(undefined),
        state.pipeline.clarifications_path
          ? fetchJson<{ clarification_list: ClarificationList | null }>('/api/clarify')
          : Promise.resolve(undefined),
      ])
      const spec = specResult?.spec
      const taskList = tasksResult?.task_list
      const tasks = taskList ? withTaskStatuses(taskList.tasks, state) : undefined
      const clarificationList = clarifyResult?.clarification_list ?? undefined
      setData({ state, spec, taskList, tasks, clarificationList, loading: false })
    } catch (error) {
      setData((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load pipeline state.',
      }))
    }
  }, [fetchJson])

  refreshRef.current = load

  useEffect(() => {
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    const source = new EventSource('/api/stream')
    source.onmessage = () => refreshRef.current()
    source.onerror = () => source.close()
    return () => source.close()
  }, [])

  return { data, refresh: load }
}
