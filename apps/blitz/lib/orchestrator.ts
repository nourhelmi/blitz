import type { Run, State, Task, TaskRun, TaskStatus } from './schema'
import { getSpec } from './spec'
import { getTaskList } from './tasks'
import { getState, updateState } from './state'
import { appendTaskLog, initTaskLog } from './logs'
import { emitEvent } from './events'
import { spawnAgent } from './worker'
import { appendContext, initContextFile } from './context'
import { nowIso } from './time'
import { getRunControl, waitForResume } from './run-control'
import { logError, logInfo } from './logger'

type RunOrchestratorInput = {
  runId: string
  maxParallel: number
}

export const runOrchestrator = async ({
  runId,
  maxParallel,
}: RunOrchestratorInput): Promise<void> => {
  // Main loop: spawn ready tasks up to parallel limit, wait for completion, update state.
  const spec = await getSpec()
  const taskList = await getTaskList()
  if (!spec || !taskList) {
    throw new Error('Missing spec or task list for run.')
  }

  await initContextFile()
  const control = getRunControl()
  emitEvent({ type: 'run_started', run_id: runId })
  await logInfo('orchestrator.start', { run_id: runId, max_parallel: maxParallel })

  while (true) {
    if (control.stopping) {
      await finalizeRun(false, 'Run stopped by user.')
      await logInfo('orchestrator.stopped', { run_id: runId })
      emitEvent({ type: 'run_completed', success: false })
      return
    }

    if (control.paused) {
      await waitForResume(control)
      continue
    }

    const state = await getState()
    const ready = getReadyTasks(taskList.tasks, state)
    const inProgress = countByStatus(state, 'in_progress')

    if (ready.length === 0 && inProgress === 0) {
      const allCompleted = taskList.tasks.every(
        (task) => state.task_states[task.id] === 'completed'
      )
      await finalizeRun(allCompleted, allCompleted ? undefined : 'Some tasks failed.')
      emitEvent({ type: 'run_completed', success: allCompleted })
      return
    }

    const slots = Math.max(0, maxParallel - inProgress)
    const toSpawn = ready.slice(0, slots)

    for (const task of toSpawn) {
      const logFile = await initTaskLog(task.id)
      const agent = await spawnAgent(task, spec)
      control.activeWorkers.set(task.id, agent)
      agent.onOutput((line) => {
        appendTaskLog(task.id, line).catch(() => {})
        emitEvent({ type: 'task_log', task_id: task.id, line })
      })

      await updateState((current) =>
        updateRunState(markTaskStatus(current, task.id, 'in_progress'), (run) =>
          upsertTaskRun(run, {
            task_id: task.id,
            status: 'in_progress',
            agent_pid: agent.pid,
            started_at: nowIso(),
            log_file: logFile,
          })
        )
      )
      emitEvent({ type: 'task_started', task_id: task.id })
      await logInfo('task.start', { task_id: task.id, run_id: runId })
    }

    if (control.activeWorkers.size === 0) {
      await sleep(250)
      continue
    }

    const completed = await waitForAnyWorker(control.activeWorkers)
    if (!completed) continue

    control.activeWorkers.delete(completed.taskId)

    await updateState((current) => {
      const status: TaskStatus = completed.result.success ? 'completed' : 'failed'
      const updated = markTaskStatus(current, completed.taskId, status)
      return updateRunState(updated, (run) =>
        upsertTaskRun(run, {
          task_id: completed.taskId,
          status,
          completed_at: nowIso(),
          error: completed.result.success ? undefined : 'Agent failed or timed out.',
          context: completed.result.context,
        })
      )
    })

    if (completed.result.context) {
      await appendContext(completed.result.context)
    }

    emitEvent({ type: 'task_completed', task_id: completed.taskId, success: completed.result.success })
    await logInfo('task.complete', {
      task_id: completed.taskId,
      run_id: runId,
      success: completed.result.success,
    })
  }
}

const getReadyTasks = (tasks: Task[], state: State): Task[] => {
  // Ready tasks are those not in progress/completed and with all deps completed.
  const completed = new Set(
    Object.entries(state.task_states)
      .filter(([, status]) => status === 'completed')
      .map(([id]) => id)
  )

  return tasks
    .filter((task) => {
      const status = state.task_states[task.id]
      if (status === 'completed' || status === 'in_progress') return false
      return task.blocked_by.every((dep) => completed.has(dep))
    })
    .sort((a, b) => b.priority - a.priority)
}

const countByStatus = (state: State, status: TaskStatus): number =>
  Object.values(state.task_states).filter((value) => value === status).length

const markTaskStatus = (state: State, taskId: string, status: TaskStatus): State => ({
  ...state,
  task_states: { ...state.task_states, [taskId]: status },
})

const updateRunState = (state: State, updater: (run: Run) => Run): State => {
  if (!state.current_run) return state
  const nextRun = updater(state.current_run)
  const runs = [...state.runs.filter((run) => run.id !== nextRun.id), nextRun]
  return { ...state, current_run: nextRun, runs }
}

const upsertTaskRun = (run: Run, update: TaskRun): Run => {
  const existing = run.task_runs.find((item) => item.task_id === update.task_id)
  const task_runs = existing
    ? run.task_runs.map((item) =>
        item.task_id === update.task_id ? { ...item, ...update } : item
      )
    : [...run.task_runs, update]
  return { ...run, task_runs }
}

const finalizeRun = async (success: boolean, error?: string): Promise<void> => {
  await updateState((state) => {
    if (!state.current_run) return state
    const finalStatus: Run['status'] = success ? 'completed' : 'failed'
    const updated = updateRunState(state, (run) => ({ ...run, status: finalStatus }))
    return {
      ...updated,
      pipeline: {
        ...updated.pipeline,
        stage: success ? 'completed' : 'paused',
        error,
      },
    }
  })
  emitEvent({ type: 'stage_change', stage: success ? 'completed' : 'paused' })
  if (success) {
    await logInfo('orchestrator.complete', { success })
  } else {
    await logError('orchestrator.failed', { error: error ?? 'unknown' })
  }
}

const waitForAnyWorker = async (
  workers: Map<string, { wait: () => Promise<{ success: boolean; result?: string; context?: string }> }>
): Promise<{ taskId: string; result: { success: boolean; result?: string; context?: string } } | undefined> => {
  const entries = [...workers.entries()]
  if (entries.length === 0) return undefined
  return Promise.race(
    entries.map(async ([taskId, worker]) => ({
      taskId,
      result: await worker.wait(),
    }))
  )
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
