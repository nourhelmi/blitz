import type { State, Task, TaskStatus } from './schema'

export const deriveTaskStatus = (task: Task, state: State): TaskStatus => {
  const direct = state.task_states[task.id]
  if (direct === 'completed' || direct === 'in_progress' || direct === 'failed') return direct
  const depsMet = task.blocked_by.every((dep) => state.task_states[dep] === 'completed')
  return depsMet ? 'ready' : 'blocked'
}

export const withTaskStatuses = (tasks: Task[], state: State): Array<Task & { status: TaskStatus }> =>
  tasks.map((task) => ({ ...task, status: deriveTaskStatus(task, state) }))
