import { appendFile, readFile, writeFile } from 'fs/promises'
import { ensureDataDirs } from './storage'
import { getTaskLogPath } from './paths'
import { nowIso } from './time'

export const initTaskLog = async (taskId: string): Promise<string> => {
  await ensureDataDirs()
  const path = getTaskLogPath(taskId)
  await writeFile(path, `# Task ${taskId}\n# Started ${nowIso()}\n\n`, 'utf-8')
  return path
}

export const appendTaskLog = async (taskId: string, line: string): Promise<void> => {
  await ensureDataDirs()
  await appendFile(getTaskLogPath(taskId), `${line}\n`, 'utf-8')
}

export const readTaskLog = async (taskId: string): Promise<string> => {
  await ensureDataDirs()
  return readFile(getTaskLogPath(taskId), 'utf-8')
}
