import { execFile } from 'child_process'
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
import { validateTaskCompletion } from './validator'

type RunOrchestratorInput = {
  runId: string
  maxParallel: number
  maxRetries?: number
}

// Non-retryable error patterns
const NON_RETRYABLE_PATTERNS = /blocked|non-retryable/i

export const runOrchestrator = async ({
  runId,
  maxParallel,
  maxRetries = 2,
}: RunOrchestratorInput): Promise<void> => {
  const spec = await getSpec()
  const taskList = await getTaskList()
  if (!spec || !taskList) {
    throw new Error('Missing spec or task list for run.')
  }

  await initContextFile()
  const control = getRunControl()
  emitEvent({ type: 'run_started', run_id: runId })
  await logInfo('orchestrator.start', { run_id: runId, max_parallel: maxParallel })

  // Execute init_script if present
  if (spec.init_script && spec.init_script.trim().length > 0) {
    const cwd = spec.working_directory ?? process.cwd()
    await logInfo('orchestrator.init_script.start', { cwd })
    emitEvent({ type: 'run_init', success: true })
    try {
      await execInit(spec.init_script, cwd)
      await logInfo('orchestrator.init_script.success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'init_script failed'
      await logError('orchestrator.init_script.failed', { error: message })
      emitEvent({ type: 'run_init', success: false, error: message })
      await finalizeRun(false, `init_script failed: ${message}`)
      emitEvent({ type: 'run_completed', success: false })
      return
    }
  }

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

      // Compute timeout: 2x estimated_minutes, minimum 10 min
      const estimatedMinutes = task.estimated_minutes ?? 30
      const timeoutMs = Math.max(estimatedMinutes * 2, 10) * 60 * 1000

      const agent = await spawnAgent({
        task,
        spec,
        state,
        allTasks: taskList.tasks,
        timeoutMs,
      })
      control.activeWorkers.set(task.id, agent)
      agent.onOutput((line) => {
        appendTaskLog(task.id, line).catch(() => {})
        emitEvent({ type: 'task_log', task_id: task.id, line })
      })

      // Get current attempt count
      const currentRun = state.current_run
      const existingTaskRun = currentRun?.task_runs.find((tr) => tr.task_id === task.id)
      const attempt = (existingTaskRun?.attempt ?? 0) + 1

      await updateState((current) =>
        updateRunState(markTaskStatus(current, task.id, 'in_progress'), (run) =>
          upsertTaskRun(run, {
            task_id: task.id,
            status: 'in_progress',
            attempt,
            agent_pid: agent.pid,
            started_at: nowIso(),
            log_file: logFile,
          })
        )
      )
      emitEvent({ type: 'task_started', task_id: task.id })
      await logInfo('task.start', { task_id: task.id, run_id: runId, attempt })
    }

    if (control.activeWorkers.size === 0) {
      await sleep(250)
      continue
    }

    const completed = await waitForAnyWorker(control.activeWorkers)
    if (!completed) continue

    control.activeWorkers.delete(completed.taskId)

    const task = taskList.tasks.find((t) => t.id === completed.taskId)
    let taskSuccess = completed.result.success
    let taskError = completed.result.error

    // Post-task validation
    if (taskSuccess && task) {
      const validation = await validateTaskCompletion(task, spec)
      if (!validation.valid) {
        taskSuccess = false
        taskError = `Validation failed: ${validation.issues.join('; ')}`
        await logInfo('task.validation.failed', {
          task_id: completed.taskId,
          issues: validation.issues.join('; '),
        })
      }
    }

    // Check retry eligibility
    const latestState = await getState()
    const currentTaskRun = latestState.current_run?.task_runs.find(
      (tr) => tr.task_id === completed.taskId
    )
    const attempt = currentTaskRun?.attempt ?? 1
    const isRetryable =
      !taskSuccess &&
      attempt < maxRetries &&
      !NON_RETRYABLE_PATTERNS.test(taskError ?? '')

    if (isRetryable) {
      await updateState((current) => {
        const updated = markTaskStatus(current, completed.taskId, 'pending')
        return updateRunState(updated, (run) =>
          upsertTaskRun(run, {
            task_id: completed.taskId,
            status: 'pending',
            attempt,
            error: taskError,
            completed_at: nowIso(),
          })
        )
      })
      await logInfo('task.retry', {
        task_id: completed.taskId,
        attempt,
        max_retries: maxRetries,
      })
      await sleep(1000 * attempt)
      continue
    }

    const status: TaskStatus = taskSuccess ? 'completed' : 'failed'
    await updateState((current) => {
      const updated = markTaskStatus(current, completed.taskId, status)
      return updateRunState(updated, (run) =>
        upsertTaskRun(run, {
          task_id: completed.taskId,
          status,
          attempt,
          completed_at: nowIso(),
          error: taskSuccess ? undefined : (taskError ?? 'Agent exited with no error message.'),
          context: completed.result.context,
        })
      )
    })

    if (completed.result.context) {
      await appendContext(completed.result.context)
    }

    emitEvent({
      type: 'task_completed',
      task_id: completed.taskId,
      success: taskSuccess,
      error: taskSuccess ? undefined : taskError,
    })
    await logInfo('task.complete', {
      task_id: completed.taskId,
      run_id: runId,
      success: taskSuccess,
    })
  }
}

const execInit = (script: string, cwd: string): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile('sh', ['-c', script], { cwd, timeout: 120000 }, (error, stdout, stderr) => {
      if (stdout) console.log('[init_script]', stdout)
      if (stderr) console.error('[init_script]', stderr)
      if (error) reject(error)
      else resolve()
    })
  })

const getReadyTasks = (tasks: Task[], state: State): Task[] => {
  const completed = new Set(
    Object.entries(state.task_states)
      .filter(([, status]) => status === 'completed')
      .map(([id]) => id)
  )

  return tasks
    .filter((task) => {
      const status = state.task_states[task.id]
      if (status === 'completed' || status === 'in_progress' || status === 'failed') return false
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
  workers: Map<string, { wait: () => Promise<{ success: boolean; result?: string; context?: string; error?: string }> }>
): Promise<{ taskId: string; result: { success: boolean; result?: string; context?: string; error?: string } } | undefined> => {
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
