import { readFile } from 'fs/promises'
import {
  TaskListSchema,
  TaskSchema,
  type Task,
  type TaskList,
  type TaskStatus,
} from './schema'
import { ensureDataDirs, writeJsonFile } from './storage'
import { getTasksPath } from './paths'
import { updateState } from './state'

export const getTaskList = async (): Promise<TaskList | undefined> => {
  await ensureDataDirs()
  try {
    const raw = await readFile(getTasksPath(), 'utf-8')
    return TaskListSchema.parse(JSON.parse(raw))
  } catch (error) {
    if (isMissingFile(error as { code?: string })) return undefined
    throw error
  }
}

export const saveTaskList = async (taskList: TaskList): Promise<TaskList> => {
  const next = TaskListSchema.parse(taskList)
  await ensureDataDirs()
  await writeJsonFile(getTasksPath(), next)
  await syncTaskStates(next.tasks)
  return next
}

export const updateTask = async (taskId: string, patch: Partial<Task>): Promise<TaskList> => {
  const current = await getTaskList()
  if (!current) throw new Error('No tasks available to update.')
  const nextTasks = current.tasks.map((task) => {
    if (task.id !== taskId) return task
    return TaskSchema.parse({ ...task, ...patch, id: taskId })
  })
  return saveTaskList({ ...current, tasks: nextTasks, approved_at: undefined })
}

export const addTask = async (task: Task): Promise<TaskList> => {
  const current = (await getTaskList()) ?? {
    id: crypto.randomUUID(),
    spec_id: 'unknown',
    tasks: [],
    generated_at: new Date().toISOString(),
  }
  const nextTasks = [...current.tasks, TaskSchema.parse(task)]
  return saveTaskList({ ...current, tasks: nextTasks, approved_at: undefined })
}

export const removeTask = async (taskId: string): Promise<TaskList> => {
  const current = await getTaskList()
  if (!current) throw new Error('No tasks available to delete.')
  const nextTasks = current.tasks.filter((task) => task.id !== taskId)
  return saveTaskList({ ...current, tasks: nextTasks, approved_at: undefined })
}

const syncTaskStates = async (tasks: Task[]): Promise<void> => {
  const ids = new Set(tasks.map((task) => task.id))
  await updateState((state) => {
    const retained = Object.fromEntries(
      Object.entries(state.task_states).filter(([id]) => ids.has(id))
    )
    const seeded = tasks.reduce<Record<string, TaskStatus>>((acc, task) => {
      acc[task.id] = (retained[task.id] as TaskStatus | undefined) ?? 'pending'
      return acc
    }, {})
    return { ...state, task_states: seeded }
  })
}

const isMissingFile = (error: { code?: string }): boolean => error.code === 'ENOENT'
